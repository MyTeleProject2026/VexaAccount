INSERT INTO sso_clients (client_id,client_secret_hash,name,redirect_uris,allowed_scopes,is_active)
VALUES ('vexamail-user','PUBLIC','VexaMail User','["https://vexamail.onrender.com/"]','["openid","profile","email","account","session"]',1)
ON DUPLICATE KEY UPDATE
 client_secret_hash='PUBLIC',
 name='VexaMail User',
 redirect_uris='["https://vexamail.onrender.com/"]',
 allowed_scopes='["openid","profile","email","account","session"]',
 is_active=1;

INSERT INTO sso_client_registry (client_id,client_name,redirect_uris,allowed_scopes,is_active)
VALUES ('vexamail-user','VexaMail User','["https://vexamail.onrender.com/"]','["openid","profile","email","account","session"]',1)
ON DUPLICATE KEY UPDATE
 client_name='VexaMail User',
 redirect_uris='["https://vexamail.onrender.com/"]',
 allowed_scopes='["openid","profile","email","account","session"]',
 is_active=1;