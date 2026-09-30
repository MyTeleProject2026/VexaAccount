-- VexaChat feature expansion: media, contacts, conversation controls, notifications, WebRTC signaling
CREATE TABLE IF NOT EXISTS vexachat_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  message_id BIGINT UNSIGNED NULL,
  uploader_id BIGINT UNSIGNED NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(150) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  data_base64 LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vca_message (message_id),
  KEY idx_vca_uploader (uploader_id),
  CONSTRAINT fk_vca_message FOREIGN KEY (message_id) REFERENCES vexachat_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vexachat_contacts (
  user_id BIGINT UNSIGNED NOT NULL,
  contact_user_id BIGINT UNSIGNED NOT NULL,
  nickname VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, contact_user_id),
  KEY idx_vcc_contact (contact_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vexachat_conversation_settings (
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  muted_until DATETIME NULL,
  archived TINYINT(1) NOT NULL DEFAULT 0,
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id,user_id),
  CONSTRAINT fk_vccs_conversation FOREIGN KEY (conversation_id) REFERENCES vexachat_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vexachat_notification_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  messages_enabled TINYINT(1) NOT NULL DEFAULT 1,
  calls_enabled TINYINT(1) NOT NULL DEFAULT 1,
  previews_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vexachat_call_sessions (
  id CHAR(36) NOT NULL,
  conversation_id BIGINT UNSIGNED NOT NULL,
  caller_id BIGINT UNSIGNED NOT NULL,
  call_type ENUM('voice','video') NOT NULL,
  status ENUM('ringing','active','ended','declined','missed') NOT NULL DEFAULT 'ringing',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  PRIMARY KEY (id),
  KEY idx_vccs_conversation (conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vexachat_call_signals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  call_id CHAR(36) NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  signal_type ENUM('offer','answer','ice','hangup','decline') NOT NULL,
  payload LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_vccsig_call (call_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE vexachat_participants ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE vexachat_participants ADD COLUMN IF NOT EXISTS last_read_message_id BIGINT UNSIGNED NULL;
ALTER TABLE vexachat_participants ADD COLUMN IF NOT EXISTS muted_until DATETIME NULL;
ALTER TABLE vexachat_participants ADD COLUMN IF NOT EXISTS archived TINYINT(1) NOT NULL DEFAULT 0;
