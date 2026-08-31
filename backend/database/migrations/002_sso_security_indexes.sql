-- Additional indexes for VexaAccount SSO lifecycle queries.
-- Safe to run after 001_sso_core.sql.

CREATE INDEX idx_sso_clients_active_name ON sso_clients (is_active, name);
CREATE INDEX idx_sso_auth_codes_expiry ON sso_authorization_codes (expires_at, consumed_at);
CREATE INDEX idx_sso_refresh_expiry ON sso_refresh_tokens (expires_at, revoked_at);
CREATE INDEX idx_sso_refresh_replacement ON sso_refresh_tokens (replaced_by_hash);
