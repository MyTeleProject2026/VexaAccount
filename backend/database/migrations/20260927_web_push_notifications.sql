-- Web Push subscriptions for installed VexaAccount PWAs.
-- Browser permission remains user-controlled; this table stores only the
-- subscription endpoint/keys needed by the Web Push protocol.
CREATE TABLE IF NOT EXISTS vexa_web_push_subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_type ENUM('user','admin') NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  endpoint TEXT NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent VARCHAR(512) NULL,
  platform VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vexa_push_endpoint (endpoint_hash),
  KEY idx_vexa_push_subject (subject_type, subject_id),
  KEY idx_vexa_push_updated (updated_at)
);

CREATE TABLE IF NOT EXISTS vexa_account_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(64) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vexa_notifications_user_created (user_id, created_at),
  KEY idx_vexa_notifications_user_read (user_id, is_read, created_at)
);
