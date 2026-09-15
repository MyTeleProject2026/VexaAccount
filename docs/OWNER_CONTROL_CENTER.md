# Owner Control Center — End-to-End Workflow

**Documentation revision:** 2026-09-16

## 1. Owner authentication

Owner operations begin with a live DB-backed Super Admin session. The frontend cannot grant itself permission. Every privileged route validates the authenticated administrator on the backend.

## 2. SSO application creation

For each consuming application, the Owner should create a distinct registry record and configure:

- application name/display name and application key;
- environment and lifecycle status;
- exact HTTPS redirect URI(s);
- minimum required scopes;
- application profile metadata;
- client credential/rotation lifecycle where supported; and
- optional authorized GitHub repository/branch binding for source integration.

The registry is the provider-side source of truth. A consumer must not invent a client ID, redirect URI or scope outside the registered contract.

## 3. Scope approval

Current provider-supported scopes are:

`openid`, `profile`, `email`, `account`, `session`, `applications`, `notifications`.

The Owner should normally approve `openid profile email` first and add other scopes only for a documented product requirement. The provider enforces both the global supported-scope set and each client's allowed-scope set.

## 4. Consumer-owned UI

A consuming application may retain its exact existing UI and add a **Continue with VexaAccount** action to its own Login page. It may also keep its own Register, Forgot Password, Verify Email, Resend OTP and Help pages.

Those pages are not allowed to bypass provider security. The current provider SSO contract supports authorization/token/userinfo/logout; it does not expose a public delegated VexaAccount registration or password-recovery API. Such provider-owned account operations require a separately exposed provider API before a consumer can safely front them with its own UI.

## 5. Source Analyzer and Integration Factory

The Owner may use an authorized repository/branch as a source-integration target:

```text
Analyze
→ Confirm
→ Review
→ Repair / Generate
→ Preflight
→ Explicit Commit
→ CI
→ Deployment
→ Real SSO E2E
```

Analysis is read-only. It should discover the target stack, backend/frontend entry points, authentication/session boundaries, login/register/recovery routes, environment configuration and exact files that need SSO integration.

Generated repair source must be additive-first and preserve unrelated target behavior and UI design. It must not blindly replace an existing authentication system.

## 6. Commit safety

Before an external repository write, the server must verify:

- signed source plan is valid and unexpired;
- repository and branch are exactly bound;
- reviewed source files still have the recorded GitHub blob SHAs;
- current branch HEAD still matches the preflight expectation;
- generated manifest matches the approved files;
- generated file SHA-256/size values match; and
- the Owner explicitly approved the commit.

If any check fails, the operation must stop and require a fresh analysis/review. No forced stale write should occur.

## 7. Backend/consumer boundary

```text
Owner UI
  → authenticated VexaAccount Owner API
  → registry/database/audit

Consumer Login UI
  → consumer backend
  → VexaAccount authorization
  → consumer callback
  → VexaAccount token
  → VexaAccount userinfo
  → consumer session
  → consumer pages/API
```

Provider identity remains authoritative. The consumer owns its local session and application data.

## 8. User management

The Owner can search and inspect users and use supported status/security/account operations. Sensitive mutations invalidate affected sessions and record security/audit information where applicable.

Typical chain:

```text
Owner UI
  → authenticated API request
  → requireSuperAdmin
  → owner route
  → database mutation
  → session/token invalidation when required
  → audit/security event
  → API response
  → Owner UI refresh
```

## 9. System C and runtime independence

System C is observability, not an interaction lock. A long-running analyzer or other background operation must not make the rest of the Owner panel modal or unclickable. Background work belongs to server-side operation state and the Owner operation indicator; ordinary pages and controls remain independently usable.

## 10. MTP2026 boundary

MTP2026 consumes VexaAccount. Its own login transaction, PKCE state, encrypted provider tokens and session cookie belong to MTP2026. Provider-side Owner controls should not be changed for ordinary consumer-side defects.

## 11. Verification rule

For every high-impact action, verify the complete chain: UI action, API response, persisted state, audit/security event, downstream behavior and deployed runtime behavior. Never describe an integration as production-certified from a UI success message alone.