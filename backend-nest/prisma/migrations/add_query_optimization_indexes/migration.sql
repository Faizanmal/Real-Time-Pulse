-- Add indexes for slow queries optimization

-- Rate Limit Configs - optimize the findMany query
CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_integration_id ON rate_limit_configs("integrationId");

-- Data Validation Rules - optimize the findMany query with multiple filters
CREATE INDEX IF NOT EXISTS idx_data_validation_rules_workspace_enabled ON data_validation_rules("workspaceId", enabled);
CREATE INDEX IF NOT EXISTS idx_data_validation_rules_workspace_id ON data_validation_rules("workspaceId");

-- Scheduled Reports - optimize the findMany queries
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_workspace_active_nextrun ON scheduled_reports("workspaceId", "isActive", "nextRunAt");
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active_nextrun ON scheduled_reports("isActive", "nextRunAt");
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_portal_id ON scheduled_reports("portalId");

-- Client Reports - optimize the findMany queries
CREATE INDEX IF NOT EXISTS idx_client_reports_workspace_status_scheduled ON client_reports("workspaceId", status, "scheduledFor");
CREATE INDEX IF NOT EXISTS idx_client_reports_status_scheduled_for ON client_reports(status, "scheduledFor");
CREATE INDEX IF NOT EXISTS idx_client_reports_workspace_id ON client_reports("workspaceId");

-- Data Source Health - optimize the findMany queries
CREATE INDEX IF NOT EXISTS idx_data_source_health_workspace_status ON data_source_health("workspaceId", status);
CREATE INDEX IF NOT EXISTS idx_data_source_health_integration_id ON data_source_health("integrationId");
CREATE INDEX IF NOT EXISTS idx_data_source_health_status ON data_source_health(status);

-- Report Runs - optimize queries
CREATE INDEX IF NOT EXISTS idx_report_runs_report_id_status ON report_runs("reportId", status);
CREATE INDEX IF NOT EXISTS idx_report_runs_status_created_at ON report_runs(status, "createdAt");

-- Widgets - optimize validation queries
CREATE INDEX IF NOT EXISTS idx_widgets_integration_id_portal_id ON widgets("integrationId", "portalId");
CREATE INDEX IF NOT EXISTS idx_widgets_portal_id ON widgets("portalId");

-- Data Validation Violations - optimize queries
CREATE INDEX IF NOT EXISTS idx_data_validation_violations_rule_id ON data_validation_violations("ruleId");
