-- Add indexes for slow queries optimization

-- Rate Limit Configs - optimize the findMany query
CREATE INDEX IF NOT EXISTS idx_rate_limit_configs_integration_id ON rate_limit_configs(integration_id);

-- Data Validation Rules - optimize the findMany query with multiple filters
CREATE INDEX IF NOT EXISTS idx_data_validation_rules_workspace_enabled ON data_validation_rules(workspace_id, enabled);
CREATE INDEX IF NOT EXISTS idx_data_validation_rules_workspace_id ON data_validation_rules(workspace_id);

-- Scheduled Reports - optimize the findMany queries
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_workspace_active_nextrun ON scheduled_reports(workspace_id, is_active, next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active_nextrun ON scheduled_reports(is_active, next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_portal_id ON scheduled_reports(portal_id);

-- Client Reports - optimize the findMany queries
CREATE INDEX IF NOT EXISTS idx_client_reports_workspace_status_scheduled ON client_reports(workspace_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_client_reports_status_scheduled_for ON client_reports(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_client_reports_workspace_id ON client_reports(workspace_id);

-- Data Source Health - optimize the findMany queries
CREATE INDEX IF NOT EXISTS idx_data_source_health_workspace_status ON data_source_health(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_data_source_health_integration_id ON data_source_health(integration_id);
CREATE INDEX IF NOT EXISTS idx_data_source_health_status ON data_source_health(status);

-- Report Runs - optimize queries
CREATE INDEX IF NOT EXISTS idx_report_runs_report_id_status ON report_runs(report_id, status);
CREATE INDEX IF NOT EXISTS idx_report_runs_status_created_at ON report_runs(status, created_at);

-- Widgets - optimize validation queries
CREATE INDEX IF NOT EXISTS idx_widgets_integration_id_portal_id ON widgets(integration_id, portal_id);
CREATE INDEX IF NOT EXISTS idx_widgets_portal_id ON widgets(portal_id);

-- Data Validation Violations - optimize queries
CREATE INDEX IF NOT EXISTS idx_data_validation_violations_rule_id ON data_validation_violations(rule_id);
CREATE INDEX IF NOT EXISTS idx_data_validation_violations_workspace_created_at ON data_validation_violations(workspace_id, created_at);
