# VexaAccount

Centralized identity, account security, and Single Sign-On (SSO) service for the Vexa ecosystem.

VexaAccount is intended to provide one secure account for users across Vexa applications, similar in concept to a centralized identity provider: users authenticate with VexaAccount and approved Vexa applications receive scoped identity access without sharing the user's password.

## Ecosystem architecture

```text
                         VexaAccount
                    Identity + SSO Authority
                             |
       +---------------------+----------------------+
       |                     |                      |
   VexaTrade             VexaStore       Vexa Certificate System
       |                     |                      |
       +---------------------+----------------------+
                             |
                    Future Vexa Applications
                             |
                    MTP2026 App Launcher
```

Each Vexa application can keep its own TiDB/MySQL database for application-specific data. VexaAccount is the central authority for identity, authentication, SSO authorization, consent, and account security.

## MTP2026 App Launcher SSO integration

The MTP2026 App Launcher is registered as a VexaAccount OAuth/OIDC-style client. Its production frontend and backend are separate Render services:

```text
MTP2026 frontend
https://mtp2026-app-launcher.onrender.com
        |
        | OAuth authorization + PKCE
        v
VexaAccount
https://api-vexaaccount.onrender.com
        |
        | authorization code
        v
MTP2026 frontend /auth/callback
        |
        | code + PKCE verifier + client secret
        v
MTP2026 backend
https://mtp2026-app-launcher-backend.onrender.com
```

Use these exact integration values:

```env
MTP2026_APP_LAUNCHER_CLIENT_ID=mtp2026-app-launcher
MTP2026_APP_LAUNCHER_REDIRECT_URI=https://mtp2026-app-launcher.onrender.com/auth/callback
```

The client ID is an application identifier, not a secret. The redirect URI must exactly match the URI used by the MTP2026 frontend.

### Automatic client bootstrap

VexaAccount now supports deployment-time bootstrap of the MTP2026 client. On startup, when all three variables below are configured, VexaAccount creates or updates the client in `sso_clients`:

```env
MTP2026_APP_LAUNCHER_CLIENT_ID=mtp2026-app-launcher
MTP2026_APP_LAUNCHER_CLIENT_SECRET=<same-long-random-secret-used-by-the-MTP2026-backend>
MTP2026_APP_LAUNCHER_REDIRECT_URI=https://mtp2026-app-launcher.onrender.com/auth/callback
```

The raw client secret is never written to the database. VexaAccount stores only its SHA-256 hash. The same secret must be configured on the MTP2026 backend; it must never be placed in the MTP2026 static frontend.

Generate a strong random secret (at least 32 characters; 48–64 random characters is recommended) and add it as a secret environment variable in both Render backends. Do not commit it to GitHub.

## Centralized SSO

The SSO service implements an OAuth-style authorization-code flow with PKCE S256:

```text
GET  /api/sso/.well-known/openid-configuration
GET  /api/sso/authorize
POST /api/sso/token
GET  /api/sso/userinfo
```

Supported concepts include:

- Authorization Code flow
- PKCE S256
- Redirect URI allow-list validation
- Scoped access
- User consent persistence
- One-time authorization codes
- Refresh-token rotation
- SSO sessions
- Security-event recording
- OpenID-style discovery metadata

## MTP2026 Render configuration

### VexaAccount Backend — `api-vexaaccount.onrender.com`

Add:

```env
NODE_ENV=production
VEXA_ACCOUNT_ISSUER=https://api-vexaaccount.onrender.com
API_BASE_URL=https://api-vexaaccount.onrender.com
MTP2026_APP_LAUNCHER_CLIENT_ID=mtp2026-app-launcher
MTP2026_APP_LAUNCHER_CLIENT_SECRET=<strong-random-secret>
MTP2026_APP_LAUNCHER_REDIRECT_URI=https://mtp2026-app-launcher.onrender.com/auth/callback
```

Keep the existing production `JWT_SECRET` and TiDB/MySQL variables unchanged.

### MTP2026 App Launcher Backend — `mtp2026-app-launcher-backend.onrender.com`

Configure the corresponding MTP2026 backend variables using the same client ID, redirect URI, and client secret:

