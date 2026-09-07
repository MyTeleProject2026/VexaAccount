# Owner Control Center — End-to-End Workflow

## 1. Authentication

Owner operations begin with a live DB-backed Super Admin session. The frontend cannot grant itself permission. Every privileged route validates the authenticated Super Admin on the backend.

## 2. User management

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

## 3. SSO registry

The Owner registers consuming applications, configures exact HTTPS redirect URIs and scopes, controls application lifecycle, rotates/revokes credentials and can revoke application sessions.

The registry is the source of truth for the provider-side SSO client contract.

## 4. SSO Application Kit

The Owner can analyze an allowlisted GitHub repository in read-only mode, review relevant source files, create a signed source plan, generate supported integration files and optionally install those files.

Installation is fail-closed unless all integrity checks pass:

- signed plan is valid and unexpired;
- repository/branch match the plan;
- every reviewed source blob still matches;
- branch head still matches the Owner's expected head;
- signed generated manifest matches the submitted generated files exactly;
- every generated file's SHA-256 and byte size match; and
- the Owner explicitly confirms installation.

## 5. Support and platform

Support replies, platform settings and account-center controls are backed by protected routes and persisted state. Frontend controls do not act as a substitute for backend persistence.

## 6. System C

System C exposes authenticated identity, SSO/session, API/latency, security, audit and runtime/health observability. Backend authorization remains active even if the UI is manually opened.

## 7. MTP2026 boundary

MTP2026 consumes VexaAccount. Its own login transaction, PKCE state, encrypted provider tokens and session cookie belong to MTP2026. Provider-side Owner controls should not be changed for ordinary MTP consumer-side defects.

## 8. Operational rule

For every high-impact action, verify more than the button result: inspect the API response, persisted database state, affected session/token state and downstream behavior.