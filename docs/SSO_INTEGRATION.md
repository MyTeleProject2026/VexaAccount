# VexaAccount SSO Integration Contract

**Documentation revision:** 2026-09-16

VexaAccount is the identity provider (IdP). A consuming application is an OAuth/OIDC-style SSO client. The consumer may keep its own visual design, login/register screens, routing, navigation and user experience; it must not bypass the provider's authorization, consent, token, redirect, scope or session rules.

## 1. Current provider SSO contract

The deployed provider contract currently exposes:

- `GET /.well-known/openid-configuration`
- `GET /api/sso/authorize`
- `POST /api/sso/token`
- `GET /api/sso/userinfo`
- `POST /api/sso/logout`

The authorization flow is **Authorization Code + S256 PKCE**. Authorization codes are one-time and short-lived. Access tokens are short-lived and refresh tokens are server-side lifecycle credentials. The consumer must validate the stable `sub` returned by userinfo and then create its own application session.

The current provider implementation advertises these scopes:

| Scope | Purpose | Typical consumer use |
|---|---|---|
| `openid` | Establishes the SSO identity subject | Required baseline for SSO |
| `profile` | Basic profile claims | Name, given/family name, picture, phone, country |
| `email` | Email identity claims | Login/account display and verified-email state |
| `account` | VexaAccount account identity marker | Provider-account linkage |
| `session` | Indicates VexaAccount SSO-session capability | Session-aware consumers |
| `applications` | Indicates application-related capability | Apps that need provider application context |
| `notifications` | Indicates notification capability | Apps that need provider notification context |

The Owner application registry is authoritative for which scopes a specific client may request. A client should request the **smallest set it actually needs**, not every available scope. The backend currently rejects a requested scope unless it is both provider-supported and allowed for that registered client; `openid` is enforced when Owner scope configuration is changed.

## 2. What a new application needs

A new application does not need to copy VexaAccount's frontend. It needs an integration boundary inside its own repository.

Recommended Node/Express structure:

```text
consumer-app/
├── backend/
│   └── src/
│       ├── integrations/
│       │   └── vexaaccount-sso.js       # provider client, PKCE, token/userinfo helpers
│       ├── routes/
│       │   └── vexaaccount-auth.js      # login + callback + local logout adapter
│       ├── middleware/
│       │   └── auth.js                  # consumer session authorization
│       └── server.js                     # mounts the routes
├── frontend-user/
│   └── src/
│       ├── integrations/
│       │   └── vexaaccount.js            # UI-facing SSO adapter
│       ├── pages/
│       │   ├── Login.*                   # consumer-owned login UI
│       │   ├── Register.*                 # consumer-owned registration UI, if used
│       │   ├── ForgotPassword.*           # consumer-owned recovery UI, if used
│       │   ├── Verify.*                   # consumer-owned verification UI, if used
│       │   └── Account.*                  # consumer account/session UI
│       └── api.*                          # calls consumer backend, never provider secrets
└── .env / secret-manager configuration
```

The exact filenames are not mandatory. The **responsibilities** are mandatory: provider authentication stays server-side; browser code gets only the consumer session and safe claims.

For non-Node applications, use equivalent modules in the target language/framework rather than inserting Node code into an incompatible project.

## 3. Consumer-owned Login UI

A consumer may have a completely independent login page:

```text
Consumer Login
├── Email/password login (consumer's own authentication, if supported)
├── Continue with VexaAccount
└── Forgot password
```

For **Continue with VexaAccount**, the button should call the consumer backend, for example `/api/auth/vexaaccount/start`. The consumer backend creates fresh `state` and PKCE values and redirects the browser to VexaAccount `/api/sso/authorize` with:

```text
response_type=code
client_id=<registered client id>
redirect_uri=<exact registered HTTPS callback>
scope=<only approved scopes>
state=<fresh unpredictable value>
code_challenge=<S256 verifier hash>
code_challenge_method=S256
```

After callback, the consumer backend validates state, exchanges the code server-to-server, calls `/api/sso/userinfo`, maps the provider `sub` to its local user record, and creates its own HttpOnly/Secure session cookie.

The consumer frontend never needs the VexaAccount client secret or refresh token.

## 4. Consumer-owned Register UI

There are two different concepts and they must not be confused:

### A. Consumer registration

The consumer can keep its own registration page and create a **consumer-local account**. This is independent from VexaAccount unless the application chooses to link the account later through SSO.

### B. VexaAccount account registration from a consumer page

A consumer may visually provide its own registration experience, but the account is still created by the VexaAccount provider under provider-controlled validation, verification, abuse protection and account rules. The current `/api/sso/*` contract is an SSO authorization/token contract; it is **not documented as a public delegated VexaAccount registration API**. Therefore an integration must not invent a direct `/api/sso/register` call or write to VexaAccount's database.

If product requirements demand consumer-hosted VexaAccount registration, VexaAccount must first expose a dedicated, authenticated provider registration/verification contract with explicit policy and rate limiting. Until that provider API exists, the safe supported route is to send the user through the provider's own registration/verification workflow and then return to SSO.

## 5. Consumer-owned Forgot Password / OTP / Verification UI

The same boundary applies to recovery and verification:

- `Continue with VexaAccount` can use the current SSO contract.
- A consumer's own password reset can reset a consumer-local password.
- VexaAccount password reset, email verification, OTP/resend-OTP and account-help actions must remain provider-owned unless VexaAccount explicitly exposes corresponding delegated APIs.
- A consumer must never emulate provider password reset by writing directly to provider tables.
- A consumer must never accept a consumer-generated OTP as proof of a VexaAccount identity.

