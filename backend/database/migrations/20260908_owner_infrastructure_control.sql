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
  client_id VARCHAR(191) NOT NULL,
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
  CONSTRAINT fk_owner_application_infra_client FOREIGN KEY (client_id) REFERENCES sso_client_registry(client_id) ON DELETE CASCADE,
  CONSTRAINT fk_owner_application_infra_provider FOREIGN KEY (provider_connection_id) REFERENCES owner_provider_connections(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
