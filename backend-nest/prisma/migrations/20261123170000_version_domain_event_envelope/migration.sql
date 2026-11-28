-- Additive envelope version. Existing event rows are backfilled to v1 by the default.
ALTER TABLE "event_store_events"
ADD COLUMN IF NOT EXISTS "envelopeVersion" INTEGER NOT NULL DEFAULT 1;
