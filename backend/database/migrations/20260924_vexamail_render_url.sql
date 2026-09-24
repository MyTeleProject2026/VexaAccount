-- Repair/normalize the VexaMail public PKCE client for the production Render Static Site.
-- OAuth redirect URI validation is sourced from sso_clients. The registry table stores
-- control-plane metadata only and intentionally does not contain redirect URI columns.

INSERT INTO sso_clients (
  client_id,
  client_secret_hash,
  name,
  redirect_uris,
  allowed_scopes,
  is_active
)
VALUES (
  'vexamail-user',
  'PUBLIC',
  'VexaMail User',
  JSON_ARRAY('https://vexamail.onrender.com/'),
  JSON_ARRAY('openid','profile','email','account','session'),
  1
)
ON DUPLICATE KEY UPDATE
  client_secret_hash = VALUES(client_secret_hash),
  name = VALUES(name),
  redirect_uris = VALUES(redirect_uris),
  allowed_scopes = VALUES(allowed_scopes),
  is_active = 1,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO sso_client_registry (
  client_id,
  display_name,
  application_key,
  environment,
  status,
  description
)
VALUES (
  'vexamail-user',
  'VexaMail User',
  'vexamail-user',
  'production',
  'active',
  'VexaMail static webmail public PKCE client'
)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  environment = 'production',
  status = 'active',
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;
