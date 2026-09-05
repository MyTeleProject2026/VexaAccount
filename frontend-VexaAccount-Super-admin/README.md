# VexaAccount Super Admin Frontend

Standalone static frontend for the Vexa ecosystem Owner OS.

## Owner OS architecture

```text
Owner login
  ↓
Controller Selection
  ├─ System A — VexaAccount SSO Full Controlling System
  │    ├─ Application Registry
  │    ├─ Application Detail
  │    ├─ Redirect URI / scope controls
  │    ├─ Credentials / rotation
  │    ├─ Diagnostics / runtime sync
  │    └─ Complete SSO Integration Factory
  │
  └─ System B — Owner Control Center
       ├─ Users
       ├─ Account security
       ├─ Support
       └─ Platform operations
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

Generated package areas include backend authentication/callback/session files, frontend SSO files, a database identity-mapping migration, `.env.example`, E2E test contract, deployment checklist, authoritative integration configuration and a deterministic patch manifest.

The generated backend flow covers authorization redirect, server-side state, authorization-code exchange, userinfo retrieval, local-user upsert adapter, local session creation, logout and protected-route middleware. Database generation provides a VexaAccount subject-to-local-user identity mapping table while deliberately leaving the target application's existing user schema authoritative.

## Real GitHub installation

The Owner can now optionally install the generated package into an allowed GitHub repository directly from the SSO Integration Factory. The browser sends generated source files to the authenticated VexaAccount backend; the backend performs the Git operation server-side and creates one atomic commit from the selected target branch.

Configure the VexaAccount backend/Render service with:

```text
GITHUB_SSO_DEPLOY_TOKEN=<fine-grained GitHub token with Contents: write>
GITHUB_SSO_ALLOWED_REPOSITORIES=MyTeleProject2026/VexaMail,MyTeleProject2026/VexaWallet
GITHUB_API_URL=https://api.github.com
```

The repository allowlist is strongly recommended. The token must never be placed in frontend code, browser storage, URLs or the VexaAccount database. The deployment API uses the existing Super Admin authentication and audit middleware and never force-pushes a branch.

Owner flow:

```text
Application Detail
  → Generate Complete SSO Package
  → select backend/frontend target
  → inspect generated files
  → enter target repository + branch
  → Check repository
  → Commit integration
  → GitHub atomic commit
  → receive commit SHA
```

The deployment operation writes the generated package files and leaves unrelated existing source untouched. Existing application entrypoints still require review when the target architecture needs an import/mount change; the generated patch manifest/setup document identifies those integration points rather than guessing and overwriting unrelated code.

## Authoritative configuration

The factory reads `GET /api/sso-registry/applications/:id/integration-config` and uses its registered URL, client ID, exact redirect URI, scopes and timeout. The client secret is intentionally not included and is represented only as `PASTE_ONE_TIME_SECRET_HERE` in `.env.example`; the Owner transfers the one-time secret to the integrating backend's secret manager.

## Security boundary

- Super Admin authentication is cookie/session based.
- No database credentials or JWT signing keys are shipped to the frontend.
- Client secrets are never stored in localStorage/sessionStorage.
- Client secrets are returned only at application creation/rotation and are not recoverable later.
- GitHub deployment credentials remain server-side.
- Redirect URI and SSO scope authorization remain backend-enforced.

## Verification

`.github/workflows/verify.yml` syntax-checks frontend/backend JavaScript and verifies canonical Owner OS assets, factory contracts and GitHub deployment API contracts. Static checks do not substitute for a live staging deployment.
