# VexaAccount

VexaAccount is the central identity, authentication, account-management and SSO platform for the Vexa ecosystem. It provides user authentication and recovery, a full Account Center, application registration, authorization-code SSO with S256 PKCE, SSO session lifecycle, Super Admin Owner controls, platform settings and audit/security records.

**Repository default branch:** `master`

**Current API service:** `https://api-vexaaccount.onrender.com`

> **Production boundary:** source changes are deploy-time changes. The Super Admin Control Plane exposes explicit, validated controls; it does not execute arbitrary JavaScript, SQL, shell commands or source-file edits from the browser.

---

## 1. Repository structure

```text
VexaAccount/
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── middleware/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── auth-recovery.js
│   │   │   ├── sso.js
│   │   │   ├── sso-registry.js
│   │   │   ├── account-center.js
│   │   │   ├── account-full-workflows.js
│   │   │   ├── account-profile.js
│   │   │   ├── account-change-flows.js
│   │   │   ├── account-security.js
│   │   │   ├── account-deactivate.js
│   │   │   ├── super-admin-auth.js
│   │   │   ├── owner-user-management.js
│   │   │   ├── owner-user-delete.js
│   │   │   ├── owner-platform.js
│   │   │   └── owner-support.js
│   │   └── services/
│   ├── database/migrations/
│   └── public/
├── frontend-VexaAccount-user/
│   └── Canonical user authentication + Account Center
├── frontend-VexaAccount-Super-admin/
│   └── Canonical Super Admin Owner Control Plane
├── integrations/
│   └── vexaaccount-node-backend/
├── scripts/
│   ├── e2e-production-smoke.js
│   └── e2e-support-notification.js
├── .github/workflows/
│   ├── verify.yml
│   ├── pwa-packages.yml
│   └── vexaaccount-e2e.yml
└── README.md
```

The repository root is now only a canonical redirect to the standalone user frontend; duplicate root Account Center runtime files were removed.

---

## 2. Runtime architecture

```text
                         VEXAACCOUNT
                              │
              ┌───────────────┴───────────────┐
              │                               │
        User Account Center              Owner Control Plane
              │                               │
      Authenticated user APIs       Users / SSO / Support /
              │                    Platform / Security / Audit
              └───────────────┬───────────────┘
                              │
                         VexaAccount API
                              │
             ┌────────────────┼─────────────────┐
             │                │                 │
         VexaTrade        VexaStore       Future apps
```

The user frontend and Super Admin frontend are separate clients of the backend. The backend remains authoritative for authentication, authorization, persistence and security-sensitive state.

---

## 3. Canonical User Account Center runtime

The active user frontend has one Account Center runtime path:

```text
index.html
   │
   ├── account authentication/session bootstrap
   ├── account-center-fetch-guard.js
   ├── sso-frontend.js
   ├── account-center-loader.js
   │       ├── account-center-runtime-v2.js
   │       ├── account-center-v2-compat.js
   │       └── account-center-premium-theme.js
   └── notification-live-runtime.js
```

`account-center-runtime-v2.js` is the canonical Account Center implementation. Superseded duplicate runtimes and patch files were removed after verifying that they were not part of the active entrypoint.

### User workflow areas

- Login
- Registration
- Email verification
- Login 2FA
- Forgot password
- Reset password
- Personal information
- Security
- Privacy & data
- Password
- Your devices / active sessions
- Connected applications
- Notifications
- People & sharing
- Verification
- Account activity
- Account recovery
- Help & support
- Account deletion

All security-sensitive mutations remain backend-backed.

---

## 4. Canonical Super Admin runtime

The Super Admin frontend now uses a single Owner runtime:

```text
index.html
   │
   ├── owner-console-runtime.js
   └── owner-control-center-loader.js
             └── owner-control-center.js
```

The loader waits for the authenticated Owner shell before injecting the integrated Owner Control Center. This avoids the previous runtime race where the control surface could be mounted and then replaced during session hydration.

The superseded Super Admin `app.js`, SSO patch scripts, user-management patch runtime, support patch runtime, duplicate notification React runtime and unused control modules were removed from the source tree.

---

## 5. Super Admin Owner Control — start to finish

### A. Sign in

1. Open the deployed Super Admin application.
2. Sign in with the configured Super Admin credentials.
3. The backend creates the HTTP-only Super Admin session.
4. The canonical Owner runtime loads registry and audit state.
5. Owner API requests use authenticated backend authorization.

### B. User Management

Open **Owner Control Center → Users**.

Supported actions include:

- search users
- inspect safe account details
- edit supported profile fields
- enable/disable account
- reset supported 2FA enrollment
- reset supported passcode enrollment
- revoke all user SSO sessions
- inspect SSO/security events
- inspect storage metadata
- adjust supported credits/coin values with a reason
- add Owner notes
- permanently delete a user through the dedicated destructive flow

