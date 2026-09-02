# VexaAccount

VexaAccount is the central identity, authentication, account-management and SSO platform for the Vexa ecosystem. It provides user authentication/recovery, Account Center workflows, application registration, authorization-code SSO with S256 PKCE, SSO session lifecycle, Super Admin Owner controls, platform settings, support/notifications and audit/security records.

**Default branch:** `master`  
**Production API:** `https://api-vexaaccount.onrender.com`

> **Operational truth:** source-code completion and CI success are not the same as live production certification. Live certification is an execution result from the deployed API using dedicated test credentials and the real production database.

## Repository structure

```text
VexaAccount/
├── backend/
├── frontend-VexaAccount-user/
├── frontend-VexaAccount-Super-admin/
├── integrations/vexaaccount-node-backend/
├── scripts/
│   ├── e2e-production-smoke.js
│   └── e2e-support-notification.js
├── docs/
│   └── PRODUCTION_E2E.md
└── .github/workflows/
    ├── verify.yml
    └── vexaaccount-e2e.yml
```

The repository root is a canonical redirect to the standalone User frontend. The User and Super Admin frontends have one canonical runtime each; superseded browser runtimes and patch files are not part of the active source tree.

## Runtime architecture

```text
User Frontend                         Owner / Super Admin
      │                                      │
      ▼                                      ▼
Account Center                       Owner Control Plane
      │                                      │
      └──────────────┬───────────────────────┘
                     ▼
             VexaAccount API
                     │
                     ▼
              MySQL / persistence
```

The backend is authoritative for authentication, authorization, identity, security-sensitive state and persistence. Frontend state is presentation state only.

## Canonical User runtime

```text
frontend-VexaAccount-user/index.html
  ├── auth/session bridges
  ├── account-center-fetch-guard.js
  ├── sso-frontend.js
  ├── account-center-loader.js
  │     ├── account-center-runtime-v2.js
  │     ├── account-center-v2-compat.js
  │     └── account-center-premium-theme.js
  ├── notification-live-runtime.js
  └── pwa.js
```

The Account Center covers login, registration, email verification, 2FA, forgot/reset password, profile, security, privacy/data, password, devices/sessions, connected applications, notifications, people/sharing, verification, account activity/recovery, support and account deletion. Security-sensitive mutations are backend-backed.

The notification runtime uses the authenticated notification API, polls while visible, refreshes when the application becomes visible and reacts to authentication changes. It does not invent notification state locally.

## Canonical Owner runtime

```text
frontend-VexaAccount-Super-admin/index.html
  ├── owner-console-runtime.js
  └── owner-control-center-loader.js
          └── owner-control-center.js
```

The Owner Control Plane provides explicit, backend-backed controls for supported user administration, security containment, SSO applications, redirect URI allowlists, support, platform settings, health, audit and security review. It never exposes arbitrary SQL, shell, JavaScript or source-file execution from the browser.

### Owner user workflow

```text
Owner login
  → authenticated Owner session
  → Users
  → inspect safe account details
  → apply supported profile/security/account control
  → confirm backend response
  → review audit/security event
```

Supported controls include search, safe detail inspection, supported profile edits, enable/disable, supported 2FA/passcode reset, SSO-session revocation, supported credit/coin adjustments with a reason, notes, storage metadata and explicit destructive account deletion. Password hashes and other sensitive credential material are not returned by the safe user-detail flow.

### Owner SSO workflow

```text
Create application
  → exact redirect URI allowlist
  → grant supported scopes
  → activate client
  → external app performs state + S256 PKCE
  → /api/sso/authorize
  → one-time authorization code
  → /api/sso/token
  → access/refresh token
  → /api/sso/userinfo
  → external app maps stable sub and creates its session
```

Redirect URI management:

```text
GET    /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
```

Production callbacks must be exact HTTPS values. Wildcard production callbacks are not supported.

## Client Secret security boundary

```text
POST /api/sso-registry/applications
        or
POST /api/sso-registry/applications/:clientId/rotate-secret
        ↓
backend generates secret
        ↓
secret is returned once
        ↓
Owner transfers it to the external application's backend
```

The browser must never persist the Client Secret in localStorage/sessionStorage, URLs, logs, PDFs or non-secret configuration. The Owner runtime contains no `clientJWT`/`clientJwt` aliases.

External applications use:

```env
VEXA_ACCOUNT_CLIENT_SECRET=server_only_secret
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"YOUR_CLIENT_ID","redirectUri":"https://your-app.example.com/auth/vexaaccount/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

`VEXA_ACCOUNT_SSO_CONFIG` must not contain `clientSecret`. The secret belongs only in the integrating application's server-side secret store.

## Support → notification two-way workflow

```text
User login
  → create support ticket
  → Owner login
  → Owner lists/opens ticket
  → Owner replies
  → backend persists reply + user notification + audit record
  → User notification API returns the new notification
  → User marks notifications read
  → Owner closes ticket
  → Owner audit trail confirms the reply
