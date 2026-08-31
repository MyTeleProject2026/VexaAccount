-- VexaAccount SSO client credential lifecycle metadata.
-- Secrets themselves must never be stored in plaintext.

ALTER TABLE sso_clients
  ADD COLUMN IF NOT EXISTS secret_created_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS secret_rotated_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP NULL;

CREATE INDEX idx_sso_clients_usage ON sso_clients (last_used_at, is_active);
