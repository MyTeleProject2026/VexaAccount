# VexaAccount Backend

Standalone VexaAccount Web Services / API deployment.

This service owns the VexaAccount MySQL/TiDB-compatible database and exposes authentication, recovery, SSO, Account Center, security, Super Admin and Owner-control APIs.

## SSO service

The SSO contract is mounted at `/api/sso` and provides:

```text
GET  /api/sso/.well-known/openid-configuration
GET  /api/sso/authorize
POST /api/sso/token
GET  /api/sso/userinfo
POST /api/sso/logout
```

Application registration and lifecycle administration are mounted at `/api/sso-registry` and are protected by Super Admin authentication. The registry supports application creation, editing, redirect URI and scope management, approval/disable/maintenance/rejection/revocation, secret rotation, audit records and safe non-secret integration configuration export.

Connected applications use their own Render backend environment variables:

```env
VEXA_ACCOUNT_CLIENT_SECRET=<generated Client Secret>
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"<Client ID>","redirectUri":"https://your-app.example.com/auth/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

The Client Secret must remain server-side and must never be embedded in `VEXA_ACCOUNT_SSO_CONFIG`, browser code or a frontend deployment.

## Control-plane boundary

Super Admin can control supported runtime behavior through validated APIs and database-backed platform settings. It is intentionally **not** a generic source-code, SQL, shell or JavaScript execution console. Code-level backend upgrades must go through the normal repository/deployment pipeline.

## Runtime configuration

See `backend/.env.example` for the backend deployment variables, including `VEXA_ACCOUNT_ISSUER`, `JWT_SECRET`, database configuration, cookie settings and CORS origins.

## Start

```bash
npm run migrate
npm start
```

The production start script runs migrations before starting `src/index.js`.

For the complete ecosystem integration guide, including VexaTrade, VexaStore, VexaTrade Ecosystem, MTP2026 App Launcher, future apps, Render variables and Super Admin lifecycle controls, see the repository root `README.md`.

Never put database credentials, Client Secrets or signing secrets in frontend projects.
