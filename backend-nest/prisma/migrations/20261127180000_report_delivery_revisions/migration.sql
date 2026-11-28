ALTER TABLE "client_reports" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "client_reports" ADD COLUMN "portalId" TEXT;
CREATE INDEX "client_reports_portalId_idx" ON "client_reports"("portalId");
ALTER TABLE "client_reports" ADD CONSTRAINT "client_reports_portalId_fkey" FOREIGN KEY ("portalId") REFERENCES "portals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "ClientReportDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');

CREATE TABLE "client_report_revisions" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "snapshotDigest" VARCHAR(64) NOT NULL,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notificationConsent" BOOLEAN NOT NULL DEFAULT false,
  "consentNote" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_report_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_report_deliveries" (
  "id" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "status" "ClientReportDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" VARCHAR(240),
  "sentAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_report_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_report_revisions_reportId_version_key" ON "client_report_revisions"("reportId", "version");
CREATE INDEX "client_report_revisions_reportId_approvedAt_idx" ON "client_report_revisions"("reportId", "approvedAt");
CREATE UNIQUE INDEX "client_report_deliveries_revisionId_key" ON "client_report_deliveries"("revisionId");
CREATE INDEX "client_report_deliveries_reportId_createdAt_idx" ON "client_report_deliveries"("reportId", "createdAt");
CREATE INDEX "client_report_deliveries_status_updatedAt_idx" ON "client_report_deliveries"("status", "updatedAt");

ALTER TABLE "client_report_revisions" ADD CONSTRAINT "client_report_revisions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "client_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_report_deliveries" ADD CONSTRAINT "client_report_deliveries_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "client_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_report_deliveries" ADD CONSTRAINT "client_report_deliveries_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "client_report_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
