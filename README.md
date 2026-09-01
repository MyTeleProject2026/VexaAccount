# VexaAccount

VexaAccount is the central identity, authentication, account-management and SSO platform for the Vexa ecosystem. It provides the user Account Center, authentication/recovery flows, application registration, OAuth/OIDC-style authorization-code SSO with S256 PKCE, application session lifecycle, Super Admin controls, user-account controls, platform settings and audit trails.

The repository contains the VexaAccount backend plus the VexaAccount user and Super Admin frontends. The SSO service is designed so VexaTrade, VexaStore, VexaTrade Ecosystem, MTP2026 App Launcher and future Vexa applications can use one VexaAccount identity without copying VexaAccount source code into each application.

> **Security boundary:** the Super Admin Control Plane can change supported runtime configuration, application registrations, scopes, redirect allowlists, application lifecycle state, credentials, sessions and user-account controls. It does **not** execute arbitrary source-code edits on the production server. Backend source-code changes remain deployment-controlled. This prevents the admin UI from becoming a remote-code-execution interface while still allowing the supported VexaAccount behavior to be controlled centrally.

---

## 1. Repository architecture

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
│   │   │   ├── account-center-completion.js
│   │   │   ├── account-profile.js
│   │   │   ├── account-change-flows.js
│   │   │   ├── account-security.js
│   │   │   ├── super-admin-auth.js
│   │   │   ├── owner-user-management.js
│   │   │   ├── owner-user-delete.js
│   │   │   └── owner-platform.js
│   │   └── services/
│   │       └── ssoClient.service.js
│   ├── database/migrations/
│   └── public/
├── frontend-VexaAccount-user/
│   └── User Account Center + authentication UI
├── frontend-VexaAccount-Super-admin/
│   └── Super Admin Control Plane
└── README.md
```

The backend mounts the principal API groups as follows:

```text
/api/auth
/api/auth/super-admin
/api/sso
/api/sso-registry
/api/account
/api/account/change
/api/account/security
/api/owner
/api/owner/users
/api/owner/platform
```

The backend currently reads `VEXA_ACCOUNT_ISSUER` for the SSO issuer and defaults to `https://api-vexaaccount.onrender.com` when the issuer is not explicitly supplied. fileciteturn49file0L2-L2

---

## 2. VexaAccount SSO model

Each connected application has its own SSO client registration.

```text
VexaAccount Super Admin
        │
        │ create / configure / approve
        ▼
SSO Application Registry
        │
        ├── Client ID
        ├── Client Secret (stored hashed; shown only at creation/rotation)
        ├── Redirect URI allowlist
        ├── Allowed scopes
        ├── Environment
        └── Lifecycle status
        │
        ▼
Other Vexa Application Backend (Render Web Service)
        │
        │ Authorization Code + S256 PKCE
        ▼
VexaAccount SSO API
        │
        ▼
VexaAccount User Identity
        │
        ▼
Other Application's own session
```

Do not reuse a Client ID, Client Secret or redirect URI between applications. VexaTrade, VexaStore, VexaTrade Ecosystem, MTP2026 App Launcher and every future application should have a separate registration.

---

## 3. Supported SSO endpoints

