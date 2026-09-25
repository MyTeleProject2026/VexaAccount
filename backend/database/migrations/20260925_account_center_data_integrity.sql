-- Canonical Account Center persistence. These tables are schema-managed rather than
-- created lazily by request handlers.
CREATE TABLE IF NOT EXISTS vexa_account_privacy_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  location_sharing_enabled TINYINT(1) NOT NULL DEFAULT 0,
  personalization_enabled TINYINT(1) NOT NULL DEFAULT 1,
  activity_history_enabled TINYINT(1) NOT NULL DEFAULT 1,
  push_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
  product_updates_enabled TINYINT(1) NOT NULL DEFAULT 1,
  marketing_email_enabled TINYINT(1) NOT NULL DEFAULT 0,
  security_email_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS vexa_account_support_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ticket_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  sender_type ENUM('user','support') NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vexa_support_messages_ticket (ticket_id, created_at),
  KEY idx_vexa_support_messages_user (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS vexa_user_credit_balances (
  user_id BIGINT UNSIGNED NOT NULL,
  credit_score DECIMAL(18,2) NOT NULL DEFAULT 0,
  coins DECIMAL(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS vexa_user_credit_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  credit_score_delta DECIMAL(18,2) NOT NULL DEFAULT 0,
  coins_delta DECIMAL(18,2) NOT NULL DEFAULT 0,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vexa_credit_ledger_user_created (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS vexa_user_storage_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(64) NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  display_name VARCHAR(255) NULL,
  content_type VARCHAR(255) NULL,
  size_bytes BIGINT UNSIGNED NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vexa_storage_user_key (user_id, provider, storage_key),
  KEY idx_vexa_storage_user_updated (user_id, updated_at)
);
