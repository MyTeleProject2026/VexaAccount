# VexaAccount SSO Consumer Integration Playbook

**Revision:** 2026-09-16

This is the practical contract for a new application that wants VexaAccount SSO while keeping its own frontend design and application pages.

## A. What the consuming application receives

The consuming application does not receive control of VexaAccount's database or authentication pages. It receives an application client registration:

- client ID;
- client secret for backend use only;
- exact HTTPS redirect URI(s);
- Owner-approved scopes;
- application lifecycle status; and
- optional repository/branch integration metadata.

## B. Minimum login integration

For a normal web application, the minimum real integration is:

```text
Consumer frontend Login page
  → Consumer backend /auth/vexaaccount/start
  → VexaAccount /api/sso/authorize
  → Consumer callback
  → VexaAccount /api/sso/token
  → VexaAccount /api/sso/userinfo
  → Consumer local session
```

Use Authorization Code + S256 PKCE. Do not put the client secret in frontend JavaScript.

## C. Recommended files for Node/Express

```text
backend/src/integrations/vexaaccount-sso.js
backend/src/routes/vexaaccount-auth.js
backend/src/middleware/auth.js
backend/src/server.js                 # existing file; add route mounting only
frontend-user/src/integrations/vexaaccount.js
frontend-user/src/pages/Login.*        # existing page; add Continue button
frontend-user/src/pages/Account.*      # existing page/session UI
backend/.env / deployment secrets      # never commit real values
```

Optional files, depending on product requirements:

```text
frontend-user/src/pages/Register.*
frontend-user/src/pages/ForgotPassword.*
frontend-user/src/pages/Verify.*
frontend-user/src/components/ContinueWithVexaAccount.*
backend/src/routes/vexaaccount-recovery.js   # only if a provider recovery API exists
```

Existing target files should be repaired additively. Do not replace a whole authentication subsystem merely to add an SSO button.

## D. Scopes

The current provider supports:

`openid profile email account session applications notifications`

Recommended starting point:

```text
openid profile email
```

Add `account`, `session`, `applications` or `notifications` only when the application genuinely needs the corresponding provider capability and the Owner approves it.

The registered client's allowed scope set is enforced by the provider. A request for an unsupported or unapproved scope fails.

## E. Own login/register/recovery pages

The application can keep its own:

- Login page;
- Register page;
- Forgot Password page;
- Verify Email page;
- Resend OTP page;
- Account page; and
- help/error pages.

However, the page owner and identity owner are different concepts. If a page is creating or recovering a **VexaAccount identity**, the actual identity operation must be performed by a VexaAccount provider contract. The current SSO endpoints do not provide a public delegated registration/password-reset/OTP API.

Therefore:

- own login page + **Continue with VexaAccount**: supported by the current SSO contract;
- own consumer registration/password recovery: supported as a consumer-local feature;
- own visual page that directly creates/recoveries a VexaAccount account: requires a dedicated provider API before it can be implemented safely.

## F. Owner source analysis and generation

The Owner Integration Factory may analyze an authorized GitHub repository and identify:

- framework and language;
- backend entry point;
- frontend entry points;
- existing auth middleware;
- existing login/register/recovery routes;
- session/cookie implementation;
- environment configuration;
- callback/routing candidates; and
- files that need additive SSO changes.

The intended lifecycle is:

```text
Analyze
→ Confirm
→ Review
→ Repair/Generate
→ Preflight
→ Explicit Commit
→ CI
→ Deployment
→ Real SSO E2E
```

Analysis must be read-only. The generated repair must be target-specific. It should preserve unrelated code, imports, routes, database behavior and UI design.

Before a write, verify the current branch HEAD, every reviewed blob SHA, generated manifest, generated SHA-256 values and explicit Owner approval. If the target changed after review, stop and analyze again.

## G. Provider/consumer responsibility split

| Responsibility | VexaAccount | Consumer app |
|---|---|---|
| Provider user identity | Yes | Consume |
| SSO client registry | Yes | No |
| Redirect URI approval | Yes | Configure callback |
| Scope approval | Yes | Request minimum needed |
| Authorization | Yes | Start flow |
| Consent | Yes | Handle result |
| PKCE state/verifier | Provider validates | Consumer creates/stores |
| Client secret | Provider validates | Store server-side |
| Userinfo | Yes | Consume |
| Local session | No | Yes |
| Consumer UI | No | Yes |
| Consumer DB | No | Yes |
| Provider password reset | Yes | Consume only through exposed API |
| Provider OTP/verification | Yes | Consume only through exposed API |
| Consumer password reset | No | Yes |
| Consumer notifications | No | Yes |

## H. Logout

The consumer clears its own session. If it has a provider refresh token, its backend may use the provider logout endpoint. Provider revocation must invalidate the consumer's assumption that the provider credential remains usable.

## I. Security requirements

Never expose:

- VexaAccount client secret;
- provider refresh token;
- provider access token unless a browser-safe token contract is explicitly designed;
- PKCE verifier;
- GitHub analysis/deployment credential; or
- database encryption key

to browser storage or frontend bundles.

Never copy provider cookies or tokens from one device to another.

## J. Certification

The integration is fully operational only after a real deployed test demonstrates:

1. Owner registration;
2. exact redirect URI;
3. approved scopes;
4. consumer login button;
5. VexaAccount authorization/consent;
6. callback;
7. token exchange;
8. userinfo stable subject;
9. consumer session;
10. protected consumer API/page;
11. refresh if required;
12. logout/revocation; and
13. deployed CI/E2E verification.

A generated source package or successful commit is not by itself runtime certification.