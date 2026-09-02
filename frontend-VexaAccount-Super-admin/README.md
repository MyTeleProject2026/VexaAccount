# VexaAccount Super Admin Frontend

Standalone static frontend for the Vexa ecosystem Owner / Super Admin control plane.

## Deployment

Deploy this directory independently from the VexaAccount backend and User frontend.

Configure the backend/API origin through environment-specific frontend configuration. Never place database credentials, JWT signing keys, Client Secrets, or other server secrets in this static application.

## Canonical runtime

`index.html` loads the single `owner-console-runtime.js` plus the integrated `owner-control-center.js` and required presentation styles. The previous legacy `app.js`, SSO patch scripts, user-management patch runtime, support patch runtime and React notification runtime have been removed.

Client Secrets are deliberately returned by the backend only during application creation/rotation and displayed transiently so an Owner can transfer the secret to an external application's backend. Secrets are not persisted by the browser, embedded in `VEXA_ACCOUNT_SSO_CONFIG`, placed in URLs, or written into generated receipts/PDFs.

## Responsibilities

- VexaAccount user administration
- SSO application/client management
- Redirect URI and scope administration
- Sessions and security monitoring
- Audit/security event review
- Roles and administrative permissions
- Ecosystem application controls
- System health and configuration UI
- Owner support and user notification workflow

## Verification

Repository CI enforces the canonical runtime and source-tree cleanup contracts. The production E2E workflow also includes an authenticated user → Owner support → user notification → notification acknowledgement → audit verification when the four dedicated E2E credentials are configured as GitHub Actions secrets.
