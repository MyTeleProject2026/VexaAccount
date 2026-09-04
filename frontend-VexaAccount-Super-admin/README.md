# VexaAccount Super Admin Frontend

Standalone static frontend for the Vexa ecosystem Owner OS.

## Owner OS architecture

```text
index.html
  ↓
owner-os.js
  ↓
Authenticated Owner OS session
  ↓
Controller Selection
  ├─ System A — VexaAccount SSO Full Controlling System
  │    ├─ Overview
  │    ├─ Application Registry
  │    ├─ Application Detail
  │    ├─ Redirect URI management
  │    ├─ Scope management
  │    ├─ Client secret creation / rotation
  │    ├─ SSO diagnostics / repair
  │    ├─ SSO security controls
  │    └─ SSO audit
  │
  └─ System B — Owner Control Center
       ├─ Overview
       ├─ User administration
       ├─ User profile/security detail
       ├─ Credits and coins adjustments
       ├─ SSO session revocation
       ├─ Storage record controls
       ├─ Owner notes
       ├─ Support desk / replies / ticket closure
       └─ Platform settings / health
```

The Owner must authenticate first. A successful Owner session lands on the controller-selection page instead of a giant combined console. The two controller systems are separate workflows with independent navigation and a controlled return to the selection screen.

## Real backend workflows

The frontend does not simulate mutations. It calls the existing authenticated backend APIs:

- `/api/auth/super-admin/login`
- `/api/auth/super-admin/session`
- `/api/auth/logout`
- `/api/sso-registry/*`
- `/api/owner/users/*`
- `/api/owner/support/*`
- `/api/owner/platform/*`

Existing backend authorization and audit middleware remain authoritative. Database access is never exposed to the browser.

## Existing source preservation

The previous `owner-console-runtime.js`, `owner-control-center.js`, `owner-control-center-loader.js`, `owner-control-center.css`, and `sso-diagnostics-panel.js` sources remain in the repository for source-history and compatibility purposes, but the production entry point now loads `owner-os.js` as the canonical runtime. The new runtime does not depend on the legacy `#createTop` console element or legacy overlay mounting sequence.

Existing backend SSO registry, Owner user-management, support, platform, audit, diagnostics and authentication routes are retained and reused rather than replaced with UI-only mocks.

## Security boundary

- Super Admin authentication is cookie/session based.
- No database credentials are shipped to the frontend.
- No JWT signing key is shipped to the frontend.
- Client secrets are never stored in localStorage/sessionStorage.
- Client secrets are returned by the backend only at application creation or rotation and are displayed transiently for secure transfer to the integrating application's backend.
- `VEXA_ACCOUNT_CLIENT_SECRET` belongs on the integrating application's backend, never in the public frontend configuration.
- Redirect URI validation and SSO scope validation remain backend-enforced.

## Deployment

Deploy this directory independently from the VexaAccount backend and User frontend. Configure the API origin with `VEXA_ACCOUNT_ADMIN_API_BASE` or the existing server-side/static configuration mechanism. The production default remains `https://api-vexaaccount.onrender.com`.

After deployment, verify the browser receives the new `owner-os.js` and `owner-os.css` versions and no legacy Super Admin runtime is loaded by `index.html`.

## Support → notification workflow

```text
User creates ticket
  → Owner lists/opens ticket
  → Owner replies
  → backend persists reply + notification + audit
  → User reads persisted notification
  → Owner closes ticket
```

The Owner UI calls the existing support APIs; it does not fake ticket state locally.

## Production E2E certification

The repository's authenticated production test remains:

```text
scripts/e2e-support-notification.js
```

It is executed by:

```text
.github/workflows/vexaaccount-e2e.yml
```

Configure dedicated GitHub Actions secrets:

```text
VEXA_E2E_USER_EMAIL
VEXA_E2E_USER_PASSWORD
VEXA_E2E_OWNER_EMAIL
VEXA_E2E_OWNER_PASSWORD
```

Never commit or print those credentials. A successful source check is not a substitute for a live production E2E run.
