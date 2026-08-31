-- Super Admin application-management indexes.
ALTER TABLE sso_clients ADD COLUMN IF NOT EXISTS secret_created_at TIMESTAMP NULL;
CREATE INDEX IF NOT EXISTS idx_sso_clients_name_active ON sso_clients (name, is_active);
