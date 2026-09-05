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
  │    ├─ Overview / registry / application detail
  │    ├─ Redirect URI + scope management
  │    ├─ Client secret creation / rotation
  │    ├─ Diagnostics / repair / lifecycle status
  │    ├─ Integration configuration
  │    ├─ Runtime health sync
  │    ├─ Complete SSO Integration Factory
  │    └─ SSO audit
  │
  └─ System B — Owner Control Center
       ├─ Overview / users
       ├─ User profile/security detail
       ├─ Credits / storage / sessions / notes
       ├─ Support desk / replies / ticket closure
       └─ Platform settings / health
```

## Complete SSO Integration Factory

From **SSO Control System → Application Detail → Generate Complete SSO Package**, the Owner can select the target backend/frontend stack and generate a deterministic integration source package from the authoritative application registry response.

Supported application-specific profiles:

- VexaMail — mail identity, profile, session and notification scopes
- VexaWallet — wallet identity/account/session scopes
- VexaCloud — cloud identity/account/session scopes
- Vexa Password Manager — identity/account/session scopes
- VexaAuthenticator — identity/security-session/notification scopes
- VexaWholes Professional — full ecosystem identity/application/notification scopes

The factory supports Node/Express, Next.js server integration, Python/FastAPI and a Django adapter profile, plus React, Next.js, Vue and Vanilla JS frontend selections.

Generated package areas include:

```text
backend/src/auth/vexaaccount-sso.js
backend/src/routes/auth-vexaaccount.js
backend/src/middleware/require-vexaaccount-user.js
backend/.env.example
frontend-user/src/services/vexaAccountSso.js
frontend-user/src/auth/VexaAccountLogin.*
frontend-user/src/auth/VexaAccountAuthGuard.jsx
database/vexaaccount-sso.sql
tests/vexaaccount-sso.e2e.test.js
deployment/vexaaccount-sso.md
integration-config.json
integration-patch-manifest.json
VEXAACCOUNT-SSO-SETUP.md
```

The generated backend flow covers authorization redirect, server-side state, authorization-code exchange, userinfo retrieval, local-user upsert adapter, local session creation, logout and protected-route middleware. Database generation provides a VexaAccount subject-to-local-user identity mapping table while deliberately leaving the target application's existing user schema authoritative.

The generated test contract covers success and negative paths: denied authorization, invalid/expired state, invalid code, disabled/revoked clients, token exchange failure, missing scopes, logout and secret exposure checks. The deployment checklist validates exact HTTPS redirect registration, secret-manager storage, migration, route mounting and staging certification.

### Automatic patching boundary

The Owner browser generates a deterministic `integration-patch-manifest.json`; it does **not** silently write into another application's repository. A real repository writer must authenticate separately to the target repository and review/apply the manifest. This prevents the Owner browser from becoming a cross-repository credential-writing channel and keeps `VEXA_ACCOUNT_CLIENT_SECRET` backend-only.

### Authoritative configuration

The factory reads `GET /api/sso-registry/applications/:id/integration-config` and uses its registered URL, client ID, exact redirect URI, scopes and timeout. The client secret is intentionally not included in integration-config and is represented only as `PASTE_ONE_TIME_SECRET_HERE` in `.env.example`; the Owner must transfer the one-time secret to the integrating backend's secret manager.

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

## Security boundary

- Super Admin authentication is cookie/session based.
- No database credentials are shipped to the frontend.
- No JWT signing key is shipped to the frontend.
- Client secrets are never stored in localStorage/sessionStorage.
- Client secrets are returned by the backend only at application creation or rotation and are displayed transiently for secure transfer.
- `VEXA_ACCOUNT_CLIENT_SECRET` belongs on the integrating application's backend, never in public frontend code.
- Redirect URI validation and SSO scope validation remain backend-enforced.

## Verification

`.github/workflows/verify.yml` syntax-checks the frontend/backend JavaScript and verifies that the Owner OS entrypoint includes the complete SSO factory plus all six ecosystem application profiles, framework generators, environment contract, database mapping, E2E test contract, deployment checklist and patch manifest.

A static source check is not the same as live production certification. The generated integration should be run against a staging target before production.
