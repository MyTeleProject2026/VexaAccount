-- VexaAccount SSO core schema for TiDB / MySQL 8-compatible deployments.
-- Run against the dedicated VexaAccount database only.

CREATE TABLE IF NOT EXISTS sso_clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(128) NOT NULL,
  client_secret_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  redirect_uris JSON NOT NULL,
  allowed_scopes JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_clients_client_id (client_id)
);

CREATE TABLE IF NOT EXISTS sso_authorization_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code_hash CHAR(43) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  redirect_uri VARCHAR(2048) NOT NULL,
  scope VARCHAR(1000) NOT NULL,
  code_challenge VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_auth_code_hash (code_hash),
  KEY idx_sso_auth_code_lookup (client_id, code_hash, expires_at),
  KEY idx_sso_auth_code_user (user_id)
);

CREATE TABLE IF NOT EXISTS sso_refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(43) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  scope VARCHAR(1000) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  replaced_by_hash CHAR(43) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_refresh_token_hash (token_hash),
  KEY idx_sso_refresh_lookup (client_id, token_hash, expires_at, revoked_at),
  KEY idx_sso_refresh_user (user_id)
);
