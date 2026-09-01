CREATE TABLE IF NOT EXISTS vexa_account_center_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  username VARCHAR(64) NULL,
  recovery_email VARCHAR(255) NULL,
  push_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
  product_updates_enabled TINYINT(1) NOT NULL DEFAULT 0,
  location_sharing_enabled TINYINT(1) NOT NULL DEFAULT 0,
  personalization_enabled TINYINT(1) NOT NULL DEFAULT 1,
  activity_history_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_vexa_account_center_username (username)
);

CREATE TABLE IF NOT EXISTS vexa_account_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vexa_account_notifications_user_created (user_id, created_at),
  KEY idx_vexa_account_notifications_user_read (user_id, is_read)
);

CREATE TABLE IF NOT EXISTS vexa_account_support_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vexa_account_support_user (user_id, created_at)
);