The SSO API is mounted under `/api/sso`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/sso/.well-known/openid-configuration` | GET | SSO/OIDC-style discovery metadata |
| `/api/sso/authorize` | GET | Start authorization-code flow; requires an authenticated VexaAccount session |
| `/api/sso/token` | POST | Exchange authorization code or rotate a refresh token |
| `/api/sso/userinfo` | GET | Return identity claims allowed by the access-token scopes |
| `/api/sso/logout` | POST | Revoke a supplied refresh token |

The discovery document advertises the authorization, token, userinfo and logout endpoints, `code` response type, `authorization_code` and `refresh_token` grants, S256 PKCE and the supported scopes. fileciteturn48file0L2-L2

---

## 4. SSO scopes

The current registry and SSO service support:

```text
openid
profile
email
account
session
applications
notifications
```

The Super Admin application registry validates requested scopes against this supported list and against the scopes granted to that particular client. fileciteturn47file0L2-L2

| Scope | Current purpose |
|---|---|
| `openid` | Identity subject used for SSO |
| `profile` | Name/profile/contact claims exposed by the SSO userinfo endpoint |
| `email` | Email and verification state |
| `account` | VexaAccount account identity claims |
| `session` | VexaAccount session-related claim |
| `applications` | Application-access claim |
| `notifications` | Notification-access claim |

**Full access** means all scopes explicitly granted to a client. It does not mean unrestricted database access. The integrating application's backend must still enforce its own authorization rules.

The current userinfo implementation only adds claims corresponding to the scopes present in the issued token. fileciteturn48file0L2-L2

---

## 5. Super Admin: complete application lifecycle

The Super Admin registry is the central application-control surface.

### Create

1. Open **Super Admin → Applications**.
2. Choose **Create application**.
3. Enter the application display name.
4. Set a unique application key using lowercase letters, numbers, `_` or `-`.
5. Select `production`, `staging` or `development`.
6. Add one or more exact redirect URIs.
7. Select only the scopes the application needs, or select all supported scopes for a deliberate full-access integration.
8. Save.
9. VexaAccount generates a unique Client ID and a random Client Secret.
10. The new client starts in `pending` status.
11. Save the secret immediately; the secret is not recoverable later.
12. Approve the application by changing it to `active`.

The current backend performs these validations and generates the credentials server-side. The Client Secret is stored as a hash and returned only from creation/rotation. fileciteturn47file0L2-L2 fileciteturn50file0L2-L2

### Edit

Super Admin can update the supported application metadata:

- display name
- environment
- owner label
- description
- redirect URI allowlist
- allowed SSO scopes

The application key and Client ID remain stable identifiers.

### Approve / enable / disable

The lifecycle states are:

```text
pending
active
disabled
maintenance
rejected
revoked
```

Changing an application to `active` enables the SSO client. Disabling, rejecting, putting a client into maintenance, or revoking it disables the SSO client and revokes its active VexaAccount SSO sessions. fileciteturn47file0L2-L2

### Rotate secret

Use **Rotate secret** when a secret may have been exposed or as part of credential rotation. The old secret stops being valid and the newly generated secret is returned once.

### Revoke/remove

Revoke permanently removes the client registration and cleans up its active SSO sessions, consents, refresh tokens and authorization codes. This is an administrative destructive action and is audited. fileciteturn47file0L2-L2

### Integration setup

The Super Admin frontend includes an **Integration setup** control. It retrieves a safe deployment configuration for the selected client and separates the two Render environment variables. The safe configuration endpoint never attempts to recover the client secret.

---

## 6. Required Render backend environment variables for every other Vexa app

Every integrating application's **backend Render Web Service** should receive exactly these two VexaAccount-specific variables.

### 6.1 `VEXA_ACCOUNT_CLIENT_SECRET`

This is the Client Secret generated by VexaAccount Super Admin.

```env
VEXA_ACCOUNT_CLIENT_SECRET=vxs_REPLACE_WITH_THE_GENERATED_SECRET
```

This value is secret. Never put it in:

- React/Vite public variables
- browser JavaScript
- HTML/CSS
- localStorage/sessionStorage
- a public Git repository
- client-side configuration
- screenshots or public logs

### 6.2 `VEXA_ACCOUNT_SSO_CONFIG`

This is non-secret connection configuration.

```env
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"vexa_vexatrade_xxxxxxxxxxxxxxxx","redirectUri":"https://your-app.example.com/auth/callback","scopes":["openid","profile","email","account","session","applications","notifications"],"timeoutMs":10000}
```

**Do not put `clientSecret` inside this JSON.** The secret belongs only in `VEXA_ACCOUNT_CLIENT_SECRET`.

The Super Admin integration-config endpoint returns this separation explicitly and marks the secret as non-recoverable. fileciteturn70file0L2-L2

### Render setup

In the other application's Render Web Service:

```text
Environment
├── VEXA_ACCOUNT_CLIENT_SECRET = generated secret
└── VEXA_ACCOUNT_SSO_CONFIG    = generated non-secret JSON configuration
```

Save the variables and redeploy that backend.

The other application can also have its own unrelated session/JWT secret, database variables and service configuration. Do not put those application-specific secrets into `VEXA_ACCOUNT_SSO_CONFIG`.

---

## 7. No per-app VexaAccount source-code modification

The intended integration boundary is:

```text
VexaAccount repository
        │
        │ public SSO API
        ▼
Other application repository
        │
        ├── VexaAccount SSO config loader
        ├── SSO login route
        ├── callback route
        ├── state + PKCE storage
        ├── token exchange
        ├── userinfo mapping
        └── application-owned session
