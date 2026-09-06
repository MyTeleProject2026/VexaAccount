-- Compatibility marker for JWTs issued before the `sv` claim rollout.
-- Application code updates this timestamp whenever session_version changes.
-- Use IF NOT EXISTS because TiDB DDL is not rolled back with the migration
-- transaction; a previous attempt can have created the column before failing
-- to record the migration as applied.
ALTER TABLE store_users
  ADD COLUMN IF NOT EXISTS session_version_changed_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);

UPDATE store_users
SET session_version_changed_at = COALESCE(created_at, CURRENT_TIMESTAMP(6))
WHERE session_version_changed_at IS NULL;
