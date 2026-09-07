# VexaAccount Super Admin Frontend

The Super Admin frontend is the owner operating console for the VexaAccount provider.

## Current working areas

- Owner authentication/session
- User administration and security controls
- SSO application registry and lifecycle
- SSO diagnostics and integration tooling
- Support and platform controls
- System C observability

All privileged actions must resolve to protected backend routes. UI state is never the authority for permission.

## SSO consumer rule

MTP2026 is managed as a registered SSO consumer. Consumer-specific implementation and debugging belong in `MyTeleProject2026/MTP2026-App-Launcher`.

## Security

Never display or persist raw client secrets or refresh tokens in browser storage. Credential rotation/revocation must be performed through the authenticated owner backend workflow.
