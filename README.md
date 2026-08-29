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

The SSO administration routes currently expect a verified JWT carrying `super_admin: true`. The provisioning mechanism for that claim must be controlled by the production administrator authorization system before exposing the admin API.

## Roadmap

- [x] Central Account Center API foundation
- [x] OAuth authorization-code SSO foundation
- [x] PKCE S256 support
- [x] SSO client registry API
- [x] Refresh-token rotation
- [x] SSO security-event recording
- [ ] Production super-admin provisioning and RBAC
- [ ] Consent review and revocation UI/API
- [ ] SSO session review and revocation API
- [ ] User Account Center frontend PWA
- [ ] Super Admin frontend PWA
- [ ] VexaTrade SSO integration
- [ ] VexaStore SSO integration
- [ ] Certificate System SSO integration
- [ ] Ecosystem application SSO integration
- [ ] Automated integration and security test suite

## Development principle

Existing VexaAccount routes and working functionality are preserved while the centralized SSO platform is added incrementally. New APIs should reuse the existing account model wherever possible rather than creating competing user systems.
