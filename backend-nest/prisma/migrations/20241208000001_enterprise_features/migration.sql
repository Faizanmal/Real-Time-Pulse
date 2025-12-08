-- Migration for new enterprise features
-- Data Backup & Recovery Tables

CREATE TABLE IF NOT EXISTS backups (
  id VARCHAR(255) PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'full' or 'incremental'
  size BIGINT NOT NULL,
  checksum VARCHAR(255) NOT NULL,
  encrypted_data BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backups_timestamp ON backups(timestamp);

-- Custom Integration Builder Tables

CREATE TABLE IF NOT EXISTS custom_integrations (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  auth_type VARCHAR(50) NOT NULL, -- 'oauth2', 'api-key', 'basic', 'openapi'
  auth_config JSONB NOT NULL,
  api_spec JSONB,
  endpoints JSONB NOT NULL,
  transformations JSONB DEFAULT '[]',
  custom_widgets JSONB DEFAULT '[]',
  workspace_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_custom_integrations_workspace ON custom_integrations(workspace_id);

CREATE TABLE IF NOT EXISTS integration_tokens (
  integration_id VARCHAR(255) PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (integration_id) REFERENCES custom_integrations(id) ON DELETE CASCADE
);

-- Rate Limit Tables

CREATE TABLE IF NOT EXISTS rate_limit_configs (
  integration_id VARCHAR(255) PRIMARY KEY,
  max_requests INTEGER NOT NULL,
  window_ms INTEGER NOT NULL,
  burst_limit INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limit_metrics (
  id SERIAL PRIMARY KEY,
  integration_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  remaining_quota INTEGER NOT NULL,
  reset_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rate_limit_metrics_integration ON rate_limit_metrics(integration_id);
CREATE INDEX idx_rate_limit_metrics_timestamp ON rate_limit_metrics(timestamp);

-- Voice Control Tables

CREATE TABLE IF NOT EXISTS voice_command_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  command TEXT NOT NULL,
  intent VARCHAR(100) NOT NULL,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_voice_commands_user ON voice_command_history(user_id);
CREATE INDEX idx_voice_commands_created ON voice_command_history(created_at);

-- Add comments for documentation

COMMENT ON TABLE backups IS 'Stores encrypted backup data for point-in-time recovery';
COMMENT ON TABLE custom_integrations IS 'User-created custom API integrations with OAuth2 and OpenAPI support';
COMMENT ON TABLE integration_tokens IS 'Secure storage for OAuth2 access and refresh tokens';
COMMENT ON TABLE rate_limit_configs IS 'Rate limiting configuration per integration';
COMMENT ON TABLE rate_limit_metrics IS 'Historical rate limit usage metrics for monitoring';
COMMENT ON TABLE voice_command_history IS 'History of voice commands for analytics and improvements';
