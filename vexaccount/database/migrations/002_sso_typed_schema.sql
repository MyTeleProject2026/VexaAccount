-- VexaAccount SSO additive TiDB/MySQL schema.
-- Safe migration: creates only new SSO tables; does not alter existing auth tables.

CREATE TABLE IF NOT EXISTS sso_clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(128) NOT NULL,
  client_secret_hash VARCHAR(255) NULL,
  name VARCHAR(255) NOT NULL,
  redirect_uris JSON NOT NULL,
  allowed_scopes JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_clients_client_id (client_id),
  KEY idx_sso_clients_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sso_authorization_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code_hash CHAR(43) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope VARCHAR(1000) NOT NULL,
  code_challenge VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_auth_code_hash (code_hash),
  KEY idx_sso_auth_codes_lookup (client_id, expires_at, consumed_at),
  KEY idx_sso_auth_codes_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sso_refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(43) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT NOT NULL,
  scope VARCHAR(1000) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_refresh_token_hash (token_hash),
  KEY idx_sso_refresh_lookup (client_id, user_id, expires_at, revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sso_user_consents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  scopes VARCHAR(1000) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_user_client (user_id, client_id),
  KEY idx_sso_consents_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sso_security_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT NULL,
  client_id VARCHAR(128) NULL,
  event_type VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sso_security_user (user_id, created_at),
  KEY idx_sso_security_client (client_id, created_at),
  KEY idx_sso_security_event (event_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
