ALTER TABLE "integrations" ADD COLUMN "syncCursor" JSONB;

CREATE TABLE "integration_sync_records" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_sync_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_sync_runs" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_sync_records_integrationId_externalId_key"
ON "integration_sync_records"("integrationId", "externalId");
CREATE INDEX "integration_sync_records_integrationId_sourceUpdatedAt_idx"
ON "integration_sync_records"("integrationId", "sourceUpdatedAt");
CREATE UNIQUE INDEX "integration_sync_runs_integrationId_idempotencyKey_key"
ON "integration_sync_runs"("integrationId", "idempotencyKey");
CREATE INDEX "integration_sync_runs_integrationId_startedAt_idx"
ON "integration_sync_runs"("integrationId", "startedAt");

ALTER TABLE "integration_sync_records" ADD CONSTRAINT "integration_sync_records_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_sync_runs" ADD CONSTRAINT "integration_sync_runs_integrationId_fkey"
FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
