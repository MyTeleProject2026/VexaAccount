# VexaAccount Backend

The authoritative VexaAccount API and database service.

## Mounted API areas

The current `src/index.js` mounts the existing workflows for:

```text
/api/auth
/api/auth/super-admin
/api/sso
/api/sso-registry
/api/sso-integration
/api/account
/api/account/change
/api/account/security
/api/account/security-score
/api/account/storage
/api/owner
/api/owner/users
/api/owner/platform
/api/owner/support
/api/system-c
```

Authentication/session state and security-sensitive account state are database-backed. `/api/auth/session` validates the signed session against the active user and `session_version`; logout increments the server-side session version.

## SSO

The provider exposes authorization-code SSO with S256 PKCE, one-time authorization codes, refresh-token lifecycle controls, consent/session containment and protected userinfo. Application registration is controlled through `/api/sso-registry`.

Connected applications keep their Client Secret server-side:

```env
VEXA_ACCOUNT_CLIENT_SECRET=<generated Client Secret>
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"<Client ID>","redirectUri":"https://your-app.example.com/auth/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

Do not put `clientSecret` into browser configuration or `VEXA_ACCOUNT_SSO_CONFIG`.

## Database migrations

Production startup runs the migration process before starting `src/index.js`. Current migrations include Account Center/change workflows and the `session_version` compatibility/security migration used by server-side session invalidation.

## Health and runtime verification

`GET /api/health` performs a real database query and reports database/server health. The repository also contains static verification and production runtime smoke workflows. A successful source check is not treated as production certification until the deployed API and both deployed frontends serve and execute the current source.

## Start

```bash
npm run migrate
npm start
```

Never put database credentials, Client Secrets or signing secrets in frontend projects.
