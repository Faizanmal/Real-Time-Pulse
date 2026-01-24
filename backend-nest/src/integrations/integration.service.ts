import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';

// Existing integrations
import { AsanaService } from './services/asana.service';
import { GoogleAnalyticsService } from './services/google-analytics.service';
import { HarvestService } from './services/harvest.service';
import { JiraService } from './services/jira.service';
import { TrelloService } from './services/trello.service';
import { GitHubService } from './services/github.service';
import { HubSpotService } from './services/hubspot.service';
import { SlackService } from './services/slack.service';

// E-commerce integrations
import { ShopifyService } from './services/shopify.service';
import { WooCommerceService } from './services/woocommerce.service';
import { BigCommerceService } from './services/bigcommerce.service';

// Marketing integrations
import { FacebookAdsService } from './services/facebook-ads.service';
import { GoogleAdsService } from './services/google-ads.service';
import { LinkedInAdsService } from './services/linkedin-ads.service';
import { TikTokAdsService } from './services/tiktok-ads.service';

// CRM integrations
import { SalesforceService } from './services/salesforce.service';
import { PipedriveService } from './services/pipedrive.service';
import { ZohoCRMService } from './services/zoho-crm.service';

// Support integrations
import { ZendeskService } from './services/zendesk.service';
import { IntercomService } from './services/intercom.service';
import { FreshdeskService } from './services/freshdesk.service';
import { HelpScoutService } from './services/helpscout.service';

// Database integrations
import { MongoDBAtlasService } from './services/mongodb-atlas.service';

// Cloud & DevOps integrations
import { AWSCloudWatchService } from './services/aws-cloudwatch.service';
import { DatadogService } from './services/datadog.service';
import { SentryService } from './services/sentry.service';
import { PagerDutyService } from './services/pagerduty.service';
import { NewRelicService } from './services/newrelic.service';
import { GcpMonitoringService } from './services/gcp-monitoring.service';
import { AzureMonitorService } from './services/azure-monitor.service';

// Data Warehouse integrations
import { SnowflakeService } from './services/snowflake.service';
import { BigQueryService } from './services/bigquery.service';
import { RedshiftService } from './services/redshift.service';

// IoT & Streaming integrations
import { KafkaService } from './services/kafka.service';
import { MqttService } from './services/mqtt.service';
import { AwsIotService } from './services/aws-iot.service';

// Payment integrations
import { StripeConnectService } from './services/stripe-connect.service';

import type { IntegrationProvider } from '@prisma/client';

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
  ) {}

  /**
   * Create a new integration
   */
  async createIntegration(config: IntegrationConfig) {
    const integration = await this.prisma.integration.create({
      data: {
        workspaceId: config.workspaceId,
        provider: config.provider,
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        expiresAt: config.expiresAt,
        settings: config.settings || {},
        status: 'ACTIVE',
      },
    });

    this.logger.log(`Integration created: ${integration.id} (${config.provider})`);

    // Trigger initial sync
    await this.triggerSync(integration.id, 'full');

    return integration;
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
        settings: true,
      },
    });
  }

  /**
   * Get a single integration
   */
  async getIntegration(integrationId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return integration;
  }

  /**
   * Update integration settings
   */
  async updateIntegration(integrationId: string, settings: Record<string, any>) {
    return this.prisma.integration.update({
      where: { id: integrationId },
      data: { settings },
    });
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
  async triggerSync(integrationId: string, syncType: 'full' | 'incremental' = 'incremental') {
    const integration = await this.getIntegration(integrationId);

    await this.jobsService.queueDataSync({
      workspaceId: integration.workspaceId,
      integrationId: integration.id,
      syncType,
    });

    this.logger.log(`Sync triggered for integration: ${integrationId}`);
    return { message: 'Sync queued successfully' };
  }

  /**
   * Fetch data from an integration
   */
  async fetchData(integrationId: string, dataType: string, params?: unknown): Promise<unknown> {
    const integration = await this.getIntegration(integrationId);
    const integrationConfig = {
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken ?? undefined,
      settings: (integration.settings as Record<string, any>) || {},
    };

    switch (integration.provider) {
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
  }

  /**
   * Refresh access token
   */
  async refreshToken(integrationId: string) {
    const integration = await this.getIntegration(integrationId);

    if (!integration.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Implement OAuth refresh flow based on provider
    // This is provider-specific and would require actual OAuth implementation
    this.logger.log(`Token refresh requested for integration: ${integrationId}`);

    return { message: 'Token refresh not yet implemented' };
  }

  /**
   * Test integration connection
   */
  async testConnection(integrationId: string) {
    const integration = await this.getIntegration(integrationId);
    const integrationConfig = {
      accessToken: integration.accessToken,
      refreshToken: integration.refreshToken ?? undefined,
      settings: (integration.settings as Record<string, any>) || {},
    };

    try {
      let result: boolean;

      switch (integration.provider) {
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

      return { connected: result };
    } catch (error) {
      this.logger.error(`Connection test failed for integration: ${integrationId}`, error);
      return {
        connected: false,
        error: (error as { message: string }).message,
      };
    }
  }
}
