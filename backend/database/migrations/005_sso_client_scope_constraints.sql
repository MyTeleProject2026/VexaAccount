-- VexaAccount SSO client registration validation support.
-- Application code should validate requested scopes against allowed_scopes before issuing codes.
-- Keep redirect URIs and scopes as JSON arrays for atomic client configuration updates.

ALTER TABLE sso_clients
  ADD CONSTRAINT chk_sso_clients_active CHECK (is_active IN (0,1));