```

Relevant APIs:

```text
POST  /api/account/support/tickets
GET   /api/owner/support/tickets
POST  /api/owner/support/tickets/:ticketId/replies
PATCH /api/owner/support/tickets/:ticketId/status
GET   /api/account/notifications
POST  /api/account/notifications/read-all
PATCH /api/account/notifications/:id/read
```

The frontend notification poller is a delivery/read-state UI layer; the database/API remains the source of truth.

## Production verification — complete workflow

There are two separate verification layers.

### 1. Deployed smoke verification

`scripts/e2e-production-smoke.js` verifies the deployed API's health/security surface, including production SSO discovery and unauthenticated protection.

It does not prove that an authenticated User and Owner can complete a real transaction.

### 2. Authenticated production certification

`scripts/e2e-support-notification.js` is the real authenticated two-way production test. It executes against the deployed API and verifies:

```text
1. User authenticates
2. User session is confirmed
3. User creates a real support ticket
4. Owner authenticates
5. Owner sees the ticket
6. Owner sends a real reply
7. User receives the persisted notification
8. User acknowledges notifications as read
9. Owner closes the ticket
10. Owner audit trail contains the reply
```

The GitHub Actions workflow is `.github/workflows/vexaaccount-e2e.yml`.

### Dedicated production E2E credentials

The authenticated certification requires these four GitHub Actions secrets:

```text
VEXA_E2E_USER_EMAIL
VEXA_E2E_USER_PASSWORD
VEXA_E2E_OWNER_EMAIL
VEXA_E2E_OWNER_PASSWORD
```

These must belong to dedicated test accounts, not personal accounts. The User account must be able to create a support ticket. The Owner account must have the required Super Admin/Owner permissions to read/reply/close tickets and inspect the audit trail.

**Do not put these credentials in repository files, workflow YAML, frontend environment variables, source code or issue comments.** Configure them as GitHub Actions repository/environment secrets.

### Running certification

1. Configure all four dedicated secrets in GitHub Actions.
2. Ensure the deployed API and database contain the dedicated test User and Owner accounts.
3. Open the `VexaAccount production E2E` workflow.
4. Start it with **Run workflow**.
5. The `Authenticated user-owner-notification E2E` job must execute rather than report missing credentials.
6. The job must finish successfully and print `Support two-way notification E2E passed`.
7. Treat that successful workflow run as the production certification result for that execution.

Scheduled runs perform smoke verification. If the four credentials are absent, scheduled authenticated certification is skipped. A **manual** workflow run without all four credentials fails explicitly instead of silently claiming certification.

This repository cannot manufacture or reveal the four production credentials. They must be supplied securely by the deployment/operations owner. Therefore, a source commit cannot truthfully be described as having completed live authenticated certification until a workflow run actually executes the authenticated test successfully.

See [`docs/PRODUCTION_E2E.md`](docs/PRODUCTION_E2E.md) for the exact operational checklist and failure interpretation.

## CI and source-tree verification

`.github/workflows/verify.yml` checks:

- backend JavaScript syntax
- User frontend JavaScript syntax
- Super Admin JavaScript syntax
- canonical entrypoints
- legacy runtime/source-tree cleanup
- Owner loader/runtime integration
- Client Secret boundary
- absence of legacy `clientJWT`/`clientJwt`
- root redirect contract
- duplicate runtime prevention

CI success proves repository-level contracts only; it is not a substitute for the authenticated production E2E.

## Database source of truth

The backend is authoritative for:

- users and identity
- passwords/authentication state
- OTP/recovery state
- SSO clients and credentials
- redirect allowlists and scopes
- sessions/tokens/consents
- account settings/privacy
- notifications
- support tickets/messages
- Owner actions
- audit/security records
- platform settings

## Deployment sequence

```text
1. Commit code
2. Run repository verification
3. Deploy backend
4. Run required DB migrations
5. Verify /api/health
6. Deploy User frontend
7. Deploy Super Admin frontend
8. Verify User login/session
9. Verify Owner login/session
10. Verify Account Center workflows
11. Verify Owner controls
12. Verify SSO discovery/registration
13. Configure dedicated E2E secrets
14. Run authenticated production E2E
15. Review audit/security output
```

## Security rules

- Never expose database credentials, JWT signing keys, SMTP credentials, access tokens, refresh tokens or Client Secrets to browser code.
- Use exact redirect URIs.
- Use S256 PKCE for authorization-code SSO.
- Validate state server-side.
- Use `userinfo.sub` as the stable external identity key.
- Rotate compromised Client Secrets immediately.
- Revoke compromised sessions/applications.
- Keep Owner controls explicit, validated and auditable.
- Never add arbitrary SQL/shell/source-code execution to the Owner UI.

## Documentation map

- `README.md` — repository-wide architecture, workflows and production certification rules
- `README_OWNER_CONTROL_CENTER.md` — Owner Control Center operations and security boundary
- `docs/PRODUCTION_E2E.md` — exact authenticated production E2E setup/run/checklist
- `docs/SSO_INTEGRATION.md` — SSO contract
- `docs/VexaAccount-SSO-Frontend-Integration.md` — frontend SSO integration
- `integrations/vexaaccount-node-backend/README.md` — external backend integration
- `frontend-VexaAccount-user/README.md` — User frontend runtime
- `frontend-VexaAccount-Super-admin/README.md` — Owner frontend runtime

## Current operational status

The canonical runtime consolidation, source-tree cleanup, secret boundary, live notification polling and authenticated E2E implementation are in the repository.

**Live authenticated production certification is complete only after the authenticated GitHub Actions job has actually executed successfully against `https://api-vexaaccount.onrender.com`.**