```

The other application does **not** copy `backend/src/routes/sso.js`, the VexaAccount database migrations, or VexaAccount authentication source into its own repository.

The VexaAccount API contract is the integration boundary.

---

## 8. Complete authorization flow for VexaTrade, VexaStore, VexaTrade Ecosystem, MTP2026 App Launcher and future apps

```text
User opens connected application
        │
        ▼
"Continue with VexaAccount"
        │
        ▼
Other app backend creates:
  • random state
  • PKCE verifier
  • PKCE S256 challenge
        │
        ▼
Browser → VexaAccount /api/sso/authorize
        │
        ├── VexaAccount session missing → user signs in
        │
        └── VexaAccount session valid → authorization continues
        │
        ▼
VexaAccount validates:
  • client_id
  • active client
  • exact redirect URI
  • requested scopes
  • state presence
  • S256 PKCE parameters
        │
        ▼
VexaAccount issues short-lived authorization code
        │
        ▼
Browser → other app /auth/callback?code=...&state=...
        │
        ▼
Other app validates state
        │
        ▼
Other app backend POSTs /api/sso/token
        │
        ├── client_id
        ├── client_secret
        ├── code
        ├── redirect_uri
        └── code_verifier
        │
        ▼
VexaAccount validates code + redirect URI + PKCE
        │
        ▼
Access token + refresh token
        │
        ▼
Other app backend → /api/sso/userinfo
        │
        ▼
Map VexaAccount subject (`sub`) to local user
        │
        ▼
Create the other application's secure session
        │
        ▼
