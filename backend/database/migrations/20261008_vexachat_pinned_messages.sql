CREATE TABLE IF NOT EXISTS vexachat_pinned_messages (
  conversation_id BIGINT UNSIGNED NOT NULL,
  message_id BIGINT UNSIGNED NOT NULL,
  pinned_by BIGINT UNSIGNED NOT NULL,
  pinned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, message_id),
  KEY idx_vcpm_message (message_id),
  KEY idx_vcpm_pinned (conversation_id, pinned_at),
  CONSTRAINT fk_vcpm_conversation FOREIGN KEY (conversation_id) REFERENCES vexachat_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_vcpm_message FOREIGN KEY (message_id) REFERENCES vexachat_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;