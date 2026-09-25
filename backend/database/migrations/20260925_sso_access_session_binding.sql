-- Bind OAuth refresh/access tokens to a revocable SSO session.
-- TiDB validates ALTER TABLE clauses against the pre-change schema, so the
-- column and its index are intentionally separate DDL statements.
ALTER TABLE sso_refresh_tokens
  ADD COLUMN IF NOT EXISTS sso_session_id BIGINT NULL AFTER user_id;

ALTER TABLE sso_refresh_tokens
  ADD INDEX IF NOT EXISTS idx_sso_refresh_session (sso_session_id);
