# VexaAccount

VexaAccount is the central identity, authentication, account-management and SSO platform for the Vexa ecosystem. It owns authentication, identity, recovery, security-sensitive account state, SSO authorization and connected-application lifecycle. External applications should integrate with VexaAccount rather than rebuilding these identity workflows.

**Default branch:** `master`  
**Production API:** `https://api-vexaaccount.onrender.com`

> **Operational truth:** source completion and CI success do not equal live production certification. Live certification requires an actual successful execution against the deployed API/database with dedicated test credentials.

## Core principle for integrations

VexaAccount is the identity provider. A connected application is a relying party/client.

```text
VexaAccount
  ├── Login / Register
  ├── Email verification
  ├── Forgot / Reset Password
  ├── Help with Signing In / recovery
  ├── 2FA and security controls
  ├── Account Center
  ├── SSO authorization + consent
  ├── SSO token/session lifecycle
  └── Owner/Super Admin application registry
          │
          ▼
     Connected application
          ├── own application session
          ├── own database/data
          └── own application authorization
```

**Do not copy VexaAccount Login, Register, Forgot Password, verification or 2FA pages into an integrating application.** Use the canonical VexaAccount User frontend SSO bridge so users receive the same VexaAccount authentication and recovery experience.

## Repository structure

```text
VexaAccount/
├── backend/
│   ├── src/index.js
│   ├── src/routes/auth.js
│   ├── src/routes/sso.js
│   ├── src/routes/sso-registry.js
│   ├── src/middleware/ssoUserAuth.js
│   └── src/services/ssoClient.service.js
├── frontend-VexaAccount-user/
│   ├── index.html
│   └── src/sso-frontend.js
├── frontend-VexaAccount-Super-admin/
│   ├── owner-console-runtime.js
│   └── owner-control-center-loader.js
├── integrations/vexaaccount-node-backend/
├── scripts/
├── docs/
└── .github/workflows/
```

## Runtime architecture

```text
                 ┌──────────────────────────────┐
                 │      VexaAccount Backend     │
                 │ authentication / identity    │
                 │ SSO / sessions / registry    │
                 └──────────────┬───────────────┘
                                │
             ┌──────────────────┴──────────────────┐
             ▼                                     ▼
   VexaAccount User frontend              Owner/Super Admin frontend
   Login / Register / Recovery             Application registry/control
   Account Center / SSO bridge             Security / audit / operations
                                │
                                ▼
                         MySQL persistence
```

The backend is authoritative. Frontend state is presentation state only.

## Canonical User frontend SSO bridge

The canonical browser entry point for an external application is:

```text
https://<vexaaccount-user-host>/#/sso/authorize?client_id=...&redirect_uri=...&response_type=code&scope=openid%20profile%20email&state=...&code_challenge=...&code_challenge_method=S256
```

This route is implemented by `frontend-VexaAccount-user/src/sso-frontend.js`.

### Why external apps must use this route

The backend `/api/sso/authorize` endpoint is protected by the authenticated VexaAccount session. It is **not** a public login page. A direct unauthenticated call can correctly return `Authentication required`.

The User frontend bridge is the browser authentication layer:

```text
External application
  ↓
#/sso/authorize
  ↓
SSO continuation screen
  ↓
Not authenticated?
  ↓
VexaAccount Login / Register / Forgot Password / Help / verification / 2FA
  ↓
Authentication succeeds
  ↓
Pending SSO request is resumed
  ↓
Authenticated browser calls /api/sso/authorize
  ↓
Provider validates request and issues one-time code
  ↓
Browser returns to external application's exact callback
```

The pending authorization request is held in the User frontend session state during the authentication transition. The external application does not need to implement duplicate VexaAccount login/recovery screens.

## Complete external-application SSO workflow

### Phase 1 — Owner registers the application

1. Owner/Super Admin opens the SSO application registry.
2. Creates a unique application name/key.
3. Adds one or more exact redirect URIs.
4. Selects only the scopes the application needs.
5. Activates the client.
6. Receives the generated client ID and client secret.
7. Transfers the secret securely to the application's backend only.

Production redirect URIs must be exact HTTPS URLs. Wildcards are not supported for production callbacks.

### Phase 2 — Application starts SSO