Sensitive credential hashes are not returned by the Owner user-detail query.

### C. User security containment

```text
Owner → Users → select account
      ↓
Review security events
      ↓
Revoke sessions
      ↓
Reset supported 2FA/passcode controls if required
      ↓
Disable account if necessary
      ↓
Review audit trail
```

### D. Application Management

For each SSO client the Owner can:

- create application
- inspect registration
- configure exact redirect URIs
- grant supported scopes
- activate/disable
- rotate Client Secret
- permanently revoke
- inspect SSO/audit activity

### E. Redirect URI allowlist

```text
GET    /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
```

At least one redirect URI is required. Production callbacks use exact HTTPS values; localhost is allowed for development.

### F. Support and notification

```text
User creates support ticket
        ↓
Owner lists/opens ticket
        ↓
Owner replies
        ↓
Reply + user notification are persisted
        ↓
User notification runtime polls the authenticated API
        ↓
Unread notification appears in Account Center
        ↓
User can mark notifications read
```

The Owner reply path persists the support message, changes the ticket to `pending_user`, creates the notification, and commits those operations together. The user frontend polls the notification API while visible and refreshes when the application becomes visible or authentication changes.

### G. Platform Control

```text
GET /api/owner/platform/settings
PUT /api/owner/platform/settings/:key
GET /api/owner/platform/health
GET /api/owner/platform/integration/:clientId
GET /api/owner/platform/scopes
```

These are explicit, validated controls and are not arbitrary code-execution interfaces.

---

## 6. VexaAccount SSO contract

Discovery:

```text
GET /api/sso/.well-known/openid-configuration
```

Main endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/sso/.well-known/openid-configuration` | GET | SSO discovery |
| `/api/sso/authorize` | GET | Authorization-code request |
| `/api/sso/token` | POST | Code exchange / refresh |
| `/api/sso/userinfo` | GET | Identity claims |
| `/api/sso/logout` | POST | Refresh-token revocation |

Supported scopes:

```text
openid
profile
email
account
session
applications
notifications
```

The requested scopes must be supported and granted to the client.

---

## 7. External application SSO flow

Every external application gets its own SSO client registration.

```text
Owner
 │
 ├── Create client
 ├── Add exact redirect URI
 ├── Grant scopes
 └── Activate client
        │
        ▼
External App Backend
 │
 ├── generate state
 ├── generate PKCE verifier
 ├── create S256 challenge
 └── redirect browser to VexaAccount
        │
        ▼
VexaAccount /authorize
 │
 ├── authenticate user
 ├── validate client
 ├── validate exact redirect URI
 ├── validate scopes
 └── issue one-time authorization code
        │
        ▼
External App /callback
 │
 ├── validate state
 ├── exchange code + verifier server-side
 ├── receive access + refresh tokens
 ├── call /userinfo
 ├── map stable `sub`
 └── create the external application's local session
```

Client Secrets never belong in browser code or browser storage.

---

## 8. External application environment contract

Each external application's backend uses exactly these VexaAccount-specific variables:

```env
VEXA_ACCOUNT_CLIENT_SECRET=THE_SECRET_ISSUED_BY_VEXAACCOUNT
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"YOUR_CLIENT_ID","redirectUri":"https://your-app.example.com/auth/vexaaccount/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

`VEXA_ACCOUNT_CLIENT_SECRET` is server-only. `VEXA_ACCOUNT_SSO_CONFIG` contains non-secret connection configuration and must never contain `clientSecret`.

The external backend reference implementation is under:

```text
integrations/vexaaccount-node-backend/
├── .env.example
├── README.md
└── src/
    ├── vexaaccount-sso.js
    └── routes/vexaaccount-auth.js
```

---

## 9. Client Secret security boundary

The canonical Owner runtime has one deliberate secret display path:

```text
POST /api/sso-registry/applications
        or
POST /api/sso-registry/applications/:clientId/rotate-secret
        ↓
backend generates secret
        ↓
backend returns secret once
        ↓
Owner UI displays it transiently
        ↓
Owner transfers it to external backend
```

The secret is not persisted in browser storage, URLs, logs, PDFs or `VEXA_ACCOUNT_SSO_CONFIG`. The backend stores only the secret hash and the secret is not recoverable from the registry.

Repository CI explicitly checks that the canonical Owner runtime does not contain legacy `clientJWT`/`clientJwt` aliases or browser-storage/URL use for the Client Secret.

---

## 10. Database source of truth

The backend is authoritative for:

- user identity
- passwords and authentication state
- OTPs
- SSO clients and credentials
- redirect allowlists
- scopes
- SSO sessions/tokens/consents
- account settings/preferences/privacy
- notifications
- support tickets/messages
- Owner actions
- audit/security records
- platform settings

