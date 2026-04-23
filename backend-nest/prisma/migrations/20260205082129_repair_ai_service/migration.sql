-- CreateIndex
CREATE INDEX "scheduled_reports_isActive_nextRunAt_idx" ON "scheduled_reports"("isActive", "nextRunAt");
