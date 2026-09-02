# VexaAccount

VexaAccount is the central identity, authentication, account-management and SSO platform for the Vexa ecosystem. It provides user authentication and recovery, a full Account Center, application registration, authorization-code SSO with S256 PKCE, SSO session lifecycle, Super Admin Owner controls, platform settings and audit/security records.

**Repository default branch:** `master`

**Current API service:** `https://api-vexaaccount.onrender.com`

> **Important production boundary:** source changes in this repository are deploy-time changes. The Super Admin Control Plane exposes explicit, validated controls; it does not execute arbitrary JavaScript, SQL, shell commands or source-file edits from the browser.

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
│   └── User authentication + Account Center
├── frontend-VexaAccount-Super-admin/
│   └── Super Admin Owner Control Plane
├── integrations/
│   └── vexaaccount-node-backend/
│       ├── .env.example
│       ├── README.md
│       └── src/
│           ├── vexaaccount-sso.js
│           └── routes/vexaaccount-auth.js
├── scripts/
│   └── e2e-production-smoke.js
├── .github/workflows/
│   └── vexaaccount-e2e.yml
└── README.md
```

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

The user frontend and Super Admin frontend are separate clients of the backend. The backend remains the source of truth for authentication, authorization, persistence and security-sensitive state.

---

## 3. Account Center runtime consolidation

The user Account Center now has one canonical runtime orchestration path:

```text
index.html
   │
   ├── authentication/session bootstrap
   │
   └── account-center-loader.js
             │
             ├── account-center-runtime-v2.js   ← canonical Account Center runtime
             ├── account-center-v2-compat.js    ← compatibility mapping
             └── account-center-full-workflows.js ← supported workflow controller
```

The loader owns runtime ordering and prevents duplicate Account Center runtime injection. The previous direct `account-center-full-workflows.js` entrypoint was removed from `index.html`; it is loaded by the canonical loader after the primary runtime.

Authentication UI remains separate from Account Center UI. `app-v3.js` is the authentication page runtime; it is not a second Account Center runtime.

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

All security-sensitive mutations must be backed by the backend API rather than frontend-only state.

---

## 4. Super Admin runtime consolidation

The Super Admin entrypoint now loads the primary Owner console runtime rather than a chain of SSO/user/support patch scripts.

```text
index.html
   │
   ├── app.js                       ← core Owner authentication + registry console
   ├── owner-control-center.js      ← canonical Owner control surface
   ├── owner-control-center.css
   └── shared notification/premium UI
```

The old patch scripts remain in the repository only as historical/source artifacts and are no longer entrypoints in the Super Admin HTML runtime. This prevents multiple scripts from competing to redefine the same control-plane behavior.

The Owner Control Center provides the supported explicit controls for users, SSO applications and support. Platform controls remain backend-backed through `/api/owner/platform` and should be exposed only through explicit platform-control UI/API actions.

---

## 5. Super Admin Owner Control — start to finish

### A. Sign in

1. Open the deployed Super Admin application.
2. Sign in with the configured Super Admin credentials.
3. The backend creates the Super Admin session.
4. The console loads the application registry and audit state.
5. All Owner API requests are authenticated and audited.

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

When an account is compromised:

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

Open **Owner Control Center → SSO & Applications** or the application registry.

For each client the Owner can:

- create application
- inspect registration
- configure exact redirect URIs
- grant supported scopes
- approve/activate
- disable
- rotate Client Secret
- revoke permanently
- inspect SSO/audit activity

### E. Redirect URI allowlist

Redirect URIs are an explicit server-side allowlist.

```text
GET    /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
```

At least one redirect URI is required. Production callbacks should use HTTPS and exact matching. Localhost is allowed only for local development.

### F. Support Center

Open **Owner Control Center → Support**.

Owner workflow:

```text
List tickets
   ↓
Open ticket
   ↓
Read conversation
   ↓
Reply
   ↓
Set status: open / pending_user / closed
   ↓
