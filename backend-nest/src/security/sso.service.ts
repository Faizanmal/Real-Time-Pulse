import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';
import * as crypto from 'crypto';

export interface SsoProvider {
  id: string;
  name: string;
  type: 'saml' | 'oidc' | 'oauth2';
  enabled: boolean;
  config: SamlConfig | OidcConfig | OAuth2Config;
}

export interface SamlConfig {
  entryPoint: string;
  issuer: string;
  cert: string;
  callbackUrl: string;
  signAuthnRequest: boolean;
  attributeMapping: Record<string, string>;
}

export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  attributeMapping: Record<string, string>;
}

export interface OAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  attributeMapping: Record<string, string>;
}

export interface SsoUser {
  id: string;
  email: string;
  name: string;
  attributes: Record<string, any>;
  provider: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
}

export interface UserInfo {
  sub: string;
  email: string;
  name: string;
  [key: string]: any;
}

export interface SsoLink {
  provider: string;
  externalId: string;
  linkedAt: string;
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private readonly SSO_PREFIX = 'sso:providers:';
  private readonly SSO_LINKS_PREFIX = 'sso:links:';

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private cacheService: CacheService,
    private auditService: AuditService,
  ) {}

  /**
   * Get SSO providers for a workspace
   */
  async getSsoProviders(workspaceId: string): Promise<SsoProvider[]> {
    const cached = await this.cacheService.get(
      `${this.SSO_PREFIX}${workspaceId}`,
    );
    return cached ? (JSON.parse(cached) as SsoProvider[]) : [];
  }

  /**
   * Save SSO providers for a workspace
   */
  private async saveSsoProviders(
    workspaceId: string,
    providers: SsoProvider[],
  ): Promise<void> {
    await this.cacheService.set(
      `${this.SSO_PREFIX}${workspaceId}`,
      JSON.stringify(providers),
      365 * 24 * 60 * 60, // 1 year
    );
  }

  /**
   * Configure SSO provider for a workspace
   */
  async configureSsoProvider(
    workspaceId: string,
    provider: SsoProvider,
    userId: string,
  ): Promise<SsoProvider> {
    const providers = await this.getSsoProviders(workspaceId);

    // Check if provider with same ID exists
    const existingIndex = providers.findIndex((p) => p.id === provider.id);
    if (existingIndex >= 0) {
      providers[existingIndex] = provider;
    } else {
      providers.push(provider);
    }

    await this.saveSsoProviders(workspaceId, providers);

    await this.auditService.log({
      action: 'CHANGE_SETTINGS',
      userId,
      workspaceId,
      userEmail: '',
      entity: 'sso_provider',
      entityId: provider.id,
      method: 'POST',
      endpoint: '/security/sso/providers',
      metadata: { providerType: provider.type, providerName: provider.name },
    });

    this.logger.log(
      `SSO provider ${provider.name} configured for workspace ${workspaceId}`,
    );
    return provider;
  }

  /**
   * Remove SSO provider
   */
  async removeSsoProvider(
    workspaceId: string,
    providerId: string,
    userId: string,
  ): Promise<void> {
    const providers = await this.getSsoProviders(workspaceId);
    const updatedProviders = providers.filter((p) => p.id !== providerId);

    await this.saveSsoProviders(workspaceId, updatedProviders);

    await this.auditService.log({
      action: 'DELETE',
      userId,
      workspaceId,
      userEmail: '',
      entity: 'sso_provider',
      entityId: providerId,
      method: 'DELETE',
      endpoint: '/security/sso/providers',
      metadata: {},
    });

    this.logger.log(
      `SSO provider ${providerId} removed from workspace ${workspaceId}`,
    );
  }

  /**
   * Initiate OIDC login
   */
  async initiateOidcLogin(
    workspaceId: string,
    providerId: string,
  ): Promise<{ authUrl: string; state: string }> {
    const providers = await this.getSsoProviders(workspaceId);
    const provider = providers.find((p) => p.id === providerId);

    if (!provider || provider.type !== 'oidc') {
      throw new BadRequestException('OIDC provider not found');
    }

    const config = provider.config as OidcConfig;
    const state = crypto.randomBytes(32).toString('hex');

    // Store state for verification
    await this.cacheService.set(
      `sso:state:${state}`,
      JSON.stringify({ workspaceId, providerId }),
      10 * 60,
    );

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scope.join(' '),
      state,
    });

    const authUrl = `${config.issuer}/authorize?${params.toString()}`;

    return { authUrl, state };
  }

  /**
   * Handle OIDC callback
   */
  async handleOidcCallback(
    workspaceId: string,
    providerId: string,
    code: string,
    _state: string,
  ): Promise<SsoUser> {
    const providers = await this.getSsoProviders(workspaceId);
    const provider = providers.find((p) => p.id === providerId);

    if (!provider || provider.type !== 'oidc') {
      throw new BadRequestException('OIDC provider not found');
    }

    const config = provider.config as OidcConfig;

    // Exchange code for tokens
    const tokenResponse = await fetch(`${config.issuer}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Failed to exchange code for tokens');
    }

    const tokens = (await tokenResponse.json()) as TokenResponse;

    // Get user info
    const userInfoResponse = await fetch(`${config.issuer}/userinfo`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new UnauthorizedException('Failed to get user info');
    }

    const userInfo = (await userInfoResponse.json()) as UserInfo;

    // Map attributes
    const ssoUser: SsoUser = {
      id: userInfo[config.attributeMapping.id || 'sub'],
      email: userInfo[config.attributeMapping.email || 'email'],
      name: userInfo[config.attributeMapping.name || 'name'],
      attributes: userInfo,
      provider: provider.name,
    };

    return ssoUser;
  }

  /**
   * Initiate OAuth2 login
   */
  async initiateOAuth2Login(
    workspaceId: string,
    providerId: string,
  ): Promise<{ authUrl: string; state: string }> {
    const providers = await this.getSsoProviders(workspaceId);
    const provider = providers.find((p) => p.id === providerId);

    if (!provider || provider.type !== 'oauth2') {
      throw new BadRequestException('OAuth2 provider not found');
    }

    const config = provider.config as OAuth2Config;
    const state = crypto.randomBytes(32).toString('hex');

    await this.cacheService.set(
      `sso:state:${state}`,
      JSON.stringify({ workspaceId, providerId }),
      10 * 60,
    );

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scope.join(' '),
      state,
    });

    const authUrl = `${config.authorizationUrl}?${params.toString()}`;

    return { authUrl, state };
  }

  /**
   * Handle OAuth2 callback
   */
  async handleOAuth2Callback(
    workspaceId: string,
    providerId: string,
    code: string,
    _state: string,
  ): Promise<SsoUser> {
    const providers = await this.getSsoProviders(workspaceId);
    const provider = providers.find((p) => p.id === providerId);

    if (!provider || provider.type !== 'oauth2') {
      throw new BadRequestException('OAuth2 provider not found');
    }

    const config = provider.config as OAuth2Config;

    // Exchange code for tokens
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Failed to exchange code for tokens');
    }

    const tokens = (await tokenResponse.json()) as TokenResponse;

    // Get user info
    const userInfoResponse = await fetch(config.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new UnauthorizedException('Failed to get user info');
    }

    const userInfo = (await userInfoResponse.json()) as UserInfo;

    // Map attributes
    const ssoUser: SsoUser = {
      id: userInfo[config.attributeMapping.id || 'id'],
      email: userInfo[config.attributeMapping.email || 'email'],
      name: userInfo[config.attributeMapping.name || 'name'],
      attributes: userInfo,
      provider: provider.name,
    };

    return ssoUser;
  }

  /**
   * Get SSO links for a user
   */
  private async getSsoLinks(userId: string): Promise<SsoLink[]> {
    const cached = await this.cacheService.get(
      `${this.SSO_LINKS_PREFIX}${userId}`,
    );
    return cached ? (JSON.parse(cached) as SsoLink[]) : [];
  }

  /**
   * Save SSO links for a user
   */
  private async saveSsoLinks(userId: string, links: SsoLink[]): Promise<void> {
    await this.cacheService.set(
      `${this.SSO_LINKS_PREFIX}${userId}`,
      JSON.stringify(links),
      365 * 24 * 60 * 60,
    );
  }

  /**
   * Link SSO account to existing user
   */
  async linkSsoAccount(
    userId: string,
    ssoUser: SsoUser,
    workspaceId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const ssoLinks = await this.getSsoLinks(userId);
    ssoLinks.push({
      provider: ssoUser.provider,
      externalId: ssoUser.id,
      linkedAt: new Date().toISOString(),
    });

    await this.saveSsoLinks(userId, ssoLinks);

    await this.auditService.log({
      action: 'CONNECT_INTEGRATION',
      userId,
      workspaceId,
      userEmail: '',
      entity: 'user',
      entityId: userId,
      method: 'POST',
      endpoint: '/security/sso/link',
      metadata: {
        provider: ssoUser.provider,
        externalId: ssoUser.id,
        type: 'sso_link',
      },
    });

    this.logger.log(
      `SSO account linked for user ${userId} with provider ${ssoUser.provider}`,
    );
  }

  /**
   * Find user by SSO identity
   */
  async findUserBySsoIdentity(
    provider: string,
    externalId: string,
  ): Promise<string | null> {
    // Search through all users - in production, use a proper index
    const users = await this.prisma.user.findMany({
      select: { id: true },
    });

    for (const user of users) {
      const links = await this.getSsoLinks(user.id);
      const match = links.find(
        (link: SsoLink) =>
          link.provider === provider && link.externalId === externalId,
      );
      if (match) {
        return user.id;
      }
    }

    return null;
  }

  /**
   * Provision user from SSO
   */
  async provisionUserFromSso(
    ssoUser: SsoUser,
    workspaceId: string,
  ): Promise<string> {
    // Check if user with email exists
    let user = await this.prisma.user.findUnique({
      where: { email: ssoUser.email },
    });

    if (!user) {
      // Parse name into first/last
      const nameParts = ssoUser.name.split(' ');
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(' ') || null;

      // Create new user
      user = await this.prisma.user.create({
        data: {
          email: ssoUser.email,
          firstName,
          lastName,
          emailVerified: true, // SSO users are considered verified
          workspaceId,
        },
      });

      this.logger.log(
        `User ${user.id} provisioned from SSO provider ${ssoUser.provider}`,
      );
    }

    // Link SSO account
    await this.linkSsoAccount(user.id, ssoUser, workspaceId);

    await this.auditService.log({
      action: 'LOGIN',
      userId: user.id,
      workspaceId,
      userEmail: user.email,
      entity: 'user',
      entityId: user.id,
      method: 'POST',
      endpoint: '/auth/sso',
      metadata: { provider: ssoUser.provider, type: 'sso_login' },
    });

    return user.id;
  }
}
