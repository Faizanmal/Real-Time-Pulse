/**
 * Microsoft Teams Integration Service
 * Provides Teams channel integration with adaptive cards and bot messaging
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { LoggingService } from '../../common/logger/logging.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TeamsIntegrationService {
  private readonly graphUrl = 'https://graph.microsoft.com/v1.0';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tenantId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly logger: LoggingService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    this.clientId = this.configService.get<string>('integrations.teams.clientId') || '';
    this.clientSecret = this.configService.get<string>('integrations.teams.clientSecret') || '';
    this.tenantId = this.configService.get<string>('integrations.teams.tenantId') || '';
  }

  /**
   * Generate OAuth authorization URL for Teams
   */
  getAuthorizationUrl(workspaceId: string, redirectUri: string): string {
    const scopes = [
      'https://graph.microsoft.com/ChannelMessage.Send',
      'https://graph.microsoft.com/Team.ReadBasic.All',
      'https://graph.microsoft.com/Channel.ReadBasic.All',
    ].join(' ');

    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64');

    return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?client_id=${this.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${state}`;
  }

  /**
   * Exchange OAuth code for access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
          new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }).toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Teams OAuth error: ${error}`, 'TeamsIntegrationService');
      throw error;
    }
  }

  /**
   * Connect Teams to workspace
   */
  async connectWorkspace(workspaceId: string, oauthData: any): Promise<void> {
    await this.prisma.integration.upsert({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: 'TEAMS',
        },
      },
      update: {
        accessToken: oauthData.access_token,
        refreshToken: oauthData.refresh_token,
        settings: {
          expiresAt: Date.now() + oauthData.expires_in * 1000,
        },
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
      create: {
        workspaceId,
        provider: 'TEAMS',
        accessToken: oauthData.access_token,
        refreshToken: oauthData.refresh_token,
        settings: {
          expiresAt: Date.now() + oauthData.expires_in * 1000,
        },
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Teams connected for workspace ${workspaceId}`, 'TeamsIntegrationService');
  }

  /**
   * Send message via incoming webhook
   */
  async sendWebhookMessage(webhookUrl: string, card: any): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(webhookUrl, {
          type: 'message',
          attachments: [
            {
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: card,
            },
          ],
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to send Teams webhook message: ${error}`,
        'TeamsIntegrationService',
      );
      throw error;
    }
  }

  /**
   * Send dashboard alert to Teams
   */
  async sendDashboardAlert(
    workspaceId: string,
    alertData: {
      title: string;
      description: string;
      severity: 'info' | 'warning' | 'critical';
      dashboardUrl?: string;
      metrics?: { name: string; value: string }[];
    },
  ): Promise<void> {
    const integration = await this.getIntegration(workspaceId);
    if (!(integration as any)?.metadata?.webhookUrl) return;

    const severityColors = {
      info: 'accent',
      warning: 'warning',
      critical: 'attention',
    };

    const card = {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: alertData.title,
          weight: 'bolder',
          size: 'large',
          color: severityColors[alertData.severity],
        },
        {
          type: 'TextBlock',
          text: alertData.description,
          wrap: true,
        },
      ],
      actions: [],
    };

    if (alertData.metrics && alertData.metrics.length > 0) {
      card.body.push({
        type: 'FactSet',
        facts: alertData.metrics.map((m) => ({
          title: m.name,
          value: m.value,
        })),
      } as any);
    }

    if (alertData.dashboardUrl) {
      card.actions.push({
        type: 'Action.OpenUrl',
        title: 'View Dashboard',
        url: alertData.dashboardUrl,
      });
    }

    await this.sendWebhookMessage((integration.settings as any).webhookUrl, card);
  }

  /**
   * Send scheduled report notification
   */
  async sendReportNotification(
    workspaceId: string,
    reportData: {
      name: string;
      period: string;
      summary: string;
      downloadUrl: string;
    },
  ): Promise<void> {
    const integration = await this.getIntegration(workspaceId);
    if (!(integration as any)?.metadata?.webhookUrl) return;

    const card = {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        {
          type: 'TextBlock',
          text: `📊 ${reportData.name}`,
          weight: 'bolder',
          size: 'large',
        },
        {
          type: 'FactSet',
          facts: [{ title: 'Period', value: reportData.period }],
        },
        {
          type: 'TextBlock',
          text: reportData.summary,
          wrap: true,
        },
      ],
      actions: [
        {
          type: 'Action.OpenUrl',
          title: 'Download Report',
          url: reportData.downloadUrl,
        },
      ],
    };

    await this.sendWebhookMessage((integration.settings as any).webhookUrl, card);
  }

  /**
   * Configure incoming webhook
   */
  async configureWebhook(workspaceId: string, webhookUrl: string): Promise<void> {
    await this.prisma.integration.update({
      where: {
        workspaceId_provider: {
          workspaceId,
          provider: 'TEAMS',
        },
      },
      data: {
        settings: {
          webhookUrl,
        },
      },
    });
  }

  /**
   * Get Teams channels (requires Graph API permissions)
   */
  async getTeams(workspaceId: string): Promise<any[]> {
    const integration = await this.getIntegration(workspaceId);
    if (!integration) return [];

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.graphUrl}/me/joinedTeams`, {
          headers: { Authorization: `Bearer ${integration.accessToken}` },
        }),
      );

      return response.data.value || [];
    } catch (error) {
      this.logger.error(`Failed to get Teams: ${error}`, 'TeamsIntegrationService');
      return [];
    }
  }

  /**
   * Disconnect Teams integration
   */
  async disconnect(workspaceId: string): Promise<void> {
    await this.prisma.integration.updateMany({
      where: { workspaceId, provider: 'TEAMS' },
      data: { status: 'INACTIVE' },
    });
    this.logger.log(`Teams disconnected for workspace ${workspaceId}`, 'TeamsIntegrationService');
  }

  private async getIntegration(workspaceId: string) {
    return this.prisma.integration.findFirst({
      where: { workspaceId, provider: 'TEAMS', status: 'ACTIVE' },
    });
  }
}
