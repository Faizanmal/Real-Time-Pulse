-- CreateIndex
CREATE INDEX "client_reports_status_scheduledFor_idx" ON "client_reports"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "data_source_health_workspaceId_status_idx" ON "data_source_health"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "data_validation_rules_enabled_workspaceId_idx" ON "data_validation_rules"("enabled", "workspaceId");

-- CreateIndex
CREATE INDEX "projects_workspaceId_status_idx" ON "projects"("workspaceId", "status");
