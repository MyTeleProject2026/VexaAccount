-- Bind OAuth refresh/access tokens to a revocable SSO session.
-- This lets Account Center revoke an application session immediately without
-- invalidating the user's separate first-party VexaAccount browser session.

SET @has_sso_session_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sso_refresh_tokens'
    AND COLUMN_NAME = 'sso_session_id'
);
SET @sql := IF(@has_sso_session_id = 0,
  'ALTER TABLE sso_refresh_tokens ADD COLUMN sso_session_id BIGINT NULL AFTER user_id, ADD KEY idx_sso_refresh_session (sso_session_id)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
