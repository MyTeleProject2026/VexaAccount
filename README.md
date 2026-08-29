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
```

Each Vexa application can keep its own TiDB/MySQL database for application-specific data. VexaAccount is the central authority for identity, authentication, SSO authorization, consent, and account security.

## Repository structure

```text
VexaAccount/
├── vexaccount/                         # Main backend web service
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── account.js
│   │   │   ├── sso.js
│   │   │   └── sso-admin.js
│   │   └── index.js
│   └── database/
│       └── migrations/
│           └── 011_vexa_sso_core.sql
├── frontend-VexaAccount-user/          # Planned separate static/PWA deployment
└── frontend-VexaAccount-Super-admin/   # Planned separate static/PWA deployment
```

Existing legacy directories are intentionally preserved during the migration and consolidation process.

## Current capabilities

### Account and authentication

- User registration and login
- OTP verification flows
- Password management
- Profile management
- Authenticator and email 2FA support where enabled
- Account activity logging
- Connected application management
- Account data and lifecycle features already present in the backend

### Account Center API

Authenticated account routes are available under:

```text
GET    /api/account/profile
PATCH  /api/account/profile
GET    /api/account/security
GET    /api/account/activity
GET    /api/account/apps
DELETE /api/account/apps/:slug

SSO-specific account management:

```text
GET    /api/account/sso/consents
DELETE /api/account/sso/consents/:clientId
GET    /api/account/sso/sessions
DELETE /api/account/sso/sessions/:id
```
```

### Centralized SSO

The SSO service currently implements an OAuth-style authorization-code flow with PKCE S256:

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

### SSO client registry

Super-administrator routes:

```text
GET   /api/admin/sso/clients
POST  /api/admin/sso/clients
PATCH /api/admin/sso/clients/:clientId
POST  /api/admin/sso/clients/:clientId/rotate-secret
GET   /api/admin/sso/events
```

Client secrets are generated once and only returned at creation or rotation time. Store them securely.

## SSO flow

```text
Vexa Application
      |
      |  Authorization request + PKCE challenge
      v
VexaAccount /api/sso/authorize
      |
      |  Existing VexaAccount authentication
      v
Validate client + redirect URI + scopes
      |
      v
Record consent + issue one-time authorization code
      |
      v
Application /api/sso/token
      |
      |  PKCE verifier + client authentication
      v
Access token + refresh token + SSO session
      |
      v
/api/sso/userinfo
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

Run migrations using your deployment/database migration process before enabling SSO clients in production.

## Environment configuration

The exact project environment variables may evolve with deployment, but the SSO service expects secure production configuration for at least:

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret
VEXA_ACCOUNT_ISSUER=https://your-vexaaccount-api-domain
API_BASE_URL=https://your-vexaaccount-api-domain
```

Database connection variables must match the existing TiDB/MySQL configuration used by `src/config/database.js`.

Do not commit real production secrets.

## Deployment model

VexaAccount is designed for separate deployments:

1. **VexaAccount Backend** — API and SSO web service
2. **VexaAccount User Frontend** — static/PWA Account Center
3. **VexaAccount Super Admin Frontend** — static/PWA ecosystem administration

Applications such as VexaTrade and VexaStore integrate with the backend through registered SSO clients and do not need to share the VexaAccount user database.

### Frontend PWA projects

Both frontend projects are intentionally independent static deployments:

```text
frontend-VexaAccount-user/
frontend-VexaAccount-Super-admin/
```

Each contains an HTML entry point, API client, responsive CSS, web app manifest, and service worker. Configure the API base URL for production instead of embedding production secrets in frontend code.

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

Super Owner authorization is database-backed through `vexa_super_admins`. A valid VexaAccount JWT identifies the user, then the backend verifies that the user has an active Super Owner record before allowing SSO administration. Sensitive client registry actions are recorded in `vexa_admin_audit_log`. Initial Super Owner provisioning must be performed through a controlled database/bootstrap procedure and must not be exposed as a public self-service endpoint.

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
- [ ] Controlled Super Owner provisioning workflow
- [x] Consent review and revocation API
- [x] SSO session review and revocation API
- [x] User Account Center static PWA foundation
- [x] Super Owner static PWA foundation
- [ ] VexaTrade SSO integration
- [ ] VexaStore SSO integration
- [ ] Certificate System SSO integration
- [ ] Ecosystem application SSO integration
- [ ] Automated integration and security test suite

## Super Owner roles\n\nThe reusable RBAC foundation supports:\n\n- `super_owner` — unrestricted administrative permissions\n- `sso_admin` — SSO client and access administration\n- `security_admin` — session, consent and security operations\n- `auditor` — read-only security visibility\n\nRoles are stored in `vexa_super_admins`; public users cannot self-assign administrative roles.\n\n## Development principle

Existing VexaAccount routes and working functionality are preserved while the centralized SSO platform is added incrementally. New APIs should reuse the existing account model wherever possible rather than creating competing user systems.


## Super Owner ecosystem dashboard

The Super Owner API now exposes centralized operational visibility:

```text
GET    /api/admin/sso/dashboard
GET    /api/admin/sso/sessions
DELETE /api/admin/sso/sessions/:id
GET    /api/admin/sso/consents
GET    /api/admin/sso/audit
GET    /api/admin/sso/events
```

The separate `frontend-VexaAccount-Super-admin` PWA consumes dashboard metrics, client registry data, active SSO sessions, security events, and the administrative audit trail.


## Frontend production configuration

The static PWAs remain independently deployable. `frontend-VexaAccount-user/config.js` defines the API origin and can be replaced during deployment without rebuilding backend code. Do not place client secrets, database credentials, JWT signing secrets, or other server credentials in either static frontend.

Current frontend management features include profile editing, consent/session revocation, Super Owner dashboard metrics, client enable/disable control, and one-time secret rotation display.


## Controlled Super Owner provisioning

Administrative access is managed separately from ordinary users through:

```text
GET   /api/admin/super-owners
POST  /api/admin/super-owners
PATCH /api/admin/super-owners/:userId
```

These endpoints are protected by existing Super Owner authorization. Production bootstrap of the very first owner must remain an out-of-band deployment operation; the application must never expose public self-service elevation.

## Production deployment

Deploy independently:

```text
vexaccount/                         # Node.js backend
frontend-VexaAccount-user/          # static user PWA
frontend-VexaAccount-Super-admin/   # static admin PWA
```

Use environment variables for backend secrets and database connectivity. Configure the static API endpoints through each frontend `config.js`. Never commit production `.env` files or secrets.
