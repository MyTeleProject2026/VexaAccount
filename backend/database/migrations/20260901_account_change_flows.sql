CREATE TABLE IF NOT EXISTS vexa_account_pending_changes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  change_type VARCHAR(32) NOT NULL,
  pending_email VARCHAR(255) NULL,
  pending_password_hash VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vexa_pending_user_type (user_id, change_type),
  KEY idx_vexa_pending_expiry (expires_at)
);