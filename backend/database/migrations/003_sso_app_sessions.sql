-- VexaAccount SSO application-session foundation.
-- Run after 001_sso_core.sql.

CREATE TABLE IF NOT EXISTS sso_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_hash CHAR(43) NOT NULL,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  scope VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_session_hash (session_hash),
  KEY idx_sso_session_user (user_id, revoked_at, expires_at),
  KEY idx_sso_session_client (client_id, revoked_at, expires_at)
);

CREATE TABLE IF NOT EXISTS sso_consents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  scopes VARCHAR(1000) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_consent_user_client (user_id, client_id),
  KEY idx_sso_consent_client (client_id),
  KEY idx_sso_consent_user (user_id)
);

CREATE TABLE IF NOT EXISTS sso_security_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  client_id VARCHAR(128) NULL,
  event_type VARCHAR(100) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sso_events_user_time (user_id, created_at),
  KEY idx_sso_events_client_time (client_id, created_at),
  KEY idx_sso_events_type_time (event_type, created_at)
);
