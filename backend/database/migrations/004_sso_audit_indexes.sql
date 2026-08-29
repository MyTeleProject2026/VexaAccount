-- Supporting indexes for VexaAccount security/audit administration.
-- Run after 003_sso_app_sessions.sql.

CREATE INDEX idx_sso_events_recent ON sso_security_events (created_at, event_type);
CREATE INDEX idx_sso_sessions_recent ON sso_sessions (last_seen_at, revoked_at);
CREATE INDEX idx_sso_consents_active ON sso_consents (user_id, revoked_at, granted_at);