User receives a VexaAccount notification
```

### G. Platform Control

Supported platform APIs are:

```text
GET /api/owner/platform/settings
PUT /api/owner/platform/settings/:key
GET /api/owner/platform/health
GET /api/owner/platform/integration/:clientId
GET /api/owner/platform/scopes
```

These APIs provide controlled configuration and health operations. They are not a generic code-execution interface.

---

## 6. VexaAccount SSO contract

Discovery:

```text
GET https://api-vexaaccount.onrender.com/api/sso/.well-known/openid-configuration
```

Main endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/sso/.well-known/openid-configuration` | GET | SSO discovery |
| `/api/sso/authorize` | GET | Authorization-code request |
| `/api/sso/token` | POST | Code exchange / refresh |
| `/api/sso/userinfo` | GET | Identity claims |
| `/api/sso/logout` | POST | Refresh-token revocation |

Supported scopes currently include:

```text
openid
profile
email
account
session
applications
notifications
```

A client's requested scopes must be supported and granted to that client.

---

## 7. External application SSO — exact integration flow

Every other application gets its **own** SSO client registration.

```text
Super Admin
   │
   ├── Create client
   ├── Add exact redirect URI
   ├── Grant scopes
   └── Activate client
          │
          ▼
Other App Backend
   │
   ├── generate state
   ├── generate PKCE verifier
   ├── create S256 challenge
   └── redirect browser to VexaAccount
          │
          ▼
VexaAccount /authorize
   │
   ├── authenticate VexaAccount user
   ├── validate client
   ├── validate exact redirect URI
   ├── validate scopes
   └── issue one-time authorization code
          │
          ▼
Other App /callback
   │
   ├── validate state
   ├── exchange code + verifier server-side
   ├── receive access + refresh tokens
   ├── call /userinfo
   ├── map stable `sub` to local user
   └── create the application's own session
```

Never make the browser responsible for Client Secret handling.

---

## 8. Other application backend — required files

A reference implementation is included at:

```text
integrations/vexaaccount-node-backend/
├── .env.example
├── README.md
└── src/
    ├── vexaaccount-sso.js
    └── routes/
        └── vexaaccount-auth.js
```

Copy the **pattern**, not VexaAccount's database/authentication source.

### Backend files the other app should have

```text
other-app-backend/
├── .env                       # never commit
├── .env.example
├── package.json
├── server.js                  # existing server
└── src/
    ├── vexaaccount-sso.js     # SSO client
    ├── routes/
    │   └── vexaaccount-auth.js
    └── ...application code...
```

The other app must provide its own session middleware and its own `findOrCreateUserFromVexaAccount()` mapping.

---

## 9. Exactly two VexaAccount environment variables for other app backends

For each other application's **Render Web Service backend**, add exactly these VexaAccount-specific variables:

### 1. `VEXA_ACCOUNT_CLIENT_SECRET`

```env
VEXA_ACCOUNT_CLIENT_SECRET=THE_SECRET_ISSUED_BY_VEXAACCOUNT
```

This is secret and server-only.

### 2. `VEXA_ACCOUNT_SSO_CONFIG`

```env
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"YOUR_CLIENT_ID","redirectUri":"https://your-app.example.com/auth/vexaaccount/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

This is non-secret.

**Never do this:**

```env
VEXA_ACCOUNT_SSO_CONFIG={"url":"...","clientId":"...","clientSecret":"..."}
```

The Client Secret must never appear in `VEXA_ACCOUNT_SSO_CONFIG`, frontend code, browser storage, public source, screenshots or logs.

### Render setup

```text
Other App Render Web Service
│
├── VEXA_ACCOUNT_CLIENT_SECRET = secret from Owner
└── VEXA_ACCOUNT_SSO_CONFIG    = non-secret JSON configuration
```

Save and redeploy the backend after changing these variables.

---

## 10. External backend implementation details

### Login

The backend generates:

- cryptographically random `state`
- cryptographically random PKCE verifier
- S256 challenge

It stores `state` and the verifier server-side and redirects the browser to `/api/sso/authorize`.

### Callback

The backend must:

1. receive `code` and `state`
2. reject missing values
3. compare state against the server-side value
4. expire the stored state
5. exchange the code with `client_secret` and `code_verifier`
6. request `/api/sso/userinfo`
7. require `userinfo.sub`
8. map `sub` to the local application user
9. create the application's own session
10. store tokens server-side when required

### Refresh

Use:

```text
POST /api/sso/token
```

with `grant_type=refresh_token`, Client ID, Client Secret and refresh token. Persist the newly returned refresh token because refresh-token rotation invalidates the old one.

### Logout

Revoke the VexaAccount refresh token through `/api/sso/logout`, then destroy the application's local session.

---

## 11. User guidance

A normal VexaAccount user should use the user application, not the Super Admin panel.

### Account lifecycle

```text
Register
  ↓
