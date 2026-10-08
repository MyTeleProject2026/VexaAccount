CREATE TABLE IF NOT EXISTS vexachat_saved_messages (
  user_id BIGINT UNSIGNED NOT NULL,
  message_id BIGINT UNSIGNED NOT NULL,
  saved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, message_id),
  KEY idx_vcsm_user_saved (user_id, saved_at),
  KEY idx_vcsm_message (message_id),
  CONSTRAINT fk_vcsm_message FOREIGN KEY (message_id) REFERENCES vexachat_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS vexachat_invite_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token CHAR(48) NOT NULL,
  inviter_id BIGINT UNSIGNED NOT NULL,
  conversation_id BIGINT UNSIGNED NULL,
  expires_at DATETIME NULL,
  max_uses INT UNSIGNED NULL,
  uses INT UNSIGNED NOT NULL DEFAULT 0,
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vcit_token (token),
  KEY idx_vcit_inviter (inviter_id),
  KEY idx_vcit_conversation (conversation_id),
  CONSTRAINT fk_vcit_conversation FOREIGN KEY (conversation_id) REFERENCES vexachat_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;