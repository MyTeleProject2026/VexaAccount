-- Keep legacy JWTs usable after the session-version rollout while still making
-- logout/password-reset/deactivation/account-delete invalidation effective.
-- Newer JWTs with an explicit `sv` claim continue to use exact version matching.
ALTER TABLE store_users
  ADD COLUMN session_version_changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);

UPDATE store_users
SET session_version_changed_at = COALESCE(session_version_changed_at, created_at, CURRENT_TIMESTAMP(6));

DROP TRIGGER IF EXISTS trg_store_users_session_version_changed;

DELIMITER $$
CREATE TRIGGER trg_store_users_session_version_changed
BEFORE UPDATE ON store_users
FOR EACH ROW
BEGIN
  IF NOT (OLD.session_version <=> NEW.session_version) THEN
    SET NEW.session_version_changed_at = CURRENT_TIMESTAMP(6);
  END IF;
END$$
DELIMITER ;
