CREATE TYPE "ProductTelemetryKind" AS ENUM (
  'FEATURE_ADOPTION',
  'FEATURE_SUCCESS',
  'FEATURE_GUARDRAIL',
  'COST',
  'EXPERIMENT'
);

CREATE TYPE "ProductCostCategory" AS ENUM (
  'PROVIDER_CALL',
  'JOB_RUNTIME',
  'EMAIL',
  'STORAGE',
  'AI_TOKENS'
);

CREATE TYPE "ProductCostBasis" AS ENUM ('OBSERVED', 'ESTIMATED');

CREATE TABLE "product_telemetry_events" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "eventId" VARCHAR(128) NOT NULL,
  "featureKey" VARCHAR(80) NOT NULL,
  "kind" "ProductTelemetryKind" NOT NULL,
  "eventName" VARCHAR(80) NOT NULL,
  "value" DOUBLE PRECISION,
  "unit" VARCHAR(32),
  "costCategory" "ProductCostCategory",
  "costBasis" "ProductCostBasis",
  "costMicros" BIGINT,
  "currency" CHAR(3),
  "experimentKey" VARCHAR(80),
  "variantKey" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_telemetry_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_telemetry_events_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_telemetry_events_workspaceId_eventId_key" UNIQUE ("workspaceId", "eventId")
);

CREATE INDEX "product_telemetry_events_workspaceId_createdAt_idx"
  ON "product_telemetry_events"("workspaceId", "createdAt");
CREATE INDEX "product_telemetry_events_workspaceId_featureKey_kind_createdAt_idx"
  ON "product_telemetry_events"("workspaceId", "featureKey", "kind", "createdAt");
CREATE INDEX "product_telemetry_events_workspaceId_experimentKey_variantKey_eventName_createdAt_idx"
  ON "product_telemetry_events"("workspaceId", "experimentKey", "variantKey", "eventName", "createdAt");
