# VexaAccount Owner Control Center

The Owner Control Center is the privileged operating surface for the VexaAccount identity platform.

## Authentication boundary

Every privileged operation is authorized by the backend's DB-backed Super Admin authentication middleware. Browser UI state, hidden buttons, local storage or client-side role flags are never sufficient authorization.

## Owner capabilities

### User administration

- Search and inspect users.
- Inspect account and security state.
- Apply supported account status/security controls.
- Revoke affected sessions.
- Perform permitted account administration and user deletion workflows.
- Preserve audit/security events for sensitive operations.

### SSO application registry

- Register consuming applications.
- Manage exact HTTPS redirect URIs.
- Manage allowed scopes.
- Enable or disable applications.
- Rotate and revoke client credentials.
- Revoke application sessions/tokens when required.
- Inspect SSO diagnostics and lifecycle state.

### Integration Kit

Owner OS includes an application integration workflow that can analyze an allowlisted GitHub repository without modifying it, build a precise source plan, generate supported integration files and optionally install only Owner-approved generated files.

The installation guard binds the operation to the reviewed source blob SHAs, branch head SHA and signed generated-file manifest. Any source or branch change requires a new review/plan. Generated content cannot be silently substituted between review and installation.

### Support and platform

Support replies and platform/account-center controls use authenticated backend workflows and persisted state. The UI is a control surface, not a mock state store.

### System C

System C provides authenticated observability for identity, SSO/session, API and latency, security, audit and runtime/health signals. Both UI entry and backend routes enforce the Super Admin boundary.

## Secure SSO operating sequence

1. Register the application.
2. Confirm exact HTTPS callback URI(s).
3. Configure only required scopes.
4. Generate/rotate the client credential through the owner backend workflow.
5. Store the secret only in the consuming backend secret manager.
6. Test Authorization Code + S256 PKCE.
7. Verify userinfo and consumer-owned session creation.
8. Verify logout/revocation and consent removal.

Client secrets and refresh tokens must never be placed in frontend JavaScript or browser storage.

## MTP2026 boundary

MTP2026 is a registered SSO consumer. Its consumer-side login transaction, PKCE state, token encryption and `mtp_session` are owned by the MTP2026 repository. Do not add MTP-specific implementation to VexaAccount merely to fix a consumer-side defect.

## Verification boundary

A visible Owner button or successful frontend request does not prove persistence or downstream success. High-impact operations should be verified through API response, database state, session/token state and resulting application behavior.
