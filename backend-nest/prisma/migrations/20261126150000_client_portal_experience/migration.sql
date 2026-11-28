ALTER TABLE "portals"
  ADD COLUMN "clientStatus" VARCHAR(24),
  ADD COLUMN "clientStatusNote" VARCHAR(500),
  ADD COLUMN "latestDeliverable" VARCHAR(240),
  ADD COLUMN "pendingDecision" VARCHAR(240),
  ADD COLUMN "clientUpdateAt" TIMESTAMP(3);
