/*
  Warnings:

  - A unique constraint covering the columns `[stripeCustomerId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'API_KEY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'API_KEY_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'API_KEY_REGENERATED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationProvider" ADD VALUE 'TEAMS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'SHOPIFY';
ALTER TYPE "IntegrationProvider" ADD VALUE 'WOOCOMMERCE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'BIGCOMMERCE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'STRIPE_CONNECT';
ALTER TYPE "IntegrationProvider" ADD VALUE 'SQUARE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PAYPAL';
ALTER TYPE "IntegrationProvider" ADD VALUE 'FACEBOOK_ADS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'GOOGLE_ADS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'LINKEDIN_ADS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'TIKTOK_ADS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'TWITTER_ADS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PINTEREST_ADS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'MAILCHIMP';
ALTER TYPE "IntegrationProvider" ADD VALUE 'SENDGRID';
ALTER TYPE "IntegrationProvider" ADD VALUE 'KLAVIYO';
ALTER TYPE "IntegrationProvider" ADD VALUE 'SALESFORCE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PIPEDRIVE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'ZOHO_CRM';
ALTER TYPE "IntegrationProvider" ADD VALUE 'FRESHSALES';
ALTER TYPE "IntegrationProvider" ADD VALUE 'COPPER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'CLOSE_CRM';
ALTER TYPE "IntegrationProvider" ADD VALUE 'ZENDESK';
ALTER TYPE "IntegrationProvider" ADD VALUE 'INTERCOM';
ALTER TYPE "IntegrationProvider" ADD VALUE 'FRESHDESK';
ALTER TYPE "IntegrationProvider" ADD VALUE 'HELPSCOUT';
ALTER TYPE "IntegrationProvider" ADD VALUE 'DRIFT';
ALTER TYPE "IntegrationProvider" ADD VALUE 'CRISP';
ALTER TYPE "IntegrationProvider" ADD VALUE 'FRONT';
ALTER TYPE "IntegrationProvider" ADD VALUE 'MONGODB_ATLAS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'POSTGRESQL_DIRECT';
ALTER TYPE "IntegrationProvider" ADD VALUE 'MYSQL_DIRECT';
ALTER TYPE "IntegrationProvider" ADD VALUE 'REDIS_CLOUD';
ALTER TYPE "IntegrationProvider" ADD VALUE 'ELASTICSEARCH';
ALTER TYPE "IntegrationProvider" ADD VALUE 'DYNAMODB';
ALTER TYPE "IntegrationProvider" ADD VALUE 'FIREBASE_REALTIME';
ALTER TYPE "IntegrationProvider" ADD VALUE 'SUPABASE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'AWS_CLOUDWATCH';
ALTER TYPE "IntegrationProvider" ADD VALUE 'GCP_MONITORING';
ALTER TYPE "IntegrationProvider" ADD VALUE 'AZURE_MONITOR';
ALTER TYPE "IntegrationProvider" ADD VALUE 'AWS_S3';
ALTER TYPE "IntegrationProvider" ADD VALUE 'AZURE_BLOB';
ALTER TYPE "IntegrationProvider" ADD VALUE 'GCS_STORAGE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'DATADOG';
ALTER TYPE "IntegrationProvider" ADD VALUE 'NEW_RELIC';
ALTER TYPE "IntegrationProvider" ADD VALUE 'SENTRY';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PAGERDUTY';
ALTER TYPE "IntegrationProvider" ADD VALUE 'SPLUNK';
ALTER TYPE "IntegrationProvider" ADD VALUE 'GRAFANA';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PROMETHEUS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'OPSGENIE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'SNOWFLAKE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'BIGQUERY';
ALTER TYPE "IntegrationProvider" ADD VALUE 'REDSHIFT';
ALTER TYPE "IntegrationProvider" ADD VALUE 'DATABRICKS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'DATALAKE_S3';
ALTER TYPE "IntegrationProvider" ADD VALUE 'AZURE_SYNAPSE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'AWS_IOT';
ALTER TYPE "IntegrationProvider" ADD VALUE 'AZURE_IOT';
ALTER TYPE "IntegrationProvider" ADD VALUE 'KAFKA';
ALTER TYPE "IntegrationProvider" ADD VALUE 'MQTT_BROKER';
ALTER TYPE "IntegrationProvider" ADD VALUE 'NATS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'AIRTABLE';
ALTER TYPE "IntegrationProvider" ADD VALUE 'CODA';
ALTER TYPE "IntegrationProvider" ADD VALUE 'BASECAMP';
ALTER TYPE "IntegrationProvider" ADD VALUE 'LINEAR';
ALTER TYPE "IntegrationProvider" ADD VALUE 'FIGMA';
ALTER TYPE "IntegrationProvider" ADD VALUE 'MIRO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ACHIEVEMENT';
ALTER TYPE "NotificationType" ADD VALUE 'LEVEL_UP';
ALTER TYPE "NotificationType" ADD VALUE 'USAGE_ALERT';

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT;

-- AlterTable
ALTER TABLE "gdpr_data_requests" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripeCustomerId" TEXT;

-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN     "joinedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portalId" TEXT,
    "query" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "queryType" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "processingTime" INTEGER,
    "tokenCount" INTEGER,
    "modelUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_devices" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "location" JSONB,
    "tags" TEXT[],
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iot_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_metrics" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "iot_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_alerts" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,

    CONSTRAINT "iot_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_thresholds" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iot_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iot_command_logs" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "response" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "iot_command_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edge_nodes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "processingRules" JSONB NOT NULL DEFAULT '[]',
    "dataFilters" JSONB NOT NULL DEFAULT '[]',
    "aggregationConfig" JSONB NOT NULL DEFAULT '{}',
    "cpuUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memoryUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "storageUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "devicesConnected" INTEGER NOT NULL DEFAULT 0,
    "messagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edge_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_pipelines" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "schedule" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etl_pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_executions" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "rowsProcessed" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[],
    "nodeStats" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "etl_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_configs" (
    "integrationId" TEXT NOT NULL,
    "maxRequests" INTEGER NOT NULL,
    "windowMs" INTEGER NOT NULL,
    "burstLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_configs_pkey" PRIMARY KEY ("integrationId")
);

-- CreateTable
CREATE TABLE "rate_limit_metrics" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remainingQuota" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "industry" TEXT,
    "tags" TEXT[],
    "data" JSONB NOT NULL,
    "previewImage" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_installations" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portalId" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_purchases" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_earnings" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "templateId" TEXT,
    "purchaseId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "type" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "author_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_reviews" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "white_label_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "accentColor" TEXT,
    "branding" JSONB,
    "customDomain" TEXT,
    "domainVerified" BOOLEAN NOT NULL DEFAULT false,
    "sslCertificate" TEXT,
    "emailFromName" TEXT,
    "emailFromEmail" TEXT,
    "email" JSONB,
    "portalTitle" TEXT,
    "portalSubtitle" TEXT,
    "enabledFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "white_label_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_domain_requests" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "sslStatus" TEXT,
    "dnsRecords" JSONB,

    CONSTRAINT "custom_domain_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "format" TEXT NOT NULL DEFAULT 'json',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "downloadUrl" TEXT,
    "includePersonalData" BOOLEAN NOT NULL DEFAULT true,
    "includeAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "dateRange" JSONB,

    CONSTRAINT "data_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "points_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL DEFAULT 1,
    "pointsReward" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_participants" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_archives" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "rankings" JSONB NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_archives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "position" JSONB,
    "metadata" JSONB,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "organizationId" TEXT,
    "quantity" DOUBLE PRECISION,
    "metricId" TEXT,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_alerts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "thresholdType" TEXT,
    "lastTriggeredAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "stripeCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_totals" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "organizationId" TEXT,
    "metricId" TEXT,
    "updatedAt" TIMESTAMP(3),
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_totals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "operation" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reactions" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invites" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_workspaceId_idx" ON "ai_conversations"("workspaceId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "ai_conversations"("userId");

-- CreateIndex
CREATE INDEX "ai_conversations_portalId_idx" ON "ai_conversations"("portalId");

-- CreateIndex
CREATE INDEX "ai_conversations_createdAt_idx" ON "ai_conversations"("createdAt");

-- CreateIndex
CREATE INDEX "iot_devices_workspaceId_idx" ON "iot_devices"("workspaceId");

-- CreateIndex
CREATE INDEX "iot_devices_status_idx" ON "iot_devices"("status");

-- CreateIndex
CREATE INDEX "iot_devices_deviceType_idx" ON "iot_devices"("deviceType");

-- CreateIndex
CREATE INDEX "iot_metrics_deviceId_idx" ON "iot_metrics"("deviceId");

-- CreateIndex
CREATE INDEX "iot_metrics_timestamp_idx" ON "iot_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "iot_alerts_deviceId_idx" ON "iot_alerts"("deviceId");

-- CreateIndex
CREATE INDEX "iot_alerts_severity_idx" ON "iot_alerts"("severity");

-- CreateIndex
CREATE INDEX "iot_alerts_acknowledged_idx" ON "iot_alerts"("acknowledged");

-- CreateIndex
CREATE INDEX "iot_thresholds_deviceId_idx" ON "iot_thresholds"("deviceId");

-- CreateIndex
CREATE INDEX "iot_command_logs_deviceId_idx" ON "iot_command_logs"("deviceId");

-- CreateIndex
CREATE INDEX "iot_command_logs_sentAt_idx" ON "iot_command_logs"("sentAt");

-- CreateIndex
CREATE INDEX "edge_nodes_workspaceId_idx" ON "edge_nodes"("workspaceId");

-- CreateIndex
CREATE INDEX "edge_nodes_status_idx" ON "edge_nodes"("status");

-- CreateIndex
CREATE INDEX "etl_pipelines_workspaceId_idx" ON "etl_pipelines"("workspaceId");

-- CreateIndex
CREATE INDEX "etl_pipelines_status_idx" ON "etl_pipelines"("status");

-- CreateIndex
CREATE INDEX "etl_executions_pipelineId_idx" ON "etl_executions"("pipelineId");

-- CreateIndex
CREATE INDEX "etl_executions_startedAt_idx" ON "etl_executions"("startedAt");

-- CreateIndex
CREATE INDEX "templates_authorId_idx" ON "templates"("authorId");

-- CreateIndex
CREATE INDEX "templates_status_idx" ON "templates"("status");

-- CreateIndex
CREATE INDEX "templates_isPublic_idx" ON "templates"("isPublic");

-- CreateIndex
CREATE INDEX "template_installations_userId_idx" ON "template_installations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "template_installations_templateId_userId_key" ON "template_installations"("templateId", "userId");

-- CreateIndex
CREATE INDEX "template_purchases_buyerId_idx" ON "template_purchases"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "template_purchases_templateId_buyerId_key" ON "template_purchases"("templateId", "buyerId");

-- CreateIndex
CREATE INDEX "author_earnings_authorId_idx" ON "author_earnings"("authorId");

-- CreateIndex
CREATE INDEX "template_reviews_templateId_idx" ON "template_reviews"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "template_reviews_templateId_reviewerId_key" ON "template_reviews"("templateId", "reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_configs_workspaceId_key" ON "white_label_configs"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "white_label_configs_customDomain_key" ON "white_label_configs"("customDomain");

-- CreateIndex
CREATE INDEX "custom_domain_requests_workspaceId_idx" ON "custom_domain_requests"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_domain_requests_workspaceId_domain_key" ON "custom_domain_requests"("workspaceId", "domain");

-- CreateIndex
CREATE INDEX "data_export_requests_userId_idx" ON "data_export_requests"("userId");

-- CreateIndex
CREATE INDEX "data_export_requests_status_idx" ON "data_export_requests"("status");

-- CreateIndex
CREATE INDEX "points_transactions_userId_idx" ON "points_transactions"("userId");

-- CreateIndex
CREATE INDEX "points_transactions_type_idx" ON "points_transactions"("type");

-- CreateIndex
CREATE INDEX "challenges_workspaceId_idx" ON "challenges"("workspaceId");

-- CreateIndex
CREATE INDEX "challenges_type_idx" ON "challenges"("type");

-- CreateIndex
CREATE INDEX "challenges_isActive_idx" ON "challenges"("isActive");

-- CreateIndex
CREATE INDEX "challenge_participants_userId_idx" ON "challenge_participants"("userId");

-- CreateIndex
CREATE INDEX "challenge_participants_completed_idx" ON "challenge_participants"("completed");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_participants_challengeId_userId_key" ON "challenge_participants"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "leaderboard_archives_workspaceId_idx" ON "leaderboard_archives"("workspaceId");

-- CreateIndex
CREATE INDEX "leaderboard_archives_period_idx" ON "leaderboard_archives"("period");

-- CreateIndex
CREATE INDEX "leaderboard_archives_startDate_idx" ON "leaderboard_archives"("startDate");

-- CreateIndex
CREATE INDEX "annotations_userId_idx" ON "annotations"("userId");

-- CreateIndex
CREATE INDEX "annotations_entityType_entityId_idx" ON "annotations"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "usage_records_workspaceId_idx" ON "usage_records"("workspaceId");

-- CreateIndex
CREATE INDEX "usage_records_metric_idx" ON "usage_records"("metric");

-- CreateIndex
CREATE INDEX "usage_records_recordedAt_idx" ON "usage_records"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "invoices_workspaceId_idx" ON "invoices"("workspaceId");

-- CreateIndex
CREATE INDEX "invoices_stripeInvoiceId_idx" ON "invoices"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "usage_alerts_workspaceId_idx" ON "usage_alerts"("workspaceId");

-- CreateIndex
CREATE INDEX "usage_alerts_metric_idx" ON "usage_alerts"("metric");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "usage_totals_workspaceId_idx" ON "usage_totals"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "usage_totals_workspaceId_metric_period_key" ON "usage_totals"("workspaceId", "metric", "period");

-- CreateIndex
CREATE INDEX "operation_logs_workspaceId_idx" ON "operation_logs"("workspaceId");

-- CreateIndex
CREATE INDEX "operation_logs_userId_idx" ON "operation_logs"("userId");

-- CreateIndex
CREATE INDEX "operation_logs_entityType_entityId_idx" ON "operation_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "comment_reactions_userId_idx" ON "comment_reactions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reactions_commentId_userId_key" ON "comment_reactions"("commentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invites_token_key" ON "workspace_invites"("token");

-- CreateIndex
CREATE INDEX "workspace_invites_workspaceId_idx" ON "workspace_invites"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_invites_email_idx" ON "workspace_invites"("email");

-- CreateIndex
CREATE INDEX "workspace_invites_token_idx" ON "workspace_invites"("token");

-- CreateIndex
CREATE INDEX "subscriptions_stripeSubscriptionId_idx" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "users_stripeCustomerId_idx" ON "users"("stripeCustomerId");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "portals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_devices" ADD CONSTRAINT "iot_devices_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_metrics" ADD CONSTRAINT "iot_metrics_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_alerts" ADD CONSTRAINT "iot_alerts_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_thresholds" ADD CONSTRAINT "iot_thresholds_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iot_command_logs" ADD CONSTRAINT "iot_command_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "iot_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edge_nodes" ADD CONSTRAINT "edge_nodes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etl_pipelines" ADD CONSTRAINT "etl_pipelines_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "etl_executions" ADD CONSTRAINT "etl_executions_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "etl_pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_configs" ADD CONSTRAINT "rate_limit_configs_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_metrics" ADD CONSTRAINT "rate_limit_metrics_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_installations" ADD CONSTRAINT "template_installations_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_installations" ADD CONSTRAINT "template_installations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_installations" ADD CONSTRAINT "template_installations_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "portals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_purchases" ADD CONSTRAINT "template_purchases_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_purchases" ADD CONSTRAINT "template_purchases_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_earnings" ADD CONSTRAINT "author_earnings_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_earnings" ADD CONSTRAINT "author_earnings_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_reviews" ADD CONSTRAINT "template_reviews_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_reviews" ADD CONSTRAINT "template_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "white_label_configs" ADD CONSTRAINT "white_label_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_domain_requests" ADD CONSTRAINT "custom_domain_requests_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_requests" ADD CONSTRAINT "data_export_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "points_transactions" ADD CONSTRAINT "points_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_archives" ADD CONSTRAINT "leaderboard_archives_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_alerts" ADD CONSTRAINT "usage_alerts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_totals" ADD CONSTRAINT "usage_totals_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