Receive verification code
  ↓
Verify email
  ↓
Sign in
  ↓
Account Center
```

### Password recovery

```text
Forgot password
  ↓
Enter email
  ↓
Receive secure reset link
  ↓
Open reset page
  ↓
Set new password
  ↓
Sign in again
```

### Account Center

Users can manage their supported profile, security, privacy, sessions, connected applications, notifications, sharing/recovery preferences, support tickets and account lifecycle from the Account Center.

### Security advice

- Use a unique password.
- Enable available 2FA controls.
- Review active sessions.
- Revoke unfamiliar connected sessions/applications.
- Keep recovery information current.
- Never share an OTP or Client Secret with support staff or another user.

---

## 12. Database and API source of truth

The backend is authoritative for:

- user identity
- passwords and authentication state
- OTPs
- SSO clients
- client credentials
- redirect allowlists
- scopes
- SSO sessions
- connected-app consent
- account settings
- notifications
- support tickets/messages
- owner actions
- audit/security records
- platform settings

Frontend state is presentation state and must not be treated as authoritative security state.

---

## 13. Production deployment sequence

For a VexaAccount source update:

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
13. Run external-app SSO E2E
14. Review audit/security events
```

Render web services should bind their public server to the configured `PORT` and can use HTTP health checks for application-level readiness. citeturn1search2turn1search1

---

## 14. Production E2E certification

The repository now includes:

```text
scripts/e2e-production-smoke.js
.github/workflows/vexaaccount-e2e.yml
```

The smoke harness verifies the deployed service health, SSO discovery and protection of authenticated Owner/user endpoints. The workflow can run manually or on its scheduled interval.

### What this does NOT claim

A source repository cannot honestly certify a complete authenticated production SSO journey without executing against the deployed services with a real test user, real active SSO client, real redirect endpoint and database.

A complete release certification requires exercising:

```text
Super Admin login
→ create/configure client
→ redirect allowlist
→ activate client
→ VexaAccount user login
→ authorization request
→ callback
→ state validation
→ token exchange
→ userinfo
→ local user mapping
→ local session
→ refresh rotation
→ logout/revocation
→ disabled-client behavior
→ user session revocation
→ support reply
→ Owner audit trail
```

The scheduled smoke workflow is therefore a repeatable production guard, while the full authenticated E2E remains an execution requirement for each real deployed integration environment.

---

## 15. Security model

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

Use S256 PKCE for every authorization-code request.

### State

Generate and validate state on the backend. Never trust a callback state value merely because it exists.

### Identity mapping

Use `userinfo.sub` as the stable external identity key. Email and display name can change.

### Owner controls

Owner actions are explicit, validated and auditable. The browser is never granted arbitrary SQL/shell/source-code execution capability.

---

## 16. Troubleshooting

### Redirect URI rejected

Compare the callback URL character-for-character with the application's registered redirect URI.

### Invalid client / secret

Confirm:

```text
VEXA_ACCOUNT_SSO_CONFIG.clientId
VEXA_ACCOUNT_CLIENT_SECRET
application status = active
```

If the secret was rotated, replace the old value in the other application's Render backend.

### User authenticated but other app is not logged in

The other application must create its own local session after successful `/userinfo`. VexaAccount supplies the identity and SSO tokens; it does not automatically create a session in an unrelated application.

### Old secret cannot be recovered

