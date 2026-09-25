CREATE TABLE IF NOT EXISTS vexa_account_switcher_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_user_id BIGINT NOT NULL,
  account_user_id BIGINT NOT NULL,
  label VARCHAR(160) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vexa_switcher_owner_account (owner_user_id, account_user_id),
  KEY idx_vexa_switcher_owner (owner_user_id, last_used_at),
  KEY idx_vexa_switcher_account (account_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;