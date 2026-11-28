import { HttpService } from '@nestjs/axios';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { IntegrationProvider, OnboardingFunnelStage, Prisma } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'node:crypto';

import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { OnboardingFunnelService } from '../analytics/onboarding-funnel.service';
import { EncryptionService } from '../common/services/encryption.service';

// Existing integrations
import { AsanaService } from './services/asana.service';
import { DemoConnectorService } from './services/demo-connector.service';
import { classifyConnectorFailure, connectorStateMessage, protectIntegrationTokens, redactConnectorSettings, revealIntegrationTokens, toPublicIntegration } from './connector-security.util';
import { AWSCloudWatchService } from './services/aws-cloudwatch.service';
import { AwsIotService } from './services/aws-iot.service';
import { AzureMonitorService } from './services/azure-monitor.service';
import { BigCommerceService } from './services/bigcommerce.service';
import { BigQueryService } from './services/bigquery.service';
import { DatadogService } from './services/datadog.service';
import { FacebookAdsService } from './services/facebook-ads.service';
import { FreshdeskService } from './services/freshdesk.service';
import { GcpMonitoringService } from './services/gcp-monitoring.service';
import { GitHubService } from './services/github.service';
import { GoogleAdsService } from './services/google-ads.service';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import { HarvestService } from './services/harvest.service';
import { HelpScoutService } from './services/helpscout.service';
import { HubSpotService } from './services/hubspot.service';
import { IntercomService } from './services/intercom.service';
import { JiraService } from './services/jira.service';
import { KafkaService } from './services/kafka.service';
import { LinkedInAdsService } from './services/linkedin-ads.service';
import { MongoDBAtlasService } from './services/mongodb-atlas.service';
import { MqttService } from './services/mqtt.service';
import { NewRelicService } from './services/newrelic.service';
import { PagerDutyService } from './services/pagerduty.service';
import { PipedriveService } from './services/pipedrive.service';
import { RedshiftService } from './services/redshift.service';
import { SalesforceService } from './services/salesforce.service';
import { SentryService } from './services/sentry.service';
import { ShopifyService } from './services/shopify.service';
import { SlackService } from './services/slack.service';
import { SnowflakeService } from './services/snowflake.service';
import { StripeConnectService } from './services/stripe-connect.service';
import { TikTokAdsService } from './services/tiktok-ads.service';
import { TrelloService } from './services/trello.service';
// E-commerce integrations
import { WooCommerceService } from './services/woocommerce.service';
// Marketing integrations
// CRM integrations
import { ZendeskService } from './services/zendesk.service';
import { ZohoCRMService } from './services/zoho-crm.service';

// Support integrations

// Database integrations

// Cloud & DevOps integrations

// Data Warehouse integrations

// IoT & Streaming integrations

// Payment integrations