User is signed in
```

The VexaAccount token endpoint uses a one-time authorization code, validates the registered redirect URI, checks S256 PKCE, creates a VexaAccount SSO session, issues a one-hour access token and a refresh token with a 30-day lifetime. Refresh-token rotation revokes the old refresh token before issuing its replacement. fileciteturn48file0L2-L2

---

## 9. Minimal integrating-backend implementation

The following is the intended shape. Adapt it to the existing framework of each application rather than replacing the application's architecture.

### Config loader

```js
function loadVexaAccountConfig() {
  const raw = process.env.VEXA_ACCOUNT_SSO_CONFIG;
  const secret = process.env.VEXA_ACCOUNT_CLIENT_SECRET;

  if (!raw) throw new Error('VEXA_ACCOUNT_SSO_CONFIG is required');
  if (!secret) throw new Error('VEXA_ACCOUNT_CLIENT_SECRET is required');

  const config = JSON.parse(raw);
  if (!config.url || !config.clientId || !config.redirectUri) {
    throw new Error('VEXA_ACCOUNT_SSO_CONFIG requires url, clientId and redirectUri');
  }

  return {
    ...config,
    url: String(config.url).replace(/\/$/, ''),
    clientSecret: secret
  };
}
```

### Authorization URL

Generate a cryptographically random state and PKCE verifier on the backend. Store the verifier and state in the application's server-side session or another short-lived protected store.

```js
const url = new URL(config.url + '/api/sso/authorize');
url.searchParams.set('response_type', 'code');
url.searchParams.set('client_id', config.clientId);
url.searchParams.set('redirect_uri', config.redirectUri);
url.searchParams.set('state', state);
url.searchParams.set('code_challenge', challenge);
url.searchParams.set('code_challenge_method', 'S256');
url.searchParams.set('scope', config.scopes.join(' '));
```

### Token exchange

```js
const response = await fetch(config.url + '/api/sso/token', {
  method: 'POST',
  headers: {'Content-Type': 'application/json', Accept: 'application/json'},
  body: JSON.stringify({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier
  })
});
```

### Userinfo

```js
const userinfo = await fetch(config.url + '/api/sso/userinfo', {
  headers: {Authorization: `Bearer ${accessToken}`}
}).then(r => r.json());
```

Use `userinfo.sub` as the stable VexaAccount identity key. Email/name values can change and should not be used as the primary identity key.

---

## 10. User-side VexaAccount Account Center flow

The VexaAccount user frontend is separate from the Super Admin console and is responsible for the user's own account experience.

The current user frontend contains:

- Login
- Registration
- Email verification
- Login 2FA flow
- Forgot password
- Password reset
- OTP resend/recovery messaging
- Authenticated Account Center
- Profile/personal information
- Security
- Preferences
- Sessions/devices
- Connected applications
- Notifications
- Account/privacy controls
- Storage and credits views where supported by the backend

The frontend uses the VexaAccount authentication token for authenticated API requests and has an authenticated session bootstrap path. The backend's `/api/auth/session` endpoint accepts the VexaAccount session cookie or a `Bearer` token and returns the active user when the token represents an active user account. fileciteturn49file0L2-L2

Email and password change operations are backend-backed step flows: current credentials are validated, an OTP is issued, and the final update occurs only after OTP verification. Password changes also revoke existing SSO sessions. fileciteturn47file0L2-L2

---

## 11. Super Admin user-account control

Super Admin is not limited to application registration. The Owner API exposes supported account-management controls for VexaAccount users.

### User discovery

```text
GET /api/owner/users
GET /api/owner/users/:id
```

The user detail endpoint can return the account, credit balance, SSO sessions, security events, storage metadata and administrator notes. fileciteturn56file0L2-L2

### Profile controls

Super Admin can update supported user profile fields including:

- email
- name
- first name
- last name
- gender
- date of birth
- country
- avatar URL

### Account status

Super Admin can enable or disable an account. Disabling the account also revokes its active VexaAccount SSO sessions. fileciteturn56file0L2-L2

### Security controls

Supported controls include:

- reset authenticator/email 2FA enrollment
- remove passcode enrollment when the current schema supports it
- revoke all VexaAccount SSO sessions

### Credits and coins

The Owner API supports audited credit-score and coin adjustments with an administrator-supplied reason.

### Storage

Supported controls include storage-record status changes and deletion of storage metadata records.

### Admin notes

Super Admin can add administrative notes to a user account.

### Account deletion

The repository also contains the dedicated Owner user-delete route. Destructive account deletion should remain an explicit, audited administrator action.

These controls are backend APIs, not client-only UI simulations. fileciteturn56file0L2-L2

---

## 12. Super Admin platform control

The Owner platform API provides a controlled runtime configuration layer.

```text
GET /api/owner/platform/settings
PUT /api/owner/platform/settings/:key
GET /api/owner/platform/health
GET /api/owner/platform/integration/:clientId
GET /api/owner/platform/scopes
```

The current database seeds supported platform settings for:

```text
ecosystem.scopes
ecosystem.sso.enabled
ecosystem.registration.mode
ecosystem.session.maxHours
```

These are persisted in `vexa_platform_settings`. fileciteturn64file0L2-L2

The Super Admin frontend exposes platform settings, ecosystem scopes, backend health and integration verification. fileciteturn65file0L2-L2

This is the safe mechanism for future runtime upgrades: add a supported setting/feature to the backend, then expose its configuration through the Control Plane. Do not implement an admin endpoint that accepts arbitrary JavaScript, SQL, shell commands or source-file paths.

---

## 13. Super Admin security and audit model

Registry administration is protected by Super Admin authentication and administrative audit middleware. The application registry audits actions such as:

```text
sso.registry.list
sso.application.create
sso.application.update
sso.application.status.update
sso.application.secret.rotate
sso.application.revoke
sso.application.integration_config
```

SSO authorization and token issuance also create security events associated with the user and client. fileciteturn47file0L2-L2 fileciteturn48file0L2-L2

Recommended production rules:

1. Use HTTPS everywhere.
2. Keep Client Secrets server-side only.
3. Register exact redirect URIs; do not use wildcard callbacks.
4. Request the smallest practical scope set.
5. Rotate exposed secrets immediately.
6. Disable/revoke compromised applications from Super Admin.
7. Revoke compromised user sessions.
8. Keep `JWT_SECRET` long, random and private.
9. Keep Render environment variables out of source control.
10. Review audit/security events regularly.

---

## 14. Current Render deployment variables for VexaAccount itself

The VexaAccount backend uses environment configuration for its own service. A maintained example is available in `backend/.env.example`.

Core values include:

```env
NODE_ENV=production
PORT=4000
DB_HOST=...
DB_PORT=4000
DB_USER=...
DB_PASSWORD=...
DB_NAME=vexaaccount
DB_SSL=true
JWT_SECRET=...
VEXA_ACCOUNT_ISSUER=https://api-vexaaccount.onrender.com
VEXA_SUPER_ADMIN_EMAIL=...
VEXA_SUPER_ADMIN_PASSWORD=...
CORS_ORIGINS=https://account.example.com,https://admin.account.example.com
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
```

The backend now accepts `CORS_ORIGINS` in addition to the explicit frontend and `VEXA_ALLOWED_ORIGINS` configuration, while still using exact-origin matching with credentials. fileciteturn49file0L2-L2

---

## 15. Application-specific SSO checklist

### VexaTrade

```text
[ ] Register VexaTrade in VexaAccount Super Admin
[ ] Register its exact production callback
[ ] Choose scopes
[ ] Approve the client
[ ] Copy Client Secret once
[ ] Add VEXA_ACCOUNT_CLIENT_SECRET to VexaTrade Render backend
[ ] Add VEXA_ACCOUNT_SSO_CONFIG to VexaTrade Render backend
[ ] Implement /auth/login and /auth/callback using the SSO API contract
[ ] Exchange code server-side
[ ] Call /api/sso/userinfo server-side
[ ] Map user by sub
[ ] Create VexaTrade's own session
[ ] Test logout/session expiry
```

### VexaStore

Use the same flow with a dedicated VexaStore Client ID, secret and redirect URI.

### VexaTrade Ecosystem

Use a dedicated client and only grant ecosystem scopes actually required by that service.

### MTP2026 App Launcher

Use a dedicated client and redirect URI for the launcher. The launcher should never embed the client secret in the desktop/mobile/web client.

### Future Vexa applications

The same registry and API contract applies. No VexaAccount database or authentication source-code copy is required.

---

## 16. What Super Admin can control centrally

| Control | Supported through current Control Plane/API |
|---|---|
| Create SSO application | Yes |
| Edit SSO application metadata | Yes |
| Manage redirect URIs | Yes |
| Choose allowed scopes | Yes |
| Approve application | Yes |
| Disable/enable application | Yes |
| Maintenance/rejection/revocation lifecycle | Yes |
| Rotate Client Secret | Yes |
| Generate deployment config | Yes; secret remains non-recoverable |
| Review SSO registry | Yes |
| Review SSO/admin audit | Yes |
| Review application integration status | Yes |
| Manage supported platform settings | Yes |
| Check backend/database health | Yes |
| Search/control VexaAccount users | Yes |
| Edit supported user profile fields | Yes |
| Enable/disable user | Yes |
| Reset supported 2FA/passcode enrollment | Yes |
| Revoke user's SSO sessions | Yes |
| Adjust supported credits/coins | Yes |
| Control storage metadata | Yes |
| Add admin notes | Yes |
| Delete user through dedicated Owner flow | Supported by backend route |
| Arbitrarily edit/execute backend source code from browser | **No — intentionally not supported** |
| Arbitrarily run SQL/shell/JavaScript from browser | **No — intentionally not supported** |

The final two restrictions are deliberate security boundaries. Supported behavior should be exposed as explicit, validated APIs and platform settings rather than as a generic code-execution console.

---

## 17. Future upgrades without changing every connected app

The SSO contract is intentionally centralized. A future VexaAccount upgrade can add capabilities at the service boundary, for example:

```text
New scope
New userinfo claim
New application lifecycle state
New security policy
New platform setting
New session policy
New notification capability
New account-management API
```

The Super Admin Control Plane can then expose the supported capability as an explicit control. Connected applications continue using the same Client ID/Secret and configuration unless the new feature requires a new scope or redirect URI.

For a **code-level** backend upgrade, the correct production flow is:

```text
Developer change
      ↓
