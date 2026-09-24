CREATE TABLE IF NOT EXISTS vexamail_messages (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 thread_id CHAR(36) NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 from_address VARCHAR(320) NOT NULL,
 to_address VARCHAR(320) NOT NULL,
 subject VARCHAR(998) NOT NULL DEFAULT '',
 body LONGTEXT NOT NULL,
 folder ENUM('inbox','sent','drafts') NOT NULL DEFAULT 'sent',
 is_read TINYINT(1) NOT NULL DEFAULT 1,
 starred TINYINT(1) NOT NULL DEFAULT 0,
 is_trashed TINYINT(1) NOT NULL DEFAULT 0,
 is_spam TINYINT(1) NOT NULL DEFAULT 0,
 deleted_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(id),
 KEY idx_vexamail_user_folder_created(user_id,folder,created_at),
 KEY idx_vexamail_user_flags(user_id,starred,is_trashed,is_spam)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;