The integrating backend creates a transaction containing:

```text
state       = cryptographically random value
verifier    = cryptographically random PKCE verifier
challenge   = BASE64URL(SHA256(verifier))
```

It then sends the browser to the User frontend SSO bridge with:

```text
client_id
redirect_uri
response_type=code
scope
state
code_challenge
code_challenge_method=S256
```

### Phase 3 — VexaAccount authenticates the user

The User frontend displays the requested access and uses the existing VexaAccount authentication experience when the user is signed out. Existing account creation, email verification, password recovery and 2FA remain VexaAccount-owned workflows.

### Phase 4 — Authorization

The authenticated browser reaches:

```text
GET /api/sso/authorize
```

VexaAccount validates:

- `response_type=code`
- `client_id`
- exact registered `redirect_uri`
- `state`
- `code_challenge`
- `code_challenge_method=S256`
- requested scopes
- client active status
- requested scopes are both supported and allowed for that client

VexaAccount creates a short-lived, one-time authorization code and records the authorization/consent/security event.

### Phase 5 — Callback and token exchange

The browser is redirected to:

```text
https://external-app.example.com/auth/callback?code=...&state=...
```

The **external application's backend** must:

1. Validate `state` against its stored login transaction.
2. Retrieve the original PKCE verifier.
3. POST to VexaAccount `/api/sso/token`.
4. Authenticate with its client secret.
5. Send the same exact redirect URI.
6. Send the PKCE verifier.
7. Receive an access token and refresh token.
8. Call `/api/sso/userinfo` with the access token.
9. Map `userinfo.sub` to its own local user identity.
10. Create its own application session.

The client secret, access token and refresh token must remain server-side.

## SSO endpoints

```text
GET  /.well-known/openid-configuration
GET  /api/sso/authorize
POST /api/sso/token
GET  /api/sso/userinfo
POST /api/sso/logout
```

Discovery advertises authorization-code SSO, refresh-token grant, S256 PKCE and `client_secret_post` token endpoint authentication.

## Available scopes — complete reference

The current provider supports exactly:

```text
openid
profile
email
account
session
applications
notifications
```

### `openid`

**Grants:** the core OpenID-style identity contract, including the stable `sub` subject used to identify the VexaAccount user.

**Why:** an identity/SSO client needs a stable subject to map the authenticated VexaAccount account into its own user table.

**Typical use:** virtually every user-login integration should request `openid`.

**Does not mean:** access to all account/profile data.

### `profile`

**Grants through `userinfo`:**

```text
name
given_name
family_name
picture
phone_number
country
```

**Why:** lets an application display the user's VexaAccount profile information without asking the user to re-enter it.

**Use when:** the application needs profile/display information.

**Do not request when:** the application only needs a stable `sub` and does not use profile fields.

### `email`

**Grants through `userinfo`:**

```text
email
email_verified
```

**Why:** lets an application associate an email address with the account and know whether VexaAccount considers it verified.

**Use when:** email is required for application identity, communication or account matching.

**Do not request when:** the application can operate solely from `sub`.

### `account`

**Grants through `userinfo`:**

```text
account_id
vexa_account=true
```

**Why:** explicitly identifies that the client is using VexaAccount account-level identity semantics.

**Use when:** an integration needs an explicit VexaAccount account identifier/flag in addition to `sub`.

**Do not request when:** `sub` already provides everything the application needs.

### `session`

**Grants through `userinfo`:**

```text
vexa_session=true
```

**Why:** provides an explicit session-related claim to clients that have a feature requiring it.

**Use when:** the application contract explicitly depends on the VexaAccount SSO session claim.

**Do not request when:** the application simply needs its own local session. The provider session and application session are separate concepts.

### `applications`

**Grants through `userinfo`:**

```text
vexa_applications=true
```

**Why:** indicates that the connected-application capability/claim was granted.

**Use when:** an integration has a feature explicitly dependent on this VexaAccount application capability.

**Do not request when:** the application only needs basic identity.

### `notifications`

**Grants through `userinfo`:**

```text
vexa_notifications=true
```

**Why:** indicates that the VexaAccount notification capability/claim was granted.

**Use when:** the integration explicitly consumes VexaAccount notification-related capability.

**Do not request when:** the application has unrelated, application-owned notifications.