Frontend state is presentation state and is never treated as authoritative security state.

---

## 11. Production verification

The repository now contains separate source/static verification and authenticated production E2E tooling:

```text
scripts/e2e-production-smoke.js
scripts/e2e-support-notification.js
.github/workflows/verify.yml
.github/workflows/vexaaccount-e2e.yml
```

### Static verification

CI checks:

- backend JavaScript syntax
- user frontend JavaScript syntax
- Super Admin JavaScript syntax
- canonical user entrypoint
- canonical Owner entrypoint
- obsolete runtime/source-tree cleanup
- Client Secret handling contract
- root redirect contract

The current canonical verification run for commit `6bb6c8f7f7b6d2618ff4a92e04cb47644610e6f3` completed successfully. citeturn352file0

### Authenticated support/notification E2E

The authenticated E2E script verifies:

```text
User login
→ User session
→ Create support ticket
→ Owner login
→ Owner sees ticket
→ Owner replies
→ User notification created
→ User reads notification API
→ Mark notifications read
→ Owner closes ticket
→ Owner audit trail contains reply
```

The workflow requires four dedicated GitHub Actions secrets:

```text
VEXA_E2E_USER_EMAIL
VEXA_E2E_USER_PASSWORD
VEXA_E2E_OWNER_EMAIL
VEXA_E2E_OWNER_PASSWORD
```

If those secrets are not configured, the authenticated test is deliberately skipped instead of falsely reporting production certification.

---

## 12. Production deployment sequence

```text
1. Change code
2. Commit to master
3. Run syntax/contract checks
4. Deploy backend
5. Run database migrations
6. Verify /api/health
7. Deploy user frontend
8. Deploy Super Admin frontend
9. Verify login
10. Verify Account Center
11. Verify Owner controls
12. Verify SSO discovery
13. Run authenticated SSO/support E2E
14. Review audit/security events
```

Source-level completion does not automatically mean the deployed Render services have completed the live E2E. The authenticated production test must actually execute against the deployed environment with its dedicated test credentials and real database.

---

## 13. Security model

### Secrets

Never expose:

- `VEXA_ACCOUNT_CLIENT_SECRET`
- `JWT_SECRET`
- database credentials
- SMTP credentials
- access tokens
- refresh tokens

### Redirect URIs

Use exact registered callback URIs. Do not use wildcard production callbacks.

### PKCE

Use S256 PKCE for authorization-code requests.

### State

Generate and validate state on the backend.

### Identity mapping

Use `userinfo.sub` as the stable external identity key. Email and display name can change.

### Owner controls

Owner actions are explicit, validated and auditable. The browser is never granted arbitrary SQL/shell/source-code execution capability.

---

## 14. Current cleanup state

The source-tree cleanup requested for the canonical runtime architecture is complete for the user and Super Admin frontend entrypoints.

Removed superseded categories include:

```text
Super Admin:
- legacy app.js runtime
- SSO control/creation/integration patches
- obsolete SSO receipt security patch
- old user-management patch runtime
- old support/platform patch runtimes
- duplicate React notification components/runtime
- obsolete control-plane/user-delete patch modules

User frontend:
- duplicate Account Center runtime
- Account Center runtime bridge/fix/hotfix/metrics/network/stability patches
- duplicate workflow/action/enhancement patches
- superseded auth runtime copies
- unused React Account Center runtime
- unused React notification runtime
- unused VexaTrade toast runtimes

Repository root:
- duplicate root Account Center loader/fetch-guard/metrics files
- root now redirects to the canonical user frontend
```

The remaining backend route modules are intentional backend boundaries, not duplicate browser runtimes.

---

## 15. Documentation map

- `README.md` — repository-wide architecture and operational contract
- `README_OWNER_CONTROL_CENTER.md` — Owner Control Center details
- `docs/OWNER_CONTROL_CENTER.md` — Owner architecture and control boundaries
- `docs/SSO_INTEGRATION.md` — SSO contract
- `docs/VexaAccount-SSO-Frontend-Integration.md` — frontend SSO integration
- `integrations/vexaaccount-node-backend/README.md` — external backend integration
- `frontend-VexaAccount-user/README.md` — canonical user frontend
- `frontend-VexaAccount-Super-admin/README.md` — canonical Owner frontend

---

## 16. Operational truth

The repository now has consolidated active frontend runtimes, explicit Owner controls, backend-backed Account Center workflows, SSO redirect management, a defined Client Secret boundary, live user notification polling, authenticated support/notification E2E tooling and CI enforcement for the cleanup/security contracts.

**Live production certification remains an execution result, not a source-code claim.** When the dedicated E2E credentials are configured, the production workflow is the mechanism that certifies the actual deployed user → Owner → notification → audit path.
