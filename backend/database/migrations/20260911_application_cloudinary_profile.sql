CREATE TABLE IF NOT EXISTS sso_application_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(128) NOT NULL,
  application_url VARCHAR(2048) NULL,
  framework VARCHAR(128) NULL,
  github_repository VARCHAR(255) NULL,
  github_branch VARCHAR(191) NULL,
  render_service_id VARCHAR(191) NULL,
  cloudinary_folder VARCHAR(512) NULL,
  metadata_json JSON NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sso_application_profile_client (client_id),
  KEY idx_sso_application_profile_github (github_repository,github_branch),
  KEY idx_sso_application_profile_render (render_service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sso_application_assets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id VARCHAR(128) NOT NULL,
  asset_kind VARCHAR(64) NOT NULL DEFAULT 'icon',
  display_name VARCHAR(255) NOT NULL,
  public_id VARCHAR(512) NOT NULL,
  resource_type VARCHAR(32) NOT NULL DEFAULT 'image',
  delivery_type VARCHAR(32) NOT NULL DEFAULT 'upload',
  format VARCHAR(64) NULL,
  secure_url VARCHAR(2048) NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  size_bytes BIGINT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_by BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sso_application_assets_client (client_id,asset_kind),
  UNIQUE KEY uq_sso_application_assets_public_id (public_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The application relationship is validated by the authenticated Owner API.
-- No physical FK is used so existing TiDB/MySQL installations with legacy
-- client-id metadata remain migration-safe.