```env
VEXA_ACCOUNT_BASE_URL=https://api-vexaaccount.onrender.com
VEXA_ACCOUNT_ISSUER=https://api-vexaaccount.onrender.com
VEXA_ACCOUNT_CLIENT_ID=mtp2026-app-launcher
VEXA_ACCOUNT_CLIENT_SECRET=<same-strong-random-secret>
VEXA_ACCOUNT_REDIRECT_URI=https://mtp2026-app-launcher.onrender.com/auth/callback
FRONTEND_URL=https://mtp2026-app-launcher.onrender.com
```

Use the exact variable names implemented by the MTP2026 backend if they differ; the values above are the intended integration values.

### MTP2026 App Launcher Frontend — `mtp2026-app-launcher.onrender.com`

The static frontend may safely contain only the public client ID and redirect URI:

```env
VITE_VEXA_ACCOUNT_BASE_URL=https://api-vexaaccount.onrender.com
VITE_VEXA_ACCOUNT_ISSUER=https://api-vexaaccount.onrender.com
VITE_VEXA_ACCOUNT_CLIENT_ID=mtp2026-app-launcher
VITE_VEXA_ACCOUNT_REDIRECT_URI=https://mtp2026-app-launcher.onrender.com/auth/callback
VITE_API_BASE_URL=https://mtp2026-app-launcher-backend.onrender.com
```

Never expose `MTP2026_APP_LAUNCHER_CLIENT_SECRET` or any server/database secret in a Vite frontend.

## SSO client registry

Super-administrator routes:

```text
GET   /api/admin/sso/clients
POST  /api/admin/sso/clients
PATCH /api/admin/sso/clients/:clientId
POST  /api/admin/sso/clients/:clientId/rotate-secret
GET   /api/admin/sso/events
```

Client secrets are generated once and only returned at creation or rotation time when using the registry API. Store them securely.

## Account Center API

Authenticated account routes are available under:

```text
GET    /api/account/profile
PATCH  /api/account/profile
GET    /api/account/security
GET    /api/account/activity
GET    /api/account/apps
DELETE /api/account/apps/:slug

GET    /api/account/sso/consents
DELETE /api/account/sso/consents/:clientId
GET    /api/account/sso/sessions
DELETE /api/account/sso/sessions/:id
```

## Database

VexaAccount uses TiDB/MySQL compatibility.

The centralized SSO schema is located at:

```text
vexaccount/database/migrations/011_vexa_sso_core.sql
```

It defines:

- `sso_clients`
- `sso_authorization_codes`
- `sso_consents`
- `sso_refresh_tokens`
- `sso_sessions`
- `sso_security_events`
- `vexa_super_admins`
- `vexa_admin_audit_log`

Run migrations using your deployment/database migration process before enabling SSO clients in production.

## Security notes

Before production launch, verify and complete:

- Strong unique production `JWT_SECRET`
- HTTPS-only production deployment
- Exact production issuer URL
- Exact redirect URI allow-lists
- Database migration execution
- Super-admin identity and authorization provisioning
- Secret storage outside source control
- Rate limiting for sensitive OAuth and login routes
- Token revocation and incident procedures
- End-to-end integration tests
- Security review

The MTP2026 client bootstrap intentionally requires an explicitly configured secret and never creates a secret from a public frontend. If any of the three MTP bootstrap variables is missing, no bootstrap action is attempted.

## Deployment model

Deploy independently:

```text
vexaccount/                         # Node.js backend
frontend-VexaAccount-user/          # static user PWA
frontend-VexaAccount-Super-admin/   # static Super Owner PWA
```

Applications such as MTP2026 App Launcher integrate with VexaAccount through registered SSO clients and keep their own application database.

## Roadmap

- [x] Central Account Center API foundation
- [x] OAuth authorization-code SSO foundation
- [x] PKCE S256 support
- [x] SSO client registry API
- [x] Refresh-token rotation
- [x] SSO security-event recording
- [x] Database-backed Super Owner authorization foundation
- [x] Super Owner audit logging foundation
- [x] Reusable Super Owner RBAC middleware foundation
- [x] Consent review and revocation API
- [x] SSO session review and revocation API
- [x] User Account Center static PWA foundation
- [x] Super Owner static PWA foundation
- [x] MTP2026 App Launcher SSO bootstrap integration
- [ ] Controlled Super Owner provisioning workflow
- [ ] VexaTrade SSO integration
- [ ] VexaStore SSO integration
- [ ] Certificate System SSO integration
- [ ] Automated integration and security test suite
