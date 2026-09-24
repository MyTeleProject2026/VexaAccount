ALTER TABLE vexamail_messages
  ADD COLUMN IF NOT EXISTS cc_address VARCHAR(2000) NOT NULL DEFAULT '' AFTER to_address;

ALTER TABLE vexamail_messages
  ADD COLUMN IF NOT EXISTS bcc_address VARCHAR(2000) NOT NULL DEFAULT '' AFTER cc_address;

ALTER TABLE vexamail_messages
  ADD COLUMN IF NOT EXISTS reply_to VARCHAR(320) NOT NULL DEFAULT '' AFTER bcc_address;

ALTER TABLE vexamail_messages
  ADD COLUMN IF NOT EXISTS message_id VARCHAR(255) NULL AFTER thread_id;

ALTER TABLE vexamail_messages
  ADD COLUMN IF NOT EXISTS in_reply_to VARCHAR(255) NULL AFTER message_id;

ALTER TABLE vexamail_messages
  ADD COLUMN IF NOT EXISTS references_header TEXT NULL AFTER in_reply_to;

ALTER TABLE vexamail_messages
  ADD COLUMN IF NOT EXISTS body_html LONGTEXT NULL AFTER body;

ALTER TABLE vexamail_messages
  ADD COLUMN IF NOT EXISTS delivery_status ENUM('draft','queued','sent','failed','delivered','bounced') NOT NULL DEFAULT 'sent' AFTER is_spam;

ALTER TABLE vexamail_messages
  ADD COLUMN IF NOT EXISTS provider VARCHAR(64) NULL AFTER delivery_status;

ALTER TABLE vexamail_messages
  ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255) NULL AFTER provider;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vexamail_message_id
  ON vexamail_messages(message_id);

CREATE INDEX IF NOT EXISTS idx_vexamail_thread
  ON vexamail_messages(user_id,thread_id,created_at);

CREATE INDEX IF NOT EXISTS idx_vexamail_delivery
  ON vexamail_messages(user_id,delivery_status,created_at);

CREATE TABLE IF NOT EXISTS vexamail_recipients (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 message_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NULL,
 email VARCHAR(320) NOT NULL,
 display_name VARCHAR(255) NOT NULL DEFAULT '',
 recipient_type ENUM('to','cc','bcc') NOT NULL,
 delivery_status ENUM('pending','sent','delivered','failed','bounced') NOT NULL DEFAULT 'pending',
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(id),
 KEY idx_vexamail_recipient_message(message_id),
 KEY idx_vexamail_recipient_email(email,recipient_type),
 KEY idx_vexamail_recipient_user(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
