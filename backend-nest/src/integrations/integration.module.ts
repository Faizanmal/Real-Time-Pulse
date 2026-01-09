import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JobsModule } from '../jobs/jobs.module';

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

@Module({
  imports: [HttpModule, PrismaModule, JobsModule],
  controllers: [IntegrationController],
  providers: [
    IntegrationService,
    // Existing
    AsanaService,
    GoogleAnalyticsService,
    HarvestService,
    JiraService,
    TrelloService,
    GitHubService,
    HubSpotService,
    SlackService,
    // E-commerce
    ShopifyService,
    WooCommerceService,
    BigCommerceService,
    // Marketing
    FacebookAdsService,
    GoogleAdsService,
    LinkedInAdsService,
    TikTokAdsService,
    // CRM
    SalesforceService,
    PipedriveService,
    ZohoCRMService,
    // Support
    ZendeskService,
    IntercomService,
    FreshdeskService,
    HelpScoutService,
    // Database
    MongoDBAtlasService,
    // Cloud & DevOps
    AWSCloudWatchService,
    DatadogService,
    SentryService,
    PagerDutyService,
    NewRelicService,
    GcpMonitoringService,
    AzureMonitorService,
    // Data Warehouse
    SnowflakeService,
    BigQueryService,
    RedshiftService,
    // IoT & Streaming
    KafkaService,
    MqttService,
    AwsIotService,
    // Payment
    StripeConnectService,
  ],
  exports: [
    IntegrationService,
    SlackService,
    // Export commonly used services
    ShopifyService,
    SalesforceService,
    StripeConnectService,
    KafkaService,
    MqttService,
    SnowflakeService,
    BigQueryService,
  ],
})
export class IntegrationModule {}
