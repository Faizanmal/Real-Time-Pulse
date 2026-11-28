CREATE TYPE "AlertOccurrenceStatus" AS ENUM ('TRIGGERED', 'RESOLVED', 'SUPPRESSED');
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

ALTER TABLE "alerts"
  ADD COLUMN "lastEvaluatedAt" TIMESTAMP(3),
  ADD COLUMN "isFiring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "suppressionWindowSeconds" INTEGER NOT NULL DEFAULT 900,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "alerts_workspaceId_deletedAt_idx" ON "alerts"("workspaceId", "deletedAt");

ALTER TABLE "alert_history"
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "freshnessAt" TIMESTAMP(3),
  ADD COLUMN "reason" TEXT,
  ADD COLUMN "nextAction" TEXT,
  ADD COLUMN "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "status" "AlertOccurrenceStatus" NOT NULL DEFAULT 'TRIGGERED',
  ADD COLUMN "suppressedCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "alert_history_alertId_eventId_key" ON "alert_history"("alertId", "eventId");
CREATE INDEX "alert_history_status_triggeredAt_idx" ON "alert_history"("status", "triggeredAt");

CREATE TABLE "alert_deliveries" (
  "id" TEXT NOT NULL,
  "historyId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" "AlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alert_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "alert_deliveries_historyId_fkey" FOREIGN KEY ("historyId") REFERENCES "alert_history"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "alert_deliveries_historyId_channel_key" ON "alert_deliveries"("historyId", "channel");
CREATE INDEX "alert_deliveries_status_nextAttemptAt_idx" ON "alert_deliveries"("status", "nextAttemptAt");
