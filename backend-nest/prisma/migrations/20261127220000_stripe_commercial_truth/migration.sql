ALTER TABLE "subscriptions"
ADD COLUMN "stripeStateUpdatedAt" TIMESTAMP(3);

CREATE TABLE "ai_usage_meters" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_meters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_usage_meters_workspaceId_period_key"
ON "ai_usage_meters"("workspaceId", "period");

CREATE INDEX "ai_usage_meters_period_idx"
ON "ai_usage_meters"("period");

ALTER TABLE "ai_usage_meters"
ADD CONSTRAINT "ai_usage_meters_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
