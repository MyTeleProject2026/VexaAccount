-- VexaAccount centralized SSO core (TiDB/MySQL)
CREATE TABLE IF NOT EXISTS sso_clients (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id VARCHAR(128) NOT NULL UNIQUE,
  client_secret_hash VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  redirect_uris JSON NOT NULL,
  allowed_scopes JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sso_authorization_codes (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code_hash VARCHAR(128) NOT NULL UNIQUE,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  code_challenge VARCHAR(256) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sso_code_lookup (client_id,user_id,expires_at)
);
CREATE TABLE IF NOT EXISTS sso_consents (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  scopes TEXT NOT NULL,
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  UNIQUE KEY uq_sso_consent (client_id,user_id)
);
CREATE TABLE IF NOT EXISTS sso_refresh_tokens (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_hash VARCHAR(128) NOT NULL UNIQUE,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  scope TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sso_refresh_lookup (client_id,user_id,expires_at)
);
CREATE TABLE IF NOT EXISTS sso_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_hash VARCHAR(128) NOT NULL UNIQUE,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  scope TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  INDEX idx_sso_session_user (user_id,client_id,expires_at)
);
CREATE TABLE IF NOT EXISTS sso_security_events (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  client_id VARCHAR(128) NULL,
  event_type VARCHAR(100) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sso_security_user (user_id,created_at)
);

-- Super Owner authorization and immutable administration audit trail
CREATE TABLE IF NOT EXISTS vexa_super_admins (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL UNIQUE,
  role VARCHAR(64) NOT NULL DEFAULT 'super_owner',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS vexa_admin_audit_log (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_user_id BIGINT NOT NULL,
  action VARCHAR(128) NOT NULL,
  target_type VARCHAR(64) NULL,
  target_id VARCHAR(255) NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vexa_admin_audit (admin_user_id,created_at),
  INDEX idx_vexa_admin_action (action,created_at)
);
