CREATE TABLE IF NOT EXISTS vexachat_conversations (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 conversation_type ENUM('direct','group') NOT NULL DEFAULT 'direct',
 title VARCHAR(255) NOT NULL DEFAULT '',
 avatar_url TEXT NULL,
 created_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(id),
 KEY idx_vexachat_conversations_updated(updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vexachat_participants (
 conversation_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 role ENUM('owner','admin','member') NOT NULL DEFAULT 'member',
 joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 last_read_message_id BIGINT UNSIGNED NULL,
 muted_until DATETIME NULL,
 archived TINYINT(1) NOT NULL DEFAULT 0,
 PRIMARY KEY(conversation_id,user_id),
 KEY idx_vexachat_participants_user(user_id,conversation_id),
 CONSTRAINT fk_vexachat_participant_conversation FOREIGN KEY(conversation_id) REFERENCES vexachat_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vexachat_messages (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 conversation_id BIGINT UNSIGNED NOT NULL,
 sender_id BIGINT UNSIGNED NOT NULL,
 client_message_id CHAR(36) NULL,
 message_type ENUM('text','image','file','audio','video','system') NOT NULL DEFAULT 'text',
 body LONGTEXT NOT NULL,
 reply_to_id BIGINT UNSIGNED NULL,
 metadata JSON NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 edited_at DATETIME NULL,
 deleted_at DATETIME NULL,
 PRIMARY KEY(id),
 UNIQUE KEY uq_vexachat_client_message(client_message_id),
 KEY idx_vexachat_messages_conversation_created(conversation_id,created_at,id),
 KEY idx_vexachat_messages_sender(sender_id),
 CONSTRAINT fk_vexachat_message_conversation FOREIGN KEY(conversation_id) REFERENCES vexachat_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vexachat_reactions (
 message_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 emoji VARCHAR(32) NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(message_id,user_id,emoji),
 KEY idx_vexachat_reactions_message(message_id),
 CONSTRAINT fk_vexachat_reaction_message FOREIGN KEY(message_id) REFERENCES vexachat_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vexachat_blocks (
 user_id BIGINT UNSIGNED NOT NULL,
 blocked_user_id BIGINT UNSIGNED NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,blocked_user_id),
 KEY idx_vexachat_blocks_blocked(blocked_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vexachat_presence (
 user_id BIGINT UNSIGNED NOT NULL,
 status ENUM('online','offline','away') NOT NULL DEFAULT 'offline',
 last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS vexachat_typing (
 conversation_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 expires_at DATETIME NOT NULL,
 PRIMARY KEY(conversation_id,user_id),
 KEY idx_vexachat_typing_expiry(expires_at),
 CONSTRAINT fk_vexachat_typing_conversation FOREIGN KEY(conversation_id) REFERENCES vexachat_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;