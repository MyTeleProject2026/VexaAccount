# VexaAccount — Owner Control Center

## Current architecture

The VexaAccount Super Admin frontend uses one canonical Owner Control Plane runtime. The Owner operates supported account, security, SSO, support and platform controls through authenticated backend APIs.

```text
Super Admin
└── Owner OS Session
    ├── SYSTEM A · Identity Infrastructure
    │   └── VexaAccount SSO Full Controlling System
    ├── SYSTEM B · Platform Authority
    │   └── Owner Control Center
    └── SYSTEM C · Identity Observability OS
        └── VexaAccount Live Integration & Runtime Observatory
```

## System C — Identity Observability OS

System C is a separate authenticated, read-only operating environment for real VexaAccount runtime visibility. It is not a fake event simulator and does not generate synthetic transactions.

```text
Real VexaAccount request / SSO operation
          ↓
Backend API lifecycle
          ↓
Persistent observability telemetry + existing SSO/audit records
          ↓
System C snapshot
          ↓
Authenticated SSE stream
          ↓
Live Owner observatory UI
```

The runtime observatory exposes:

- Live API request/failure counts and measured API latency.
- Active SSO sessions and active consent records.
- Registered application state and real SSO session counts.
- SSO security events and Owner audit evidence.
- Database connectivity plus safe MySQL runtime counters (connections, running work, questions, commits and rollbacks).
- Live SSE reconnect/heartbeat behavior.
- Source filtering, search, pause/resume, manual refresh, feed clearing and safe selected-event inspection.

The observability telemetry table is `vexa_observability_events` and is created by migration `014_system_c_observability.sql`. The normal backend start command runs the migration runner before starting the API, so a deployed backend receives the schema automatically.

System C deliberately excludes access tokens, Client Secrets, arbitrary SQL, raw request bodies and private backend internals. External application internals are visible only when the activity reaches VexaAccount or is explicitly persisted/reported at the integration boundary.

The standalone System C frontend is:

```text
frontend-VexaAccount-Super-admin/system-c/index.html
frontend-VexaAccount-Super-admin/system-c/system-c.js
frontend-VexaAccount-Super-admin/system-c/system-c.css
```

Its API target is the VexaAccount backend service (`https://api-vexaaccount.onrender.com`) rather than the static Super Admin frontend host.

## User management workflow

```text
Owner login
  → authenticated Owner session
  → Users
  → search/select account
  → inspect safe account details
  → apply supported control
  → confirm backend response
  → review audit/security event
```

Supported controls include safe profile edits, account enable/disable, supported 2FA/passcode reset, SSO-session revocation, supported credit/coin adjustments with an explicit reason, Owner notes, storage metadata inspection and explicit permanent account deletion. Password hashes and other sensitive credential material are excluded from the safe detail response.

## SSO application workflow

```text
Create client
  → configure exact redirect URI
  → grant supported scopes
  → activate
  → external backend uses state + S256 PKCE
  → authorize
  → token exchange
  → userinfo
  → external local session
```

Redirect URI API:

```text
GET    /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
```

Production callbacks must be exact HTTPS values. No wildcard production callbacks.

## Client Secret handling

During application creation or secret rotation, the backend deliberately returns the new Client Secret once. The Owner UI displays it transiently so the Owner can transfer it to the external application's backend secret store.

The browser must never persist the secret in localStorage/sessionStorage, URLs, logs, PDFs or `VEXA_ACCOUNT_SSO_CONFIG`. The external application keeps it only in its server-side secret configuration.

## Support and notification two-way workflow

```text
User creates ticket
      ↓
Owner lists/opens ticket
      ↓
Owner replies
      ↓
Backend persists reply + notification + audit
      ↓
User notification API exposes the persisted notification
      ↓
User acknowledges notifications as read
      ↓
Owner closes ticket
```

Owner replies are backend-backed and auditable. The User frontend's live notification runtime polls the authenticated notification API while visible, and also refreshes when the application becomes visible or authentication changes.

## Production E2E certification

The repository includes a real authenticated production E2E for the support/notification workflow and its GitHub Actions workflow. A repository commit is not itself proof of live certification; certification requires the deployed revision and dedicated test credentials.

## Platform and security controls

```text
GET /api/owner/platform/settings
PUT /api/owner/platform/settings/:key
GET /api/owner/platform/health
GET /api/owner/platform/integration/:clientId
GET /api/owner/platform/scopes
```

These are explicit validated controls. The Owner browser is never granted arbitrary SQL, shell, JavaScript or source-code execution.

## Security rules

1. Keep Client Secrets server-side except the deliberate one-time creation/rotation display.
2. Use exact redirect URIs.
3. Use S256 PKCE.
4. Validate state server-side.
5. Use `userinfo.sub` as the stable external identity key.
6. Rotate compromised secrets immediately.
7. Revoke compromised sessions/applications.
8. Keep Owner actions explicit, validated and auditable.
9. Never expose arbitrary code execution from the Owner UI.
10. Never put Client Secrets in browser storage, URLs, logs, PDFs or non-secret integration configuration.
