# VexaAccount SSO Frontend Integration

**Documentation revision:** 2026-09-16

The consumer frontend owns the visual experience. It may keep its existing login, registration, forgot-password, verification, OTP, navigation and account pages. The browser must not become the holder of VexaAccount client secrets or provider refresh tokens.

## 1. Standard frontend boundary

```text
Consumer Login/Register UI
        ↓
Consumer backend /api/auth/vexaaccount/start
        ↓
Fresh state + S256 PKCE
        ↓
VexaAccount /api/sso/authorize
        ↓
Consumer callback
        ↓
Server-to-server /api/sso/token
        ↓
VexaAccount /api/sso/userinfo
        ↓
Consumer-owned HttpOnly session
        ↓
Consumer frontend pages
```

The consumer frontend should call its own backend for session state. It should not call the VexaAccount token endpoint with a client secret from browser code.

## 2. Continue with VexaAccount

A consumer can place a button such as **Continue with VexaAccount** on its existing login page. The button does not need to navigate to a VexaAccount-branded login page first.

The recommended implementation is:

```text
button click
  → GET/POST consumer backend login-start
  → create state + PKCE verifier
  → server stores short-lived login transaction
  → 302 to VexaAccount authorize
  → VexaAccount authenticates/consents
  → 302 to exact consumer callback
  → consumer backend exchanges code
  → consumer backend calls userinfo
  → consumer creates local session
  → redirect to the consumer's original page
```

The consumer can preserve its exact existing UI design around this flow.

## 3. Current provider scopes

The provider currently advertises:

- `openid` — identity subject; baseline SSO scope.
- `profile` — basic profile claims such as name, picture, phone and country.
- `email` — email and email verification claim.
- `account` — VexaAccount account identity marker.
- `session` — VexaAccount SSO-session capability marker.
- `applications` — application-related capability marker.
- `notifications` — notification capability marker.

The Owner controls the scopes allowed to each registered client. The consumer should request the minimum necessary scopes. A simple login normally uses `openid profile email`; an application that genuinely needs account context can request `account` as well.

## 4. Consumer-owned registration page

There are two separate cases:

### Consumer account registration

The consumer can keep its own registration page and create a consumer-local account. This is independent of VexaAccount.

### Registration of a VexaAccount account

A consumer must not write directly to VexaAccount tables or invent an undocumented registration endpoint. The current `/api/sso/*` provider contract is for SSO authorization/token/userinfo/logout, not a public delegated VexaAccount registration API.

If VexaAccount later exposes a dedicated registration API, the consumer should call that API only through its backend. Provider verification, abuse protection, rate limits, duplicate-account rules and email/OTP verification remain provider responsibilities.

Until such an API is explicitly exposed, a consumer-owned Register page cannot truthfully claim to create a VexaAccount account purely through the existing SSO endpoints.

## 5. Forgot password, resend OTP and verification

The same separation applies to recovery:

- A consumer may implement its own forgot-password/OTP pages for consumer-local credentials.
- VexaAccount password recovery and VexaAccount email/OTP verification remain provider-owned unless a dedicated provider API is exposed.
- A consumer must not imitate provider password reset by changing provider database records.
- A consumer must not treat its own OTP as proof of a VexaAccount identity.
- One-time SSO authorization callbacks must never be retried indefinitely.

If delegated provider recovery is added later, the intended boundary is:

```text
Consumer Forgot Password UI
  → Consumer backend
  → authenticated/rate-limited VexaAccount recovery API
  → provider OTP/email workflow
  → consumer backend receives safe result
  → consumer UI updates
```

No provider secret, OTP secret or refresh token belongs in browser storage.

## 6. Frontend source responsibilities

A typical consumer repository may contain:

```text
frontend-user/
├── pages/Login.*
├── pages/Register.*
├── pages/ForgotPassword.*
├── pages/Verify.*
├── pages/Account.*
├── components/ContinueWithVexaAccount.*
├── integrations/vexaaccount.*
└── api.*
```