If VexaAccount later adds provider APIs for delegated registration/recovery/verification, those APIs should be application-scoped, rate-limited, audited and protected against account enumeration and abuse. The consumer UI can then call its own backend adapter, which calls the provider API server-to-server.

## 6. Redirect URI and application registration

The Owner creates the SSO application record and controls:

1. application display name/key;
2. environment and lifecycle status;
3. exact HTTPS redirect URI list;
4. allowed scopes;
5. application profile metadata;
6. client credentials/rotation lifecycle where supported; and
7. application/session/consent controls.

Redirect URIs must be exact HTTPS URLs. The provider rejects unsafe redirect forms and requires the callback supplied during authorization/token exchange to match the registered URI.

## 7. Owner Source Analyzer → Repair → Install workflow

For a repository the Owner is authorized to modify, the intended workflow is:

```text
Analyze
  → Confirm target repository + branch + application
  → Review stack/auth/session/routing/frontend findings
  → Select affected source files
  → Generate additive integration/repair plan
  → Review generated source and file hashes
  → Fresh preflight against current target HEAD
  → Explicit Owner approval
  → Commit only approved generated changes
  → CI/deployment verification
  → Real SSO E2E verification
```

The analyzer is read-only. It must not silently modify a target repository. Installation is fail-closed when the reviewed repository, branch, blob SHA, current HEAD, generated manifest or generated file hashes no longer match the Owner-approved plan.

The generator should preserve unrelated application behavior and UI design. It should add or repair only the files and integration anchors necessary for SSO, and it must not blindly replace an existing authentication/session system.

## 8. Generated integration source responsibilities

For a supported Node/Express consumer, the current VexaAccount integration package uses responsibilities equivalent to:

- `backend/src/integrations/vexaaccount-sso.js` — provider URL configuration, state/PKCE creation, authorization URL, code exchange, userinfo, refresh and provider logout.
- `backend/src/routes/vexaaccount-auth.js` — consumer login start, callback validation, token exchange and local session creation/clearance.
- `frontend-user/src/integrations/vexaaccount.js` — starts the consumer backend flow and exposes UI-safe session state; it does not hold secrets.
- `frontend-admin/src/integrations/vexaaccount.js` — only when the consumer has a separate admin UI; it does not become an alternative provider identity authority.
- `.env`/secret-manager configuration — provider URL, client ID, exact callback and client secret; secrets stay server-side.
- consumer session/auth middleware — protects the application's own pages and APIs after SSO succeeds.

The current VexaAccount repository contains a Node/Express integration reference under `integrations/vexaaccount-node-backend/`; its `vexaaccount-sso.js` uses S256 PKCE and server-side client credentials.

## 9. Database boundary

The provider owns its SSO tables and token/session state. A consumer should normally maintain its own tables, for example:

```text
consumer_sso_login_transactions
consumer_sso_sessions
consumer_users
```

The consumer may store a provider subject mapping and encrypted provider refresh token if its product requires refresh access. It must never store raw provider secrets in frontend storage and should encrypt sensitive server-side credentials.

A consumer's user table should link to the stable VexaAccount `sub`, not to an email address alone. Email can change; a stable subject is the identity key.

## 10. Scope-selection examples

**Simple login:** `openid profile email`

**Account-aware application:** `openid profile email account`

**Session-aware application:** `openid profile email account session`

**Application-management/notification application:** request only the additional scopes actually required and only after Owner approval.

Requesting more scopes than necessary increases consent and security surface. The Owner should review every scope requested by a new application.

## 11. Logout and revocation

Consumer logout clears the consumer's own session. Where provider refresh-token logout is used, the consumer backend can call `/api/sso/logout`. Provider consent removal or token/session revocation must be treated as an authentication failure and the consumer should require a fresh SSO authorization.

## 12. Security rules

- HTTPS in production.
- Exact registered redirect URI.
- S256 PKCE for browser login initiation.
- Fresh, unpredictable state.
- One-time callback/state consumption.
- Client secret only on the backend.
- Refresh token only on the backend.
- HttpOnly/Secure consumer session cookie.
- No provider token in localStorage/sessionStorage.
- No provider database writes by consumers.
- No third-party cookie/token copying between devices.
- No account enumeration through registration/recovery errors.
- No automatic source commit without explicit Owner approval and fresh preflight.

## 13. What 'fully integrated' means

An application is fully integrated only when all required layers work together:

```text
Owner registry
  → client + redirect URI + scopes
  → consumer backend config
  → consumer login button
  → VexaAccount authorize
  → consent
  → code + S256 PKCE
  → consumer callback
  → token exchange
  → userinfo / stable sub
  → consumer local session
  → consumer pages/API
  → refresh where required
  → logout/revocation
  → CI/deployment
  → real deployed browser E2E
```

A generated file, successful source analysis, successful GitHub commit, or HTTP 200 response alone is not SSO certification.

## 14. Related documentation

- `docs/VexaAccount-SSO-Frontend-Integration.md`
- `docs/SSO_OWNER_INTEGRATION_DIAGNOSTICS.md`
- `README_SSO_APPLICATION_KIT.md`
- `docs/PRODUCTION_E2E.md`

MTP2026-specific implementation changes belong in `MyTeleProject2026/MTP2026-App-Launcher`; VexaAccount provider changes belong in this repository.