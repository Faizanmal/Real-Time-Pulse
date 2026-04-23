import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { JobsModule } from '../jobs/jobs.module';
import { PrismaModule } from '../prisma/prisma.module';

import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
// Existing integrations
import { AsanaService } from './services/asana.service';
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
