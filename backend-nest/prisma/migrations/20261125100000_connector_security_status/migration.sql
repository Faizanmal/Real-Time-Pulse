CREATE TYPE "ConnectorConnectionState" AS ENUM ('CONNECTED', 'DEGRADED', 'NEEDS_RECONNECT', 'DISCONNECTED');

ALTER TABLE "integrations"
  ADD COLUMN "connectionState" "ConnectorConnectionState" NOT NULL DEFAULT 'CONNECTED',
  ADD COLUMN "lastValidDataAt" TIMESTAMP(3);

UPDATE "integrations"
SET "connectionState" = CASE
  WHEN "status" = 'INACTIVE' THEN 'DISCONNECTED'::"ConnectorConnectionState"
  WHEN "status" = 'EXPIRED' THEN 'NEEDS_RECONNECT'::"ConnectorConnectionState"
  WHEN "status" = 'ERROR' THEN 'DEGRADED'::"ConnectorConnectionState"
  ELSE 'CONNECTED'::"ConnectorConnectionState"
END,
"lastValidDataAt" = "lastSyncedAt";

CREATE INDEX "integrations_connectionState_idx" ON "integrations"("connectionState");
