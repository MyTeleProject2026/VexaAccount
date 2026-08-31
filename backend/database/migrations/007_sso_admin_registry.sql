-- VexaAccount registry metadata used by the Super Admin control plane.
-- This table is intentionally independent from each Vexa application's own database.

CREATE TABLE IF NOT EXISTS sso_client_registry (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(128) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  application_key VARCHAR(128) NOT NULL,
  environment VARCHAR(32) NOT NULL DEFAULT 'production',
  status ENUM('active','disabled','maintenance') NOT NULL DEFAULT 'active',
  owner_label VARCHAR(255) NULL,
  description VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_registry_client (client_id),
  UNIQUE KEY uq_sso_registry_application (application_key),
  KEY idx_sso_registry_status (status, environment)
);
