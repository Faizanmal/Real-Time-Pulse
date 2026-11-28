-- Nullable tombstone preserves every existing portal and allows safe backfill-free rollout.
ALTER TABLE "portals" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "portals_workspaceId_deletedAt_idx" ON "portals"("workspaceId", "deletedAt");