ALTER TABLE vexamail_messages
  ADD COLUMN cc_address VARCHAR(2000) NOT NULL DEFAULT '' AFTER to_address;

ALTER TABLE vexamail_messages
  ADD COLUMN bcc_address VARCHAR(2000) NOT NULL DEFAULT '' AFTER cc_address;

ALTER TABLE vexamail_messages
  ADD COLUMN reply_to VARCHAR(320) NOT NULL DEFAULT '' AFTER bcc_address;

ALTER TABLE vexamail_messages
  ADD COLUMN message_id VARCHAR(255) NULL AFTER thread_id;

ALTER TABLE vexamail_messages
  ADD COLUMN in_reply_to VARCHAR(255) NULL AFTER message_id;

ALTER TABLE vexamail_messages
  ADD COLUMN references_header TEXT NULL AFTER in_reply_to;

ALTER TABLE vexamail_messages
  ADD COLUMN body_html LONGTEXT NULL AFTER body;

ALTER TABLE vexamail_messages
  ADD COLUMN delivery_status ENUM('draft','queued','sent','failed','delivered','bounced') NOT NULL DEFAULT 'sent' AFTER is_spam;

ALTER TABLE vexamail_messages
  ADD COLUMN provider VARCHAR(64) NULL AFTER delivery_status;

ALTER TABLE vexamail_messages
  ADD COLUMN provider_message_id VARCHAR(255) NULL AFTER provider;

ALTER TABLE vexamail_messages
  ADD UNIQUE KEY uq_vexamail_message_id(message_id);

ALTER TABLE vexamail_messages
  ADD KEY idx_vexamail_thread(user_id,thread_id,created_at);

ALTER TABLE vexamail_messages
  ADD KEY idx_vexamail_delivery(user_id,delivery_status,created_at);

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
