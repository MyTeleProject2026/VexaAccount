CREATE TABLE IF NOT EXISTS vexamail_preferences (
  user_id BIGINT UNSIGNED NOT NULL,
  conversation_view TINYINT(1) NOT NULL DEFAULT 1,
  desktop_notifications TINYINT(1) NOT NULL DEFAULT 1,
  compact_message_list TINYINT(1) NOT NULL DEFAULT 1,
  confirm_destructive_actions TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_vexamail_preferences_user (user_id)
);