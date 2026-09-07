# VexaAccount Super Admin Frontend

The Super Admin frontend is the Owner operating console for the VexaAccount provider.

## Functional areas

- Super Admin authentication/session state
- User administration and account security controls
- Session revocation and account lifecycle operations
- SSO application registry and lifecycle
- Redirect URI and scope management
- Credential rotation/revocation workflows
- SSO diagnostics
- SSO Application Integration Kit
- Owner GitHub installation workflow
- Support and platform controls
- System C observability

## Backend authority

The frontend is a control surface. Every privileged action must resolve to a protected backend route and the backend decides authorization. UI state, local storage or hidden controls must never be treated as permission.

## Integration Kit safety

The Owner integration workflow performs bounded read-only target analysis, produces a source plan, generates supported Node.js/Express integration files and optionally installs Owner-approved files.

Installation is protected by signed source-plan verification, reviewed Git blob checks, branch-head locking, signed generated-file manifest verification and explicit Owner approval. A source or branch change causes the installation to fail closed.

## Secrets

Do not put GitHub tokens, SSO client secrets or refresh tokens in browser code or persistent browser storage. Credentials and cryptographic signing secrets belong in backend/deployment secret management.

## MTP2026

MTP2026 is an SSO consumer. Its consumer-specific login, session and deployment behavior belongs in `MyTeleProject2026/MTP2026-App-Launcher`. Provider-side Owner UI should not be changed merely to accommodate an MTP consumer defect.

## Production verification

A loaded Owner page or successful button click is not proof that a privileged mutation persisted. For important operations verify the API result, database state, session/token state and downstream behavior. Use production certification wording only after the deployed workflow has actually been exercised.
