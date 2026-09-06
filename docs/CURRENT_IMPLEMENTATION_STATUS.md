# VexaAccount Current Implementation Status

This document is the current source/deployment verification reference for `master`.

## Source authority

The authoritative implementation is the current `master` source tree. Existing working workflows must remain intact; verification must not be made green by removing checks or weakening security contracts.

## Current canonical frontends

### User

`frontend-VexaAccount-user/index.html` loads the canonical User runtime. `account-center-loader.js` then loads `account-center-runtime-v2.js`; the runtime is intentionally loaded transitively rather than as a duplicate direct script tag.

The User entrypoint also loads `functional-runtime-bridge.js`, `account-workflow-bridge.js`, `sso-frontend.js`, `auth-session-bridge.js`, notification runtime and PWA runtime.

### Super Admin / Owner OS

`frontend-VexaAccount-Super-admin/index.html` loads `owner-os.js`, `sso-integration-generator.js`, `sso-runtime-sync.js`, `sso-status-sync.js`, `sso-integration-factory-v4.js`, `sso-github-deployer.js`, `sso-application-integration-builder.js` and `sso-application-builder-launcher.js`.

## Backend authority

The backend owns authentication, database state, Account Center workflows, recovery, security, SSO authorization/token lifecycle, application registry, Owner controls and audit/security operations.

`GET /api/health` performs a real database health query.

User sessions are validated against `store_users.session_version`; logout, password/security changes and account containment operations invalidate server-side sessions through the existing session-version mechanism.

## Static verification

The repository verification workflow checks JavaScript syntax, OTP security, account/recovery workflows, credential-change workflows, SSO PKCE/token lifecycle, JWT invalidation, User runtime entrypoints, Owner OS entrypoints and deployment API contracts.

The latest recorded full source verification for commit `bbb7e53cc32aa4e4982e1402ca3186cddf1eda03` completed successfully.

## Production runtime smoke

The production runtime smoke checks the deployed API and the actual deployed User and Super Admin HTML/assets.

The previous runtime failure was caused by an incorrect smoke assertion that required `account-center-runtime-v2.js` to appear as a direct `index.html` script tag. The actual current source correctly loads that runtime through `account-center-loader.js`.

The smoke test was corrected to verify the real loader chain and to fetch the transitive runtime asset. The corrected production runtime smoke for commit `3a49b3a1f9373b1cc7640301d5b16cf0599c62be` completed successfully:

- API health/database: passed
- public authentication contracts: passed
- User frontend canonical runtime chain: passed
- Super Admin canonical Owner OS: passed

Therefore the **current production runtime smoke is passing**.

## Deployment rule

Do not weaken the runtime smoke to accommodate a stale deployment. Validate the real deployed HTML and assets against the current canonical source. A hosting configuration problem must be fixed at the hosting/deployment layer rather than hidden by changing the smoke expectations.

## Documentation rule

README and documentation files must describe the current canonical runtime and must not claim production certification unless the corresponding live smoke/E2E checks have actually passed.
