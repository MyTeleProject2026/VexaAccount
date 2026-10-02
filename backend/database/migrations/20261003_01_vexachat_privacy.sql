CREATE TABLE IF NOT EXISTS vexachat_privacy_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  read_receipts TINYINT(1) NOT NULL DEFAULT 1,
  last_seen ENUM('everyone','contacts','nobody') NOT NULL DEFAULT 'everyone',
  profile_photo ENUM('everyone','contacts','nobody') NOT NULL DEFAULT 'everyone',
  calls_from ENUM('everyone','contacts','nobody') NOT NULL DEFAULT 'contacts',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_vexachat_privacy_user (user_id)
);