### Scope selection rule

**Least privilege is the default.** A normal application login often needs:

```text
openid profile email
```

A minimal identity-only integration may need only:

```text
openid
```

Add `account`, `session`, `applications` or `notifications` only when a real application feature requires the corresponding claim.

## How scopes are enforced

A scope must pass **both** checks:

```text
requested scope
      │
      ├── supported by VexaAccount?
      │       └── must be yes
      │
      └── allowed for this registered client?
              └── must be yes
```

Therefore adding a scope to an application's configuration alone is not sufficient. The Owner must also grant that scope to the registered SSO client.

### Example: adding `profile`

1. Owner opens the registered application.
2. Adds `profile` to its allowed scopes.
3. Application backend adds `profile` to its requested scope list.
4. Application starts a new authorization request.
5. VexaAccount issues a code containing the granted scope set.
6. Token exchange preserves that scope.
7. `userinfo` returns the profile claims.

The same process applies to every supported scope.

## Client registration and secret lifecycle

The SSO registry is Owner/Super Admin protected. It supports:

```text
GET    /api/sso-registry/scopes
GET    /api/sso-registry/applications
GET    /api/sso-registry/applications/:clientId
GET    /api/sso-registry/applications/:clientId/integration-config
POST   /api/sso-registry/applications
PATCH  /api/sso-registry/applications/:clientId
PATCH  /api/sso-registry/applications/:clientId/status
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/rotate-secret
DELETE /api/sso-registry/applications/:clientId
GET    /api/sso-registry/audit
```

Secrets are generated server-side, stored as hashes, and returned only at creation/rotation time. A secret cannot be recovered from the registry after that one-time delivery.

## Application status and containment

Registered clients use lifecycle statuses including:

```text
pending
active
disabled
maintenance
rejected
revoked
```

Only active clients can authorize/token-exchange successfully. Disabling or revoking a client also participates in session/consent containment so a compromised integration can be stopped centrally.

## Connected-application security boundary

```text
Browser
  │
  │ no client secret
  ▼
VexaAccount User frontend
  │
  │ authenticated browser session
  ▼
VexaAccount /api/sso/authorize
  │
  │ one-time code
  ▼
External application's backend
  │
  ├── client secret
  ├── PKCE verifier
  ├── access token
  └── refresh token
```

Never expose a client secret in:

- browser JavaScript
- `localStorage` / `sessionStorage`
- Vite `VITE_*` variables
- URLs/query parameters
- Git commits
- screenshots/logs
- client-side configuration files

## Canonical User runtime

```text
frontend-VexaAccount-user/index.html
  ├── auth/session bridges
  ├── account-center-fetch-guard.js
  ├── sso-frontend.js
  ├── account-center-loader.js
  ├── notification-live-runtime.js
  └── pwa.js
```

The User frontend covers Login, Register, email verification, 2FA, forgot/reset password, profile, security, privacy/data, password, devices/sessions, connected applications, notifications, people/sharing, verification, account activity/recovery, support and account deletion.

## Canonical Owner/Super Admin runtime

```text
frontend-VexaAccount-Super-admin/index.html
  ├── owner-console-runtime.js
  └── owner-control-center-loader.js
          └── owner-control-center.js
```

The Owner Control Plane is the administrative source for supported user controls, SSO application registration, exact redirect allowlists, scope grants, client activation/disablement, secret rotation, session containment, audit/security review, support and platform operations.

## Owner SSO workflow

```text
Owner login
  → SSO Applications
  → Create application
  → set application name/key
  → add exact HTTPS callback
  → select minimum required scopes
  → activate
  → securely deliver client secret to application's backend
  → application starts state + S256 PKCE
  → User frontend #/sso/authorize
  → VexaAccount authentication
  → /api/sso/authorize
  → authorization code
  → application /api/sso/token
  → application /api/sso/userinfo
  → local application session
```

## What an integrating application must implement

At minimum, the application needs:

```text
1. VexaAccount client ID
2. VexaAccount client secret (backend only)
3. Exact registered redirect URI
4. State generation + validation
5. PKCE verifier/challenge generation
6. Browser redirect to VexaAccount User frontend #/sso/authorize
7. Callback handling
8. Authorization-code exchange
9. Userinfo validation
10. Stable-subject user mapping
11. Its own application session
12. Safe logout/revocation handling
```

