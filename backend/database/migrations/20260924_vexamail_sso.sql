INSERT INTO sso_clients (client_id,client_secret_hash,name,redirect_uris,allowed_scopes,is_active)
VALUES (
 'vexamail-user',
 'PUBLIC',
 'VexaMail User',
 JSON_ARRAY('https://vexamail.onrender.com/'),
 JSON_ARRAY('openid','profile','email','account','session'),
 1
)
ON DUPLICATE KEY UPDATE
 name=VALUES(name),
 redirect_uris=VALUES(redirect_uris),
 allowed_scopes=VALUES(allowed_scopes),
 is_active=1;

INSERT INTO sso_client_registry (client_id,display_name,application_key,environment,status,description)
VALUES (
 'vexamail-user',
 'VexaMail User',
 'vexamail-user',
 'production',
 'active',
 'VexaMail static webmail public PKCE client'
)
ON DUPLICATE KEY UPDATE
 display_name=VALUES(display_name),
 status='active',
 description=VALUES(description),
 updated_at=CURRENT_TIMESTAMP;