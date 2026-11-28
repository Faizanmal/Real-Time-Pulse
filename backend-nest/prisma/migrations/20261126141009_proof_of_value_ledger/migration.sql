-- CreateEnum
CREATE TYPE "ValueLedgerStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "value_ledger_entries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "portalId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "formulaKey" VARCHAR(80) NOT NULL,
    "formulaVersion" VARCHAR(40) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "timeZone" VARCHAR(80) NOT NULL,
    "resultValue" DECIMAL(20,6) NOT NULL,
    "unit" VARCHAR(24) NOT NULL,
    "assumptions" JSONB NOT NULL,
    "sensitivity" JSONB NOT NULL,
    "status" "ValueLedgerStatus" NOT NULL DEFAULT 'DRAFT',
    "clientVisible" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdByLabel" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedByLabel" VARCHAR(120),
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "value_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "value_ledger_entries_workspaceId_portalId_status_revision_idx" ON "value_ledger_entries"("workspaceId", "portalId", "status", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "value_ledger_entries_portalId_revision_key" ON "value_ledger_entries"("portalId", "revision");

-- AddForeignKey
ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "value_ledger_entries" ADD CONSTRAINT "value_ledger_entries_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "portals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