Git commit / review / deployment
      ↓
Render deploy
      ↓
Database migration if required
      ↓
Health check
      ↓
Super Admin verifies runtime state
```

The Super Admin panel should never silently rewrite or execute arbitrary backend source files. This separation keeps the control plane powerful without turning it into a remote-code-execution system.

---

## 18. SSO lifecycle and failure handling

### Missing VexaAccount session

`/api/sso/authorize` requires a valid VexaAccount-authenticated session. If the user is not authenticated, the application should send the user through the normal VexaAccount login experience and then retry authorization.

### Invalid redirect URI

The SSO server rejects a callback URI that is not in the client's registered redirect allowlist. Redirect URIs must match exactly. fileciteturn48file0L2-L2

### Invalid scope

The requested scope must both be supported by VexaAccount and be granted to that client. fileciteturn48file0L2-L2

### PKCE failure

A code-verifier mismatch causes token exchange failure. The integrating backend must keep the verifier server-side and must not replace it with a client-provided arbitrary value.

### Expired/consumed authorization code

Authorization codes are short-lived and single-use. The token endpoint rejects expired or already-consumed codes. fileciteturn48file0L2-L2

### Disabled/revoked application

Super Admin lifecycle controls disable the client and revoke active SSO sessions when the application leaves the active state. fileciteturn47file0L2-L2

### Lost Client Secret

The secret is intentionally not recoverable. Rotate the client secret from Super Admin, then replace `VEXA_ACCOUNT_CLIENT_SECRET` in the application's Render backend and redeploy.

---

## 19. Troubleshooting

### `No session` from `/api/auth/session`

This response means the request did not contain a valid VexaAccount session cookie or Bearer token. The backend endpoint accepts either. It is not evidence that the database or SSO service is broken. fileciteturn49file0L2-L2

### SSO client authentication failed

Check:

```text
VEXA_ACCOUNT_CLIENT_SECRET
VEXA_ACCOUNT_SSO_CONFIG.clientId
application status = active
```

### Redirect URI rejected

Compare the URI in:

```text
VEXA_ACCOUNT_SSO_CONFIG.redirectUri
```

with the exact redirect URI registered in Super Admin.

### Scope rejected

Open Super Admin → Applications → Edit → Allowed SSO scopes and confirm that the requested scope is granted.

### Client Secret no longer works

If the secret was rotated, the old secret is invalid. Copy the new secret returned by the rotation operation into the application's Render backend.

### User signs in but the other app has no local session

The other application must create its own session after validating `userinfo.sub`. VexaAccount provides identity; it does not automatically create a session in an unrelated application's database.

---

## 20. Database migrations relevant to SSO and control plane

The repository contains migrations for the SSO core, security indexes, application sessions, client scope constraints, client credentials, Super Admin registry, lifecycle, platform settings and account-center controls.

Notable migrations include:

```text
001_sso_core.sql
002_sso_security_indexes.sql
003_sso_app_sessions.sql
005_sso_client_scope_constraints.sql
006_sso_client_credentials.sql
007_sso_admin_registry.sql
008_sso_registry_seed.sql
009_super_admins.sql
011_sso_application_lifecycle.sql
012_platform_and_account_center.sql
013_account_passcode_controls.sql
20260901_account_change_flows.sql
20260902_account_center_completion.sql
```

The lifecycle migration expands the registry status enum to the states used by the current Super Admin API. fileciteturn61file0L2-L2

---

## 21. Production integration rule

For every new Vexa application:

```text
1. Register one dedicated client in VexaAccount Super Admin.
2. Register exact callback URL(s).
3. Select least-privilege scopes.
4. Approve the client.
5. Copy the secret once.
6. Add VEXA_ACCOUNT_CLIENT_SECRET to the application's Render backend.
7. Add VEXA_ACCOUNT_SSO_CONFIG to the application's Render backend.
8. Keep both out of frontend/public code.
9. Implement authorization-code + S256 PKCE server-side.
10. Validate state.
11. Exchange the code server-side.
12. Read userinfo server-side.
13. Map `sub` to the application's local user.
14. Create the application's own secure session.
15. Test login, logout, refresh, disabled-client behavior and expired-code behavior.
16. Use Super Admin audit/security controls for ongoing lifecycle management.
```

This is the standard integration path for VexaTrade, VexaStore, VexaTrade Ecosystem, MTP2026 App Launcher and future Vexa applications.

---

## 22. Current implementation notes

The repository already contains the central SSO route, application registry, credential generator/rotation service, lifecycle database migration, Super Admin authentication, Owner user-management APIs, platform settings and both VexaAccount frontend control surfaces. fileciteturn43file0L2-L2

The Super Admin frontend now has dedicated SSO application editing and integration-setup controls, while the backend provides a safe non-secret configuration export. Client secrets remain creation/rotation-only credentials and are not recoverable from the registry.

The intended architecture is therefore:

```text
                     VexaAccount
                          │
          ┌───────────────┴────────────────┐
          │                                │
   User Account Center              Super Admin Control Plane
          │                                │
          │                         ┌──────┴────────┐
          │                         │               │
          ▼                         ▼               ▼
     User APIs                SSO Registry     Owner Controls
          │                         │               │
          └───────────────┬─────────┴───────────────┘
                          │
                          ▼
                 VexaAccount SSO API
                          │
       ┌──────────────────┼───────────────────┐
       ▼                  ▼                   ▼
   VexaTrade          VexaStore       Future Vexa Apps
```

The central SSO contract is the stable integration point; application-specific secrets and sessions stay inside each application's backend.