This is intentional. Rotate the client secret from Super Admin and redeploy the other backend with the replacement value.

### Owner endpoint returns 401/403

Confirm the Super Admin session is valid and the account is present in the active Super Admin registry.

---

## 17. Current implementation commits

The latest implementation work includes these commit groups:

```text
4ae16454478e4b845914a8c6664d9c4e496f546f  feat(owner): add audited redirect URI allowlist controls
2ac966b0812f93b1b89e6cf14f64df14cd45d22d  feat(owner-ui): add redirect URI allowlist management
743aad2fadf5f7c723360fd763839d5b106a8a15  feat(owner-ui): add integrated Owner Control Center
5c408935a700cb48beb416f6cb4afe5ad8483c94  style(owner-ui): add Owner Control Center styling
7b7a3c44951ad04f750ba131ded54864c8ebe5bb  feat(owner-ui): load integrated Owner Control Center
654dc555027da72b54b2b0d7789df55a61dabfd0  fix(owner): protect user detail from secret-field exposure
d8fddd4b048bf5e4f2c218924084d6c4e11cff8c  docs(owner): document complete Owner Control Center architecture
fc16065a7b5dfb3a0c11572476fe3e9e5864ff8e  docs(sso): publish authoritative Owner and client integration guide
932721d0d739fd52250174b03dcb5c348cb4c29d  docs: add latest Owner Control Center README
```

Latest consolidation and integration commits added in this release:

```text
e5e10cea4c4f3c5de881ea7ceb0be23a2ee45c3d  refactor(owner-ui): consolidate super admin runtime entrypoint
2df25fb2f272392cd37275845db978ba96359ef8  refactor(account-center): make loader the canonical runtime orchestrator
fb831b4a52662fcf971434805d80d2a3dc3baccb  refactor(account-center): remove duplicate workflow runtime entrypoint
1716002a1c02731b50bdcd1c684c7b8b7d3a1571  feat(sso-template): add external backend environment template
febcfcfeffee2f8c14c36a82d2179477a1909cce  feat(sso-template): add secure VexaAccount SSO client
ec4b7bc0bcc2f7870c0b14ffa24d5a1aa4566b08  feat(sso-template): add complete Express SSO callback routes
e0d8e0bd8a30a05b74e719effde2da69b4d3c4be  docs(sso-template): document external backend integration structure
41f583edde42fe49e50558824222400bc5ee69b2  test(e2e): add deployed VexaAccount smoke certification harness
be577b2b3d4adc5dde715c72c99cd68846667478  ci(e2e): add production smoke verification workflow
```

Earlier Account Center workflow and runtime hardening commits remain part of the repository history, including the backend workflow routes, frontend workflow controller, request/cache guards and runtime refreshes.

---

## 18. Operational truth

This repository now contains the consolidated source architecture, explicit Owner controls, backend-backed user workflows, SSO redirect management, external backend integration templates, environment-variable guidance and repeatable production smoke checks.

**Source-complete does not equal live-certified.** Live certification is only complete after the deployed Render services and a real external application's callback endpoint have successfully executed the authenticated end-to-end flow described above.

That distinction is intentional: it prevents a source-only review from being incorrectly presented as proof that a production deployment, database, SMTP service, browser callback and external application are all currently healthy.

---

## 19. Related documentation

- `docs/OWNER_CONTROL_CENTER.md` — Owner architecture and supported control boundaries
- `docs/SSO_INTEGRATION.md` — detailed SSO integration contract
- `README_OWNER_CONTROL_CENTER.md` — Owner Control Center overview
- `integrations/vexaaccount-node-backend/README.md` — copy-safe external backend integration guide
- `integrations/vexaaccount-node-backend/src/vexaaccount-sso.js` — secure SSO client reference
- `integrations/vexaaccount-node-backend/src/routes/vexaaccount-auth.js` — Express login/callback/logout reference
- `scripts/e2e-production-smoke.js` — deployed smoke verification
- `.github/workflows/vexaaccount-e2e.yml` — scheduled/manual production smoke workflow
