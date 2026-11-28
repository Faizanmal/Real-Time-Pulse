-- CreateEnum
CREATE TYPE "MetricValueType" AS ENUM ('NUMBER', 'BOOLEAN');

-- CreateEnum
CREATE TYPE "MetricAggregation" AS ENUM ('SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'LAST');

-- CreateEnum
CREATE TYPE "MetricQualityStatus" AS ENUM ('VALID', 'PARTIAL', 'MISSING', 'SCHEMA_CHANGED', 'LOW_SAMPLE', 'UNSUPPORTED');

-- CreateEnum
CREATE TYPE "MetricMilestoneStatus" AS ENUM ('UPCOMING', 'AT_RISK', 'ACHIEVED', 'MISSED');

-- CreateTable
CREATE TABLE "metric_definitions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "entity" TEXT NOT NULL,
    "grain" TEXT NOT NULL,
    "valueType" "MetricValueType" NOT NULL DEFAULT 'NUMBER',
    "unit" TEXT NOT NULL,
    "aggregation" "MetricAggregation" NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "samplePeriod" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "sensitivity" "DataSensitivity" NOT NULL DEFAULT 'INTERNAL',
    "transformKey" TEXT NOT NULL,
    "transformVersion" TEXT NOT NULL,
    "sourceFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_source_observations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceVersionHash" TEXT NOT NULL,
    "sourceSchemaHash" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3),
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourcePayload" JSONB NOT NULL,

    CONSTRAINT "metric_source_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_normalized_observations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceObservationId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "value" DECIMAL(20,6),
    "unit" TEXT NOT NULL,
    "quality" "MetricQualityStatus" NOT NULL DEFAULT 'VALID',
    "missingReason" TEXT,
    "transformVersion" TEXT NOT NULL,
    "normalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_normalized_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_mappings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "clientVisible" BOOLEAN NOT NULL DEFAULT false,
    "allowSourceDrilldown" BOOLEAN NOT NULL DEFAULT false,
    "targetValue" DECIMAL(20,6),
    "targetUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_milestones" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" DECIMAL(20,6) NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" "MetricMilestoneStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_snapshots" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(20,6),
    "unit" TEXT NOT NULL,
    "aggregation" "MetricAggregation" NOT NULL,
    "timeZone" TEXT NOT NULL,
    "quality" "MetricQualityStatus" NOT NULL,
    "confidence" DECIMAL(5,4),
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "sourceLatestAt" TIMESTAMP(3),
    "calculationVersion" TEXT NOT NULL,
    "transformVersion" TEXT NOT NULL,
    "limitations" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_snapshot_sources" (
    "snapshotId" TEXT NOT NULL,
    "sourceObservationId" TEXT NOT NULL,

    CONSTRAINT "metric_snapshot_sources_pkey" PRIMARY KEY ("snapshotId","sourceObservationId")
);

-- CreateTable
CREATE TABLE "metric_reprocess_runs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "mappingId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "transformVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "snapshotId" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "metric_reprocess_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metric_definitions_workspaceId_provider_active_idx" ON "metric_definitions"("workspaceId", "provider", "active");

-- CreateIndex
CREATE UNIQUE INDEX "metric_definitions_workspaceId_namespace_key_version_key" ON "metric_definitions"("workspaceId", "namespace", "key", "version");

-- CreateIndex
CREATE INDEX "metric_source_observations_workspaceId_integrationId_observ_idx" ON "metric_source_observations"("workspaceId", "integrationId", "observedAt");

-- CreateIndex
CREATE INDEX "metric_source_observations_integrationId_externalId_sourceU_idx" ON "metric_source_observations"("integrationId", "externalId", "sourceUpdatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "metric_source_observations_integrationId_externalId_sourceV_key" ON "metric_source_observations"("integrationId", "externalId", "sourceVersionHash");

-- CreateIndex
CREATE INDEX "metric_normalized_observations_workspaceId_metricDefinition_idx" ON "metric_normalized_observations"("workspaceId", "metricDefinitionId", "normalizedAt");

-- CreateIndex
CREATE UNIQUE INDEX "metric_normalized_observations_sourceObservationId_metricDe_key" ON "metric_normalized_observations"("sourceObservationId", "metricDefinitionId", "transformVersion");

-- CreateIndex
CREATE INDEX "metric_mappings_workspaceId_portalId_clientVisible_idx" ON "metric_mappings"("workspaceId", "portalId", "clientVisible");

-- CreateIndex
CREATE UNIQUE INDEX "metric_mappings_portalId_metricDefinitionId_key" ON "metric_mappings"("portalId", "metricDefinitionId");

-- CreateIndex
CREATE INDEX "metric_milestones_workspaceId_mappingId_targetDate_idx" ON "metric_milestones"("workspaceId", "mappingId", "targetDate");

-- CreateIndex
CREATE INDEX "metric_snapshots_workspaceId_mappingId_periodEnd_idx" ON "metric_snapshots"("workspaceId", "mappingId", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "metric_snapshots_mappingId_periodStart_periodEnd_calculatio_key" ON "metric_snapshots"("mappingId", "periodStart", "periodEnd", "calculationVersion");

-- CreateIndex
CREATE INDEX "metric_snapshot_sources_sourceObservationId_idx" ON "metric_snapshot_sources"("sourceObservationId");

-- CreateIndex
CREATE INDEX "metric_reprocess_runs_workspaceId_mappingId_startedAt_idx" ON "metric_reprocess_runs"("workspaceId", "mappingId", "startedAt");

-- AddForeignKey
ALTER TABLE "metric_definitions" ADD CONSTRAINT "metric_definitions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_source_observations" ADD CONSTRAINT "metric_source_observations_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_normalized_observations" ADD CONSTRAINT "metric_normalized_observations_sourceObservationId_fkey" FOREIGN KEY ("sourceObservationId") REFERENCES "metric_source_observations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_normalized_observations" ADD CONSTRAINT "metric_normalized_observations_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "metric_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_mappings" ADD CONSTRAINT "metric_mappings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_mappings" ADD CONSTRAINT "metric_mappings_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "portals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_mappings" ADD CONSTRAINT "metric_mappings_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_mappings" ADD CONSTRAINT "metric_mappings_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "metric_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_milestones" ADD CONSTRAINT "metric_milestones_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "metric_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "metric_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_snapshot_sources" ADD CONSTRAINT "metric_snapshot_sources_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "metric_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_snapshot_sources" ADD CONSTRAINT "metric_snapshot_sources_sourceObservationId_fkey" FOREIGN KEY ("sourceObservationId") REFERENCES "metric_source_observations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_reprocess_runs" ADD CONSTRAINT "metric_reprocess_runs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_reprocess_runs" ADD CONSTRAINT "metric_reprocess_runs_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "metric_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
