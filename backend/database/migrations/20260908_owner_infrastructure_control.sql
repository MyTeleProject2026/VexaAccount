CREATE TABLE IF NOT EXISTS owner_provider_connections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(64) NOT NULL,
  connection_name VARCHAR(255) NOT NULL,
  credential_ciphertext TEXT NOT NULL,
  credential_iv VARCHAR(64) NOT NULL,
  credential_tag VARCHAR(64) NOT NULL,
  metadata_json JSON NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_owner_provider_connection (provider, connection_name),
  KEY idx_owner_provider (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS owner_application_infrastructure (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(128) NOT NULL,
  provider_connection_id BIGINT UNSIGNED NULL,
  service_id VARCHAR(191) NULL,
  service_name VARCHAR(255) NULL,
  environment_name VARCHAR(255) NULL,
  repository VARCHAR(255) NULL,
  branch_name VARCHAR(191) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'unconfigured',
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_owner_application_infra_client (client_id),
  KEY idx_owner_application_infra_service (service_id),
  KEY idx_owner_application_infra_provider (provider_connection_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Do not add a physical FK from client_id to sso_client_registry here.
-- Existing production VexaAccount/TiDB installations may have a legacy
-- client_id definition whose metadata differs even when its logical length
-- is compatible. The Owner infrastructure layer validates the referenced
-- application at the service/API boundary instead. Keeping this migration
-- independent makes startup safe across existing production schemas while
-- preserving the application-level ownership relationship.