export interface IntegrationConfig {
  workspaceId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  settings?: Record<string, any>;
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly demoConnectorService: DemoConnectorService,
    // Existing integrations
    private readonly asanaService: AsanaService,
    private readonly googleAnalyticsService: GoogleAnalyticsService,
    private readonly harvestService: HarvestService,
    private readonly jiraService: JiraService,
    private readonly trelloService: TrelloService,
    private readonly githubService: GitHubService,
    private readonly hubspotService: HubSpotService,
    private readonly slackService: SlackService,
    // E-commerce integrations
    private readonly shopifyService: ShopifyService,
    private readonly woocommerceService: WooCommerceService,
    private readonly bigcommerceService: BigCommerceService,
    // Marketing integrations
    private readonly facebookAdsService: FacebookAdsService,
    private readonly googleAdsService: GoogleAdsService,
    private readonly linkedinAdsService: LinkedInAdsService,
    private readonly tiktokAdsService: TikTokAdsService,
    // CRM integrations
    private readonly salesforceService: SalesforceService,
    private readonly pipedriveService: PipedriveService,
    private readonly zohoCrmService: ZohoCRMService,
    // Support integrations
    private readonly zendeskService: ZendeskService,
    private readonly intercomService: IntercomService,
    private readonly freshdeskService: FreshdeskService,
    private readonly helpscoutService: HelpScoutService,
    // Database integrations
    private readonly mongoDbAtlasService: MongoDBAtlasService,
    // Cloud & DevOps integrations
    private readonly awsCloudWatchService: AWSCloudWatchService,
    private readonly datadogService: DatadogService,
    private readonly sentryService: SentryService,
    private readonly pagerdutyService: PagerDutyService,
    private readonly newrelicService: NewRelicService,
    private readonly gcpMonitoringService: GcpMonitoringService,
    private readonly azureMonitorService: AzureMonitorService,
    // Data Warehouse integrations
    private readonly snowflakeService: SnowflakeService,
    private readonly bigqueryService: BigQueryService,
    private readonly redshiftService: RedshiftService,
    // IoT & Streaming integrations
    private readonly kafkaService: KafkaService,
    private readonly mqttService: MqttService,
    private readonly awsIotService: AwsIotService,
    // Payment integrations
    private readonly stripeConnectService: StripeConnectService,
    private readonly httpService: HttpService,
    private readonly encryptionService: EncryptionService,
    @Optional() private readonly onboardingFunnel?: OnboardingFunnelService,
  ) {}

  /**
   * Create a new integration
   */
  async createIntegration(config: IntegrationConfig) {
    if (config.provider === 'DEMO') {
      throw new BadRequestException('Create the Demo Connector with POST /api/v1/integrations/demo.');
    }

    const integration = await this.prisma.integration.create({
      data: {
        workspaceId: config.workspaceId,
        provider: config.provider,
        ...protectIntegrationTokens(this.encryptionService, {
          accessToken: config.accessToken,
          refreshToken: config.refreshToken,
        }),
        expiresAt: config.expiresAt,
        settings: config.settings || {},
        status: 'ACTIVE',
        connectionState: 'CONNECTED',
      },
    });

    this.logger.log(`Integration created: ${integration.id} (${config.provider})`);

    void this.onboardingFunnel?.recordStage(config.workspaceId, OnboardingFunnelStage.CONNECTED).catch(() => undefined);

    // Trigger initial sync
    await this.triggerSync(integration.id, 'full');

    return toPublicIntegration(integration);
  }

  /**
   * Get all integrations for a workspace
   */
  async getIntegrations(workspaceId: string) {
    return this.prisma.integration.findMany({
      where: { workspaceId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncedAt: true,
        createdAt: true,
        accountName: true,
        accountId: true,
        scopes: true,
        settings: true,
        connectionState: true,
        lastValidDataAt: true,
        updatedAt: true,
      },
    }).then((items) => items.map((item) => toPublicIntegration(item)));
  }

  async getSyncFreshness(workspaceId: string) {
    const [items, queue] = await Promise.all([
      this.prisma.integration.findMany({
        where: { workspaceId },
        select: {
          id: true,
          provider: true,
          connectionState: true,
          lastSyncedAt: true,
          lastValidDataAt: true,
          lastSyncError: true,
        },
      }),
      this.jobsService.getDataSyncMetrics(workspaceId),
    ]);
    const runs = items.length > 0 && this.prisma.syncRun?.findMany
      ? await this.prisma.syncRun.findMany({
        where: { integrationId: { in: items.map((item) => item.id) } },
        orderBy: { startedAt: 'desc' },
        select: { integrationId: true, status: true, processedCount: true, pageCount: true, lastErrorCode: true, startedAt: true },
      })
      : [];
    const latestRunByIntegration = new Map<string, (typeof runs)[number]>();
    for (const run of runs) if (!latestRunByIntegration.has(run.integrationId)) latestRunByIntegration.set(run.integrationId, run);
    const now = Date.now();
    return {
      integrations: items.map((item) => {
        const timestamp = item.lastValidDataAt ?? item.lastSyncedAt;
        const ageMs = timestamp ? Math.max(0, now - timestamp.getTime()) : null;
        return {
          id: item.id,
          provider: item.provider,
          connectionState: item.connectionState,
          lastUpdatedAt: timestamp,
          freshnessAgeMs: ageMs,
          health: item.connectionState === 'NEEDS_RECONNECT' || item.connectionState === 'DISCONNECTED'
            ? 'ERROR'
            : item.connectionState === 'DEGRADED'
              ? 'DEGRADED'
              : ageMs === null
                ? 'NEVER_SYNCED'
                : ageMs > 24 * 60 * 60 * 1000
                  ? 'STALE'
                  : 'HEALTHY',
          lastErrorCode: item.lastSyncError,
          latestRun: latestRunByIntegration.get(item.id) ?? null,
        };
      }),
      queue,
    };
  }

  /**
   * Get a single integration
   */
  async getIntegration(integrationId: string) {
    return toPublicIntegration(await this.getIntegrationRecord(integrationId));
  }

  private async getIntegrationRecord(integrationId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return revealIntegrationTokens(this.encryptionService, integration);
  }

  /** Reject cross-workspace integration identifiers before any secret-bearing operation. */
  async assertWorkspaceAccess(integrationId: string, workspaceId: string): Promise<void> {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      select: { workspaceId: true },
    });
    if (!integration) throw new NotFoundException('Integration not found');
    if (integration.workspaceId !== workspaceId) throw new ForbiddenException('Access denied to this integration');
  }

  async createDemoIntegration(workspaceId: string) {
    const integration = await this.prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider: 'DEMO' } },
      update: {},
      create: {
        workspaceId,
        provider: 'DEMO',
        accessToken: 'DEMO_ONLY_NO_CREDENTIAL',
        accountName: 'Real-Time Pulse Demo Connector (fictional data)',
        settings: this.demoConnectorService.getSettings() as Prisma.InputJsonObject,
        status: 'ACTIVE',
        connectionState: 'CONNECTED',
      },
    });
    void this.onboardingFunnel?.recordStage(workspaceId, OnboardingFunnelStage.CONNECTED).catch(() => undefined);
    return toPublicIntegration(integration);
  }

  /**
   * Update integration settings
   */
  async updateIntegration(integrationId: string, settings: Record<string, any>) {
    const safeSettings = redactConnectorSettings(settings) as Record<string, unknown>;
    if (JSON.stringify(safeSettings) !== JSON.stringify(settings)) {
      throw new BadRequestException('Credential fields cannot be changed through connector settings. Reconnect the provider instead.');
    }
    const integration = await this.prisma.integration.update({
      where: { id: integrationId },
      data: { settings: safeSettings as Prisma.InputJsonObject },
    });
    return toPublicIntegration(integration);
  }

  /**
   * Delete an integration
   */
  async deleteIntegration(integrationId: string) {
    await this.prisma.integration.delete({
      where: { id: integrationId },
    });

    this.logger.log(`Integration deleted: ${integrationId}`);
  }

  /**
   * Trigger data sync for an integration
   */
  async triggerSync(
    integrationId: string,
    syncType: 'full' | 'incremental' = 'incremental',
    dryRun = false,
    requestId?: string,
  ) {
    const integration = await this.getIntegrationRecord(integrationId);

    if (integration.provider === 'DEMO') {
      return { queued: false, dryRun, message: 'Demo data is deterministic and local; no provider sync job was queued.' };
    }

    if (dryRun) {
      return {
        queued: false,
        dryRun: true,
        provider: integration.provider,
        syncType,
        cursorAvailable: Boolean(integration.syncCursor),
        message: 'Dry run only: no provider request or queue job was created.',
      };
    }

    if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new BadRequestException('requestId must be a UUID');
    }

    await this.jobsService.queueDataSync({
      workspaceId: integration.workspaceId,
      integrationId: integration.id,
      syncType,
      requestId: requestId ?? randomUUID(),
    });

    this.logger.log(`Sync triggered for integration: ${integrationId}`);
    return { queued: true, dryRun: false, message: 'Sync queued successfully' };
  }

  /**
   * Fetch data from an integration
   */
  async fetchData(integrationId: string, dataType: string, params?: unknown): Promise<unknown> {
    const integration = await this.getIntegrationRecord(integrationId);
    const integrationConfig = {
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken ?? undefined,
      settings: (integration.settings as Record<string, any>) || {},
    };

    try {
      const data = await (async () => {
        switch (integration.provider) {
      case 'DEMO':
        return this.demoConnectorService.fetchData(dataType);

      // Existing integrations
      case 'ASANA':
        return this.asanaService.fetchData(integration, dataType, params);

      case 'GOOGLE_ANALYTICS':
      case 'GOOGLE_ANALYTICS_4':
        return this.googleAnalyticsService.fetchData(integration, dataType, params);

      case 'HARVEST':
        return this.harvestService.fetchData(
          {
            ...integration,
            refreshToken: integration.refreshToken ?? undefined,
            settings: integration.settings as any,
          },
          dataType,
          params as any,
        );

      case 'JIRA':
        return this.jiraService.fetchData(integration, dataType, params);

      case 'TRELLO':
        return this.trelloService.fetchData(integration, dataType, params);

      case 'GITHUB':
        return this.githubService.fetchData(integration, dataType, params);

      case 'HUBSPOT':
        return this.hubspotService.fetchData(integration, dataType, params);

      case 'SLACK':
        return this.slackService.fetchData(integration, dataType, params);

      // E-commerce integrations
      case 'SHOPIFY':
        return this.shopifyService.fetchData(integrationConfig as any, dataType, params as any);

      case 'WOOCOMMERCE':
        return this.woocommerceService.fetchData(integrationConfig as any, dataType, params as any);

      case 'BIGCOMMERCE':
        return this.bigcommerceService.fetchData(integrationConfig as any, dataType, params as any);

      // Marketing integrations
      case 'FACEBOOK_ADS':
        return this.facebookAdsService.fetchData(integrationConfig as any, dataType, params as any);

      case 'GOOGLE_ADS':
        return this.googleAdsService.fetchData(integrationConfig as any, dataType, params as any);

      case 'LINKEDIN_ADS':
        return this.linkedinAdsService.fetchData(integrationConfig as any, dataType, params as any);

      case 'TIKTOK_ADS':
        return this.tiktokAdsService.fetchData(integrationConfig as any, dataType, params as any);

      // CRM integrations
      case 'SALESFORCE':
        return this.salesforceService.fetchData(integrationConfig as any, dataType, params as any);

      case 'PIPEDRIVE':
        return this.pipedriveService.fetchData(integrationConfig, dataType, params as any);

      case 'ZOHO_CRM':
        return this.zohoCrmService.fetchData(integrationConfig, dataType, params as any);

      // Support integrations
      case 'ZENDESK':
        return this.zendeskService.fetchData(integrationConfig as any, dataType, params as any);

      case 'INTERCOM':
        return this.intercomService.fetchData(integrationConfig, dataType, params as any);

      case 'FRESHDESK':
        return this.freshdeskService.fetchData(integrationConfig as any, dataType, params as any);

      case 'HELPSCOUT':
        return this.helpscoutService.fetchData(integrationConfig, dataType, params as any);

      // Database integrations
      case 'MONGODB_ATLAS':
        return this.mongoDbAtlasService.fetchData(
          integrationConfig as any,
          dataType,
          params as any,
        );

      // Cloud & DevOps integrations
      case 'AWS_CLOUDWATCH':
        return this.awsCloudWatchService.fetchData(
          integrationConfig as any,
          dataType,
          params as any,
        );

      case 'DATADOG':
        return this.datadogService.fetchData(integrationConfig, dataType, params as any);

      case 'SENTRY':
        return this.sentryService.fetchData(integrationConfig as any, dataType, params as any);

      case 'PAGERDUTY':
        return this.pagerdutyService.fetchData(integrationConfig, dataType, params as any);

      case 'NEW_RELIC':
        return this.newrelicService.fetchData(integrationConfig as any, dataType, params as any);

      case 'GCP_MONITORING':
        return this.gcpMonitoringService.fetchData(
          integrationConfig as any,
          dataType,
          params as any,
        );

      case 'AZURE_MONITOR':
        return this.azureMonitorService.fetchData(
          integrationConfig as any,
          dataType,
          params as any,
        );

      // Data Warehouse integrations
      case 'SNOWFLAKE':
        return this.snowflakeService.fetchData(integrationConfig as any, dataType, params as any);

      case 'BIGQUERY':
        return this.bigqueryService.fetchData(integrationConfig as any, dataType, params as any);

      case 'REDSHIFT':
        return this.redshiftService.fetchData(integrationConfig as any, dataType, params as any);

      // IoT & Streaming integrations
      case 'KAFKA':
        return this.kafkaService.fetchData(integrationConfig as any, dataType, params as any);

      case 'MQTT_BROKER':
        return this.mqttService.fetchData(integrationConfig as any, dataType, params as any);

      case 'AWS_IOT':
        return this.awsIotService.fetchData(integrationConfig as any, dataType, params as any);

      // Payment integrations
      case 'STRIPE_CONNECT':
        return this.stripeConnectService.fetchData(integrationConfig, dataType, params as any);

      default:
        throw new Error(`Unsupported provider: ${integration.provider}`);
        }
      })();
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { connectionState: 'CONNECTED', lastValidDataAt: new Date(), lastSyncError: null },
      });
      return data;
    } catch (error) {
      const failure = classifyConnectorFailure(error);
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { connectionState: failure.state, lastSyncError: failure.code },
      });
      this.logger.warn(`Connector ${integration.provider} data request failed (${failure.code}); previous valid data timestamp preserved`);
      throw new BadRequestException(failure.message);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(integrationId: string) {
    const integration = await this.getIntegrationRecord(integrationId);
    if (integration.provider === 'DEMO') {
      const updated = await this.prisma.integration.update({ where: { id: integrationId }, data: { connectionState: 'CONNECTED', lastSyncError: null } });
      return toPublicIntegration(updated);
    }
    if (!integration.refreshToken) {
      await this.prisma.integration.update({ where: { id: integrationId }, data: { connectionState: 'NEEDS_RECONNECT', lastSyncError: 'invalid_grant' } });
      throw new BadRequestException('This provider account needs to be reconnected.');
    }

    const oauth = integration.provider === 'GITHUB'
      ? { endpoint: 'https://github.com/login/oauth/access_token', clientId: process.env.GITHUB_INTEGRATION_CLIENT_ID, clientSecret: process.env.GITHUB_INTEGRATION_CLIENT_SECRET }
      : ['GOOGLE_ANALYTICS', 'GOOGLE_ANALYTICS_4'].includes(integration.provider)
        ? { endpoint: 'https://oauth2.googleapis.com/token', clientId: process.env.GOOGLE_INTEGRATION_CLIENT_ID, clientSecret: process.env.GOOGLE_INTEGRATION_CLIENT_SECRET }
        : undefined;
    if (!oauth) throw new BadRequestException('Automatic token refresh is not supported for this provider. Reconnect the account.');
    if (!oauth.clientId || !oauth.clientSecret) {
      throw new BadRequestException('Automatic refresh is not configured for this provider. Contact your workspace administrator.');
    }

    const body = new URLSearchParams({
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      refresh_token: integration.refreshToken,
      grant_type: 'refresh_token',
    });
    try {
      const response = await firstValueFrom(this.httpService.post(oauth.endpoint, body.toString(), {
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      }));
      const refreshed = response.data as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
      if (!refreshed.access_token || refreshed.error) {
        throw { code: refreshed.error || 'invalid_grant', response: { status: 401, data: { error: refreshed.error } } };
      }
      const updated = await this.prisma.integration.update({
        where: { id: integrationId },
        data: {
          ...protectIntegrationTokens(this.encryptionService, {
            accessToken: refreshed.access_token,
            ...(refreshed.refresh_token ? { refreshToken: refreshed.refresh_token } : {}),
          }, process.env, integration.tokenEncryptionVersion ?? 0),
          expiresAt: refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
          connectionState: 'CONNECTED',
          lastSyncError: null,
        },
      });
      return toPublicIntegration(updated);
    } catch (error) {
      const failure = classifyConnectorFailure(error);
      await this.prisma.integration.update({ where: { id: integrationId }, data: { connectionState: failure.state, lastSyncError: failure.code } });
      this.logger.warn(`Connector ${integration.provider} token refresh failed (${failure.code})`);
      throw new BadRequestException(failure.message);
    }
  }

  /**
   * Test integration connection
   */
  async testConnection(integrationId: string) {
    const integration = await this.getIntegrationRecord(integrationId);
    const integrationConfig = {
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken ?? undefined,
      settings: (integration.settings as Record<string, any>) || {},
    };

    try {
      let result: boolean;

      switch (integration.provider) {
        case 'DEMO':
          result = true;
          break;

        // Existing integrations
        case 'ASANA':
          result = await this.asanaService.testConnection(integration);
          break;

        case 'GOOGLE_ANALYTICS':
        case 'GOOGLE_ANALYTICS_4':
          result = await this.googleAnalyticsService.testConnection(integration);
          break;

        case 'HARVEST':
          result = await this.harvestService.testConnection({
            ...integration,
            refreshToken: integration.refreshToken ?? undefined,
            settings: integration.settings as any,
          });
          break;

        case 'JIRA':
          result = await this.jiraService.testConnection(integration);
          break;

        case 'TRELLO':
          result = await this.trelloService.testConnection(integration);
          break;

        case 'GITHUB':
          result = await this.githubService.testConnection(integration);
          break;

        case 'HUBSPOT':
          result = await this.hubspotService.testConnection(integration);
          break;

        case 'SLACK':
          result = await this.slackService.testConnection(integration);
          break;

        // E-commerce integrations
        case 'SHOPIFY':
          result = await this.shopifyService.testConnection(integrationConfig as any);
          break;

        case 'WOOCOMMERCE':
          result = await this.woocommerceService.testConnection(integrationConfig as any);
          break;

        case 'BIGCOMMERCE':
          result = await this.bigcommerceService.testConnection(integrationConfig as any);
          break;

        // Marketing integrations
        case 'FACEBOOK_ADS':
          result = await this.facebookAdsService.testConnection(integrationConfig as any);
          break;

        case 'GOOGLE_ADS':
          result = await this.googleAdsService.testConnection(integrationConfig as any);
          break;

        case 'LINKEDIN_ADS':
          result = await this.linkedinAdsService.testConnection(integrationConfig as any);
          break;

        case 'TIKTOK_ADS':
          result = await this.tiktokAdsService.testConnection(integrationConfig as any);
          break;

        // CRM integrations
        case 'SALESFORCE':
          result = await this.salesforceService.testConnection(integrationConfig as any);
          break;

        case 'PIPEDRIVE':
          result = await this.pipedriveService.testConnection(integrationConfig);
          break;

        case 'ZOHO_CRM':
          result = await this.zohoCrmService.testConnection(integrationConfig);
          break;

        // Support integrations
        case 'ZENDESK':
          result = await this.zendeskService.testConnection(integrationConfig as any);
          break;

        case 'INTERCOM':
          result = await this.intercomService.testConnection(integrationConfig);
          break;

        case 'FRESHDESK':
          result = await this.freshdeskService.testConnection(integrationConfig as any);
          break;

        case 'HELPSCOUT':
          result = await this.helpscoutService.testConnection(integrationConfig);
          break;

        // Database integrations
        case 'MONGODB_ATLAS':
          result = await this.mongoDbAtlasService.testConnection(integrationConfig as any);
          break;

        // Cloud & DevOps integrations
        case 'AWS_CLOUDWATCH':
          result = await this.awsCloudWatchService.testConnection(integrationConfig as any);
          break;

        case 'DATADOG':
          result = await this.datadogService.testConnection(integrationConfig);
          break;

        case 'SENTRY':
          result = await this.sentryService.testConnection(integrationConfig as any);
          break;

        case 'PAGERDUTY':
          result = await this.pagerdutyService.testConnection(integrationConfig);
          break;

        case 'NEW_RELIC':
          result = await this.newrelicService.testConnection(integrationConfig as any);
          break;

        case 'GCP_MONITORING':
          result = await this.gcpMonitoringService.testConnection(integrationConfig as any);
          break;

        case 'AZURE_MONITOR':
          result = await this.azureMonitorService.testConnection(integrationConfig as any);
          break;

        // Data Warehouse integrations
        case 'SNOWFLAKE':
          result = await this.snowflakeService.testConnection(integrationConfig as any);
          break;

        case 'BIGQUERY':
          result = await this.bigqueryService.testConnection(integrationConfig as any);
          break;

        case 'REDSHIFT':
          result = await this.redshiftService.testConnection(integrationConfig as any);
          break;

        // IoT & Streaming integrations
        case 'KAFKA':
          result = await this.kafkaService.testConnection(integrationConfig as any);
          break;

        case 'MQTT_BROKER':
          result = await this.mqttService.testConnection(integrationConfig as any);
          break;

        case 'AWS_IOT':
          result = await this.awsIotService.testConnection(integrationConfig as any);
          break;

        // Payment integrations
        case 'STRIPE_CONNECT':
          result = await this.stripeConnectService.testConnection(integrationConfig);
          break;

        default:
          throw new Error(`Unsupported provider: ${integration.provider}`);
      }

      if (result) {
        await this.prisma.integration.update({
          where: { id: integrationId },
          data: { connectionState: 'CONNECTED', lastSyncError: null },
        });
        return { connected: true, connectionState: 'CONNECTED', message: connectorStateMessage('CONNECTED') };
      }
      const failure = classifyConnectorFailure({ response: { status: 503 } });
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { connectionState: failure.state, lastSyncError: failure.code },
      });
      return { connected: false, connectionState: failure.state, message: failure.message };
    } catch (error) {
      const failure = classifyConnectorFailure(error);
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { connectionState: failure.state, lastSyncError: failure.code },
      });
      this.logger.warn(`Connector ${integration.provider} connection test failed (${failure.code})`);
      return {
        connected: false,
        connectionState: failure.state,
        message: failure.message,
      };
    }
  }
}
