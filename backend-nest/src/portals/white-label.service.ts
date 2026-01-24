/**
 * White-Labeling Configuration Service
 * Allows agencies and enterprises to rebrand the platform
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../common/logger/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { v4 as uuidv4 } from 'uuid';

interface WhiteLabelConfig {
  id: string;
  organizationId: string;
  enabled: boolean;

  // Branding
  branding: {
    companyName: string;
    logo: { light: string; dark: string };
    favicon: string;
    tagline?: string;

    // Colors
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      success: string;
      warning: string;
      error: string;
      background: { light: string; dark: string };
      surface: { light: string; dark: string };
      text: { light: string; dark: string };
    };

    // Typography
    fonts: {
      heading: string;
      body: string;
      mono?: string;
    };

    // Border radius
    borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full';
  };

  // Domain & URLs
  domain: {
    customDomain?: string;
    sslEnabled: boolean;
    subdomain?: string;
  };

  // Email customization
  email: {
    fromName: string;
    fromEmail: string;
    replyTo?: string;
    templates: Record<string, { subject: string; header: string; footer: string }>;
  };

  // Features
  features: {
    hidePoweredBy: boolean;
    customLoginPage: boolean;
    customErrorPages: boolean;
    customHelpCenter: boolean;
    customTermsUrl?: string;
    customPrivacyUrl?: string;
    customSupportUrl?: string;
  };

  // Advanced
  advanced: {
    customCss?: string;
    customJs?: string;
    metaTags: Record<string, string>;
    analyticsId?: string;
  };
}

interface CustomDomainStatus {
  domain: string;
  status: 'pending' | 'verifying' | 'active' | 'failed';
  sslStatus: 'pending' | 'issued' | 'failed';
  dnsRecords: DnsRecord[];
  verifiedAt?: Date;
}

interface DnsRecord {
  type: 'CNAME' | 'A' | 'TXT';
  name: string;
  value: string;
  verified: boolean;
}

@Injectable()
export class WhiteLabelService {
  private readonly baseDomain: string;
  private readonly cdnUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    this.baseDomain = this.configService.get<string>('app.baseDomain') || 'realtimepulse.com';
    this.cdnUrl = this.configService.get<string>('app.cdnUrl') || 'https://cdn.realtimepulse.com';
  }

  // ==================== CONFIGURATION MANAGEMENT ====================

  /**
   * Get white-label configuration for an organization
   */
  async getConfig(organizationId: string): Promise<WhiteLabelConfig | null> {
    const cacheKey = `whitelabel:${organizationId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const config = await this.prisma.whiteLabelConfig.findUnique({
      where: { organizationId } as any,
    });

    if (config) {
      await this.cache.set(cacheKey, JSON.stringify(config), 3600);
    }

    return config as unknown as WhiteLabelConfig;
  }

  /**
   * Get configuration by custom domain
   */
  async getConfigByDomain(domain: string): Promise<WhiteLabelConfig | null> {
    const cacheKey = `whitelabel:domain:${domain}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const config = await this.prisma.whiteLabelConfig.findFirst({
      where: {
        OR: [{ domain: { customDomain: domain } }, { domain: { subdomain: domain.split('.')[0] } }],
        enabled: true,
      } as any,
    });

    if (config) {
      await this.cache.set(cacheKey, JSON.stringify(config), 3600);
    }

    return config as unknown as WhiteLabelConfig;
  }

  /**
   * Create or update white-label configuration
   */
  async upsertConfig(
    organizationId: string,
    config: Partial<WhiteLabelConfig>,
  ): Promise<WhiteLabelConfig> {
    const existing = await this.prisma.whiteLabelConfig.findUnique({
      where: { organizationId } as any,
    });

    let result;
    if (existing) {
      result = await this.prisma.whiteLabelConfig.update({
        where: { organizationId } as any,
        data: {
          ...config,
          updatedAt: new Date(),
        } as any,
      });
    } else {
      result = await this.prisma.whiteLabelConfig.create({
        data: {
          id: uuidv4(),
          organizationId,
          enabled: false,
          branding: this.getDefaultBranding() as any,
          domain: {} as any,
          email: this.getDefaultEmailConfig() as any,
          features: this.getDefaultFeatures() as any,
          advanced: {} as any,
          ...config,
          createdAt: new Date(),
        } as any,
      });
    }

    // Invalidate cache
    await this.cache.del(`whitelabel:${organizationId}`);
    if (config.domain?.customDomain) {
      await this.cache.del(`whitelabel:domain:${config.domain.customDomain}`);
    }

    return result as unknown as WhiteLabelConfig;
  }

  /**
   * Enable/disable white-labeling
   */
  async setEnabled(organizationId: string, enabled: boolean): Promise<void> {
    await this.prisma.whiteLabelConfig.update({
      where: { organizationId } as any,
      data: { enabled, updatedAt: new Date() } as any,
    });

    await this.cache.del(`whitelabel:${organizationId}`);
  }

  // ==================== CUSTOM DOMAIN MANAGEMENT ====================

  /**
   * Request a custom domain
   */
  async requestCustomDomain(organizationId: string, domain: string): Promise<CustomDomainStatus> {
    // Validate domain format
    if (!this.isValidDomain(domain)) {
      throw new BadRequestException('Invalid domain format');
    }

    // Check if domain is already in use
    const existing = await this.prisma.whiteLabelConfig.findFirst({
      where: { domain: { customDomain: domain } } as any,
    });

    if (existing && (existing as any).organizationId !== organizationId) {
      throw new BadRequestException('Domain is already in use');
    }

    // Generate DNS verification records
    const verificationToken = uuidv4();
    const dnsRecords: DnsRecord[] = [
      {
        type: 'CNAME',
        name: domain,
        value: `proxy.${this.baseDomain}`,
        verified: false,
      },
      {
        type: 'TXT',
        name: `_realtimepulse-verify.${domain}`,
        value: verificationToken,
        verified: false,
      },
    ];

    // Save domain request
    await this.prisma.customDomainRequest.upsert({
      where: { organizationId } as any,
      create: {
        id: uuidv4(),
        organizationId,
        domain,
        status: 'pending',
        verificationToken,
        dnsRecords: dnsRecords as any,
        createdAt: new Date(),
      } as any,
      update: {
        domain,
        status: 'pending',
        verificationToken,
        dnsRecords: dnsRecords as any,
        updatedAt: new Date(),
      } as any,
    });

    return {
      domain,
      status: 'pending',
      sslStatus: 'pending',
      dnsRecords,
    };
  }

  /**
   * Verify custom domain DNS
   */
  async verifyCustomDomain(organizationId: string): Promise<CustomDomainStatus> {
    const request = await this.prisma.customDomainRequest.findUnique({
      where: { organizationId } as any,
    });

    if (!request) {
      throw new BadRequestException('No domain request found');
    }

    // In production, this would actually check DNS
    const dnsRecords = (request.dnsRecords as unknown as DnsRecord[]).map((r) => ({
      ...r,
      verified: true, // Mock verification
    }));

    const allVerified = dnsRecords.every((r) => r.verified);

    if (allVerified) {
      await this.prisma.customDomainRequest.update({
        where: { id: request.id },
        data: {
          status: 'active',
          sslStatus: 'issued',
          dnsRecords: dnsRecords as any,
          verifiedAt: new Date(),
        } as any,
      });

      // Update white-label config
      await this.prisma.whiteLabelConfig.update({
        where: { organizationId } as any,
        data: {
          domain: {
            customDomain: request.domain,
            sslEnabled: true,
          } as any,
        } as any,
      });

      await this.cache.del(`whitelabel:${organizationId}`);
    }

    return {
      domain: request.domain,
      status: allVerified ? 'active' : 'verifying',
      sslStatus: allVerified ? 'issued' : 'pending',
      dnsRecords,
      verifiedAt: allVerified ? new Date() : undefined,
    };
  }

  /**
   * Get custom domain status
   */
  async getCustomDomainStatus(organizationId: string): Promise<CustomDomainStatus | null> {
    const request = await this.prisma.customDomainRequest.findUnique({
      where: { organizationId } as any,
    });

    if (!request) return null;

    return {
      domain: request.domain,
      status: request.status as any,
      sslStatus: request.sslStatus as any,
      dnsRecords: request.dnsRecords as unknown as DnsRecord[],
      verifiedAt: request.verifiedAt || undefined,
    };
  }

  // ==================== BRANDING ====================

  /**
   * Update branding configuration
   */
  async updateBranding(
    organizationId: string,
    branding: Partial<WhiteLabelConfig['branding']>,
  ): Promise<WhiteLabelConfig['branding']> {
    const config = await this.getConfig(organizationId);
    if (!config) {
      throw new BadRequestException('White-label config not found');
    }

    const updatedBranding = { ...config.branding, ...branding };

    await this.prisma.whiteLabelConfig.update({
      where: { organizationId } as any,
      data: { branding: updatedBranding as any, updatedAt: new Date() },
    });

    await this.cache.del(`whitelabel:${organizationId}`);
    return updatedBranding;
  }

  /**
   * Generate CSS variables from branding config
   */
  generateCssVariables(branding: WhiteLabelConfig['branding']): string {
    const borderRadiusValues = {
      none: '0',
      small: '0.25rem',
      medium: '0.5rem',
      large: '1rem',
      full: '9999px',
    };

    return `
      :root {
        /* Colors */
        --color-primary: ${branding.colors.primary};
        --color-secondary: ${branding.colors.secondary};
        --color-accent: ${branding.colors.accent};
        --color-success: ${branding.colors.success};
        --color-warning: ${branding.colors.warning};
        --color-error: ${branding.colors.error};
        
        /* Light mode */
        --color-background: ${branding.colors.background.light};
        --color-surface: ${branding.colors.surface.light};
        --color-text: ${branding.colors.text.light};
        
        /* Typography */
        --font-heading: ${branding.fonts.heading}, system-ui, sans-serif;
        --font-body: ${branding.fonts.body}, system-ui, sans-serif;
        --font-mono: ${branding.fonts.mono || 'monospace'};
        
        /* Border radius */
        --radius: ${borderRadiusValues[branding.borderRadius]};
      }
      
      .dark, [data-theme="dark"] {
        --color-background: ${branding.colors.background.dark};
        --color-surface: ${branding.colors.surface.dark};
        --color-text: ${branding.colors.text.dark};
      }
    `.trim();
  }

  // ==================== EMAIL CUSTOMIZATION ====================

  /**
   * Update email configuration
   */
  async updateEmailConfig(
    organizationId: string,
    email: Partial<WhiteLabelConfig['email']>,
  ): Promise<WhiteLabelConfig['email']> {
    const config = await this.getConfig(organizationId);
    if (!config) {
      throw new BadRequestException('White-label config not found');
    }

    const updatedEmail = { ...config.email, ...email };

    await this.prisma.whiteLabelConfig.update({
      where: { organizationId } as any,
      data: { email: updatedEmail as any, updatedAt: new Date() },
    });

    await this.cache.del(`whitelabel:${organizationId}`);
    return updatedEmail;
  }

  /**
   * Get email template with white-label customization
   */
  async getEmailTemplate(
    organizationId: string,
    templateName: string,
  ): Promise<{
    subject: string;
    header: string;
    footer: string;
    fromName: string;
    fromEmail: string;
  }> {
    const config = await this.getConfig(organizationId);

    if (!config || !config.enabled) {
      return this.getDefaultEmailTemplate(templateName) as any;
    }

    const template =
      config.email.templates[templateName] || this.getDefaultEmailTemplate(templateName);

    return {
      ...template,
      fromName: config.email.fromName,
      fromEmail: config.email.fromEmail,
    };
  }

  // ==================== ASSET MANAGEMENT ====================

  /**
   * Upload a branding asset (logo, favicon)
   */
  async uploadAsset(
    organizationId: string,
    assetType: 'logo-light' | 'logo-dark' | 'favicon',
    _file: Buffer,
    _mimeType: string,
  ): Promise<string> {
    // In production, upload to CDN/S3
    const filename = `${organizationId}/${assetType}-${Date.now()}`;
    const url = `${this.cdnUrl}/whitelabel/${filename}`;

    // Mock upload - in production use S3/CloudFront
    this.logger.log(`Uploading ${assetType} for org ${organizationId}`, 'WhiteLabelService');

    return url;
  }

  // ==================== PREVIEW ====================

  /**
   * Generate preview of white-label configuration
   */
  async generatePreview(
    config: Partial<WhiteLabelConfig>,
  ): Promise<{ previewUrl: string; expiresAt: Date }> {
    const previewId = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.cache.set(`whitelabel:preview:${previewId}`, JSON.stringify(config), 3600);

    return {
      previewUrl: `${this.configService.get('app.frontendUrl')}/preview?id=${previewId}`,
      expiresAt,
    };
  }

  /**
   * Get preview configuration
   */
  async getPreviewConfig(previewId: string): Promise<Partial<WhiteLabelConfig> | null> {
    const cached = await this.cache.get(`whitelabel:preview:${previewId}`);
    return cached ? JSON.parse(cached) : null;
  }

  // ==================== HELPER METHODS ====================

  private isValidDomain(domain: string): boolean {
    const domainRegex = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.(?!-)[A-Za-z0-9.-]{1,253}(?<!-)$/;
    return domainRegex.test(domain);
  }

  private getDefaultBranding(): WhiteLabelConfig['branding'] {
    return {
      companyName: 'Real-Time Pulse',
      logo: {
        light: `${this.cdnUrl}/logo-light.svg`,
        dark: `${this.cdnUrl}/logo-dark.svg`,
      },
      favicon: `${this.cdnUrl}/favicon.ico`,
      colors: {
        primary: '#3B82F6',
        secondary: '#6366F1',
        accent: '#8B5CF6',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        background: { light: '#FFFFFF', dark: '#0F172A' },
        surface: { light: '#F8FAFC', dark: '#1E293B' },
        text: { light: '#1E293B', dark: '#F8FAFC' },
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
        mono: 'JetBrains Mono',
      },
      borderRadius: 'medium',
    };
  }

  private getDefaultEmailConfig(): WhiteLabelConfig['email'] {
    return {
      fromName: 'Real-Time Pulse',
      fromEmail: 'no-reply@realtimepulse.com',
      templates: {},
    };
  }

  private getDefaultFeatures(): WhiteLabelConfig['features'] {
    return {
      hidePoweredBy: false,
      customLoginPage: false,
      customErrorPages: false,
      customHelpCenter: false,
    };
  }

  private getDefaultEmailTemplate(_templateName: string): {
    subject: string;
    header: string;
    footer: string;
  } {
    return {
      subject: 'Real-Time Pulse Notification',
      header: '<img src="https://cdn.realtimepulse.com/logo.png" alt="Real-Time Pulse" />',
      footer: '© Real-Time Pulse. All rights reserved.',
    };
  }
}