It does **not** need to implement a second VexaAccount password database or duplicate VexaAccount registration/recovery UI.

## Integration environment pattern

For a Node.js backend, use a server-only configuration such as:

```env
VEXA_ACCOUNT_CLIENT_SECRET=GENERATED_CLIENT_SECRET
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","userUrl":"https://<vexaaccount-user-host>","clientId":"YOUR_CLIENT_ID","redirectUri":"https://your-app.example.com/auth/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

`VEXA_ACCOUNT_SSO_CONFIG` is connection metadata. **Do not put `clientSecret` inside it.**

## Troubleshooting SSO

### `Authentication required`

The application called the protected provider authorization endpoint without an authenticated VexaAccount browser session. Start the browser at the User frontend `#/sso/authorize` bridge.

### `Invalid SSO client or redirect URI`

Verify that:

- the client ID is correct;
- the client is active;
- the callback is registered;
- the callback matches exactly, character for character;
- production uses HTTPS.

### `Requested scope is not allowed`

The requested scope is either unsupported or was not granted to that client. Check both the provider's supported-scope list and the client's allowed scopes.

### `PKCE verification failed`

The token request used a verifier that does not hash to the authorization request's S256 challenge. Persist the original verifier for the duration of the login transaction and send that exact value to `/api/sso/token`.

### `Client authentication failed`

The client secret is missing, incorrect, rotated, or the client is inactive. Replace the application's server-side secret with the currently active secret after a controlled rotation.

## Database source of truth

The backend is authoritative for:

- users and identity
- passwords/authentication state
- OTP/recovery state
- SSO clients and credential hashes
- redirect allowlists and scopes
- SSO sessions/tokens/consents
- account settings/privacy
- notifications
- support tickets/messages
- Owner actions
- audit/security records
- platform settings

## Production verification

There are two verification levels.

### Repository/source verification

CI checks source-tree contracts, JavaScript syntax, canonical runtimes, Owner integration, secret boundaries and other repository invariants.

### Authenticated production certification

The authenticated production E2E must execute against the deployed API/database with dedicated test accounts. A successful source commit alone is never described as live certification.

The repository's production workflow verifies the supported authenticated user/Owner support-notification path and its persisted notification/audit behavior.

## Deployment sequence

```text
1. Commit source changes
2. Run repository verification
3. Deploy backend
4. Run required database migrations
5. Verify /api/health
6. Deploy User frontend
7. Deploy Super Admin frontend
8. Verify User login/session/recovery
9. Verify Owner login/session
10. Verify Account Center
11. Verify SSO registry
12. Register/activate test application
13. Verify SSO discovery
14. Verify User frontend #/sso/authorize
15. Verify authorization-code + S256 PKCE exchange
16. Verify userinfo claims for requested scopes
17. Verify application-side session creation
18. Verify revocation/disablement behavior
19. Run authenticated production E2E where configured
```

## Documentation map

- `README.md` — canonical architecture, SSO workflow, scopes and integration guide
- `README_OWNER_CONTROL_CENTER.md` — Owner Control Center operations and security boundary
- `docs/SSO_INTEGRATION.md` — SSO provider contract
- `docs/VexaAccount-SSO-Frontend-Integration.md` — canonical User frontend SSO browser bridge
- `integrations/vexaaccount-node-backend/README.md` — Node.js backend integration pattern
- `frontend-VexaAccount-user/README.md` — User frontend runtime
- `frontend-VexaAccount-Super-admin/README.md` — Owner/Super Admin runtime
- `docs/PRODUCTION_E2E.md` — production verification procedure

## Security rules — non-negotiable

- Authorization code + S256 PKCE is required.
- State must be unpredictable and validated by the integrating backend.
- Redirect URIs must be exact.
- Client secrets are backend-only.
- Tokens are backend-only for server-side integrations.
- `userinfo.sub` is the stable external identity key.
- Request only the scopes actually required.
- Rotate compromised client secrets immediately.
- Revoke compromised clients/sessions.
- Do not add arbitrary SQL, shell, JavaScript or source-code execution to Owner controls.
- Do not treat CI success as proof of live authenticated production success.