Only the responsibilities matter; filenames can remain whatever the target application already uses. The integration should be additive so existing UI components and styling remain intact.

`integrations/vexaaccount.*` should only start the consumer backend flow and consume safe session state. It must never contain `client_secret`, refresh tokens, GitHub tokens or provider encryption keys.

## 7. Backend source responsibilities

A Node/Express consumer reference is structured as:

```text
backend/src/
├── integrations/vexaaccount-sso.js
├── routes/vexaaccount-auth.js
├── middleware/auth.js
└── server.js
```

Responsibilities:

- `vexaaccount-sso.js`: provider URL/configuration, state, S256 PKCE, authorization URL, token exchange, userinfo, refresh and provider logout.
- `vexaaccount-auth.js`: login start, callback validation, code exchange and consumer-session creation/clearance.
- `auth.js`: protects the consumer's own APIs/pages after login.
- `server.js`: mounts the integration routes without replacing unrelated application routes.

The existing VexaAccount repository contains a Node/Express integration reference under `integrations/vexaaccount-node-backend/`.

## 8. Database/session boundary

The consumer should own its own persistence, for example:

```text
consumer_sso_login_transactions
consumer_sso_sessions
consumer_users
```

A consumer should link the provider identity using the stable VexaAccount `sub`, not email alone. If refresh access is required, refresh tokens must be encrypted and stored only on the server.

The consumer browser should receive only its own HttpOnly/Secure session cookie.

## 9. Owner-created application workflow

For an application the Owner is authorized to integrate:

```text
Create application
  → application name/key
  → exact HTTPS redirect URI(s)
  → environment/status
  → requested scopes
  → client credentials
  → optional repository + branch binding
  ↓
Analyze
  → read-only repository scan
  → stack/auth/session/routing/UI discovery
  → affected-file findings
  ↓
Confirm
  → Owner confirms target + branch + application
  ↓
Review
  → exact affected files and integration anchors
  ↓
Repair/Generate
  → additive target-specific source
  ↓
Preflight
  → fresh target HEAD + blob SHA + generated manifest checks
  ↓
Explicit Commit
  → only approved files are written
  ↓
CI/deployment
  ↓
Real deployed SSO E2E
```

The generated repair must preserve unrelated application behavior and UI. It must not blindly replace a target authentication system.

## 10. Security rules

- HTTPS in production.
- Exact redirect URI matching.
- S256 PKCE.
- Fresh unpredictable state.
- One-time callback/code consumption.
- Client secret only on the backend.
- Refresh token only on the backend.
- HttpOnly/Secure consumer session cookie.
- No provider token in localStorage/sessionStorage.
- No provider database writes from consumer applications.
- No copying of VexaAccount/third-party cookies between devices.

## 11. Error handling

The consumer should handle:

- expired/invalid authorization code;
- state mismatch;
- PKCE mismatch;
- denied consent;
- disallowed scope;
- redirect URI mismatch;
- inactive/revoked provider client;
- expired/revoked provider credentials;
- unavailable provider; and
- local consumer-session expiry.

For each failure, return the user to a clear consumer-owned state instead of repeatedly submitting the same callback.

## 12. Fully integrated means end-to-end verified

A source package is not enough. Full integration requires:

```text
Owner registry
→ client/redirect/scopes
→ consumer backend secrets
→ consumer Continue with VexaAccount button
→ provider authorization + consent
→ code + PKCE
→ callback
→ token exchange
→ userinfo/sub
→ consumer session
→ consumer pages/APIs
→ refresh where required
→ logout/revocation
→ CI/deployment
→ real browser E2E
```

Generation success, a GitHub commit, or an HTTP 200 response alone is not production certification.

## Boundary

This document describes the consumer frontend contract. Consumer-specific fixes belong in the consumer repository. Provider-side changes belong in VexaAccount. Do not modify an external consumer repository unless the Owner has explicitly authorized that repository write.