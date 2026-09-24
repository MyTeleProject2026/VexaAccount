CREATE TABLE IF NOT EXISTS vexamail_attachments (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 message_id BIGINT UNSIGNED NOT NULL,
 filename VARCHAR(255) NOT NULL,
 content_type VARCHAR(255) NOT NULL DEFAULT 'application/octet-stream',
 size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
 storage_key VARCHAR(512) NOT NULL,
 content_id VARCHAR(255) NULL,
 is_inline TINYINT(1) NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(id),
 KEY idx_vexamail_attachment_message(message_id),
 KEY idx_vexamail_attachment_storage(storage_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vexamail_delivery_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 message_id BIGINT UNSIGNED NULL,
 provider VARCHAR(64) NOT NULL,
 provider_message_id VARCHAR(255) NULL,
 event_type VARCHAR(64) NOT NULL,
 recipient VARCHAR(320) NULL,
 payload JSON NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(id),
 KEY idx_vexamail_delivery_message(message_id),
 KEY idx_vexamail_delivery_provider(provider,provider_message_id),
 KEY idx_vexamail_delivery_recipient(recipient,event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;