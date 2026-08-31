-- Owner-level VexaAccount user administration support.
-- These tables extend the existing account schema without changing existing auth tables.

CREATE TABLE IF NOT EXISTS vexa_user_credit_balances (
  user_id BIGINT UNSIGNED NOT NULL,
  credit_score INT NOT NULL DEFAULT 0,
  coins BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
);

CREATE TABLE IF NOT EXISTS vexa_user_credit_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  credit_score_delta INT NOT NULL DEFAULT 0,
  coins_delta BIGINT NOT NULL DEFAULT 0,
  reason VARCHAR(500) NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vexa_credit_ledger_user (user_id, created_at)
);

CREATE TABLE IF NOT EXISTS vexa_user_storage_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(100) NOT NULL DEFAULT 'vexaaccount',
  storage_key VARCHAR(1024) NOT NULL,
  display_name VARCHAR(512) NULL,
  content_type VARCHAR(255) NULL,
  size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vexa_storage_user (user_id, status)
);

CREATE TABLE IF NOT EXISTS vexa_user_admin_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vexa_user_admin_notes_user (user_id, created_at)
);