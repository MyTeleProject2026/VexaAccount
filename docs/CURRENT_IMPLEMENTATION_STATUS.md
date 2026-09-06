# VexaAccount Current Implementation Status

This document is the current source/deployment verification reference for `master`.

## Source authority

The authoritative implementation is the current `master` source tree. Existing working workflows must remain intact; verification must not be made green by removing checks or weakening security contracts.

## Current canonical frontends

### User

`frontend-VexaAccount-user/index.html` loads the canonical User runtime, including:

- `account-center-runtime-v2.js` through the Account Center loader
- `functional-runtime-bridge.js`
- `account-workflow-bridge.js`
- `sso-frontend.js`
- `auth-session-bridge.js`
- notification and PWA runtime

### Super Admin / Owner OS

`frontend-VexaAccount-Super-admin/index.html` loads:

- `owner-os.js`
- `sso-integration-generator.js`
- `sso-runtime-sync.js`
- `sso-status-sync.js`
- `sso-integration-factory-v4.js`
- `sso-github-deployer.js`
- `sso-application-integration-builder.js`
- `sso-application-builder-launcher.js`

## Backend authority

The backend owns authentication, database state, Account Center workflows, recovery, security, SSO authorization/token lifecycle, application registry, Owner controls and audit/security operations.

`GET /api/health` performs a real database health query.

User sessions are validated against `store_users.session_version`; logout, password/security changes and account containment operations invalidate server-side sessions through the existing session-version mechanism.

## Static verification

The current repository verification workflow checks JavaScript syntax, OTP security, account/recovery workflows, credential-change workflows, SSO PKCE/token lifecycle, JWT invalidation, User runtime entrypoints, Owner OS entrypoints and deployment API contracts.

The latest recorded verification run for commit `bbb7e53cc32aa4e4982e1402ca3186cddf1eda03` completed successfully.

## Production runtime smoke

The production runtime smoke checks the deployed API and the actual deployed User and Super Admin HTML/assets. It is intentionally stricter than source verification.

The latest recorded runtime smoke run for commit `bbb7e53cc32aa4e4982e1402ca3186cddf1eda03` failed because the deployed User frontend did not serve the current canonical runtime assets even though those assets exist in the current repository source.

Therefore production certification is **not complete** until the deployed User frontend is updated to the current source and the runtime smoke passes through the Super Admin checks.

## Deployment rule

Do not weaken the runtime smoke to accommodate a stale deployment. Fix the deployment source/root/trigger configuration so the deployed application serves the current repository files. The GitHub repository alone cannot rewrite an external hosting service's deployment configuration when that hosting account/service is not connected to the current deployment control plane.

## Documentation rule

This document records the current implementation state. Other README files should describe the same current canonical runtime and must not claim production certification unless the corresponding live smoke/E2E checks have actually passed.
