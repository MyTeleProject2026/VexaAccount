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

### Integration Kit and Source Repair

- Select an SSO application and its authorized repository/branch for source work.
- Run bounded read-only repository analysis before any target write.
- Detect frontend/backend stacks and authentication, session, callback and routing candidates.
- Produce affected-file findings and a precise source review plan.
- Generate supported integration files and target-specific repair candidates.
- Review source changes and integrity information before installation.
- Run a fresh preflight against the current repository state.
- Explicitly approve the final protected commit.
- Follow resulting CI/deployment verification rather than treating commit success as runtime certification.

The Source Repair console is intended to be an Owner-controlled repair workflow, not a generic unrestricted GitHub editor. Secret-bearing and credential files are blocked, analysis is bounded, and target writes remain behind source-integrity checks and explicit approval.

### Support and platform

Support replies and platform/account-center controls use authenticated backend workflows and persisted state. The UI is a control surface, not a mock state store.

### System C

System C provides authenticated observability for identity, SSO/session, API and latency, security, audit and runtime/health signals. Both UI entry and backend routes enforce the Super Admin boundary.

## Secure SSO operating sequence

1. Register the application.
2. Bind/confirm the authorized repository and exact HTTPS callback URI(s).
3. Configure only required scopes.
4. Generate/rotate the client credential through the Owner backend workflow.
5. Store the secret only in the consuming backend secret manager.
6. Test Authorization Code + S256 PKCE.
7. Verify userinfo and consumer-owned session creation.
8. Run diagnostics and, when needed, Source Repair analysis.
9. Review any generated repair/integration source.
10. Run fresh preflight and explicitly approve installation/commit.
11. Verify logout/revocation and consent removal.
12. Verify the deployed consumer runtime and CI status.

Client secrets and refresh tokens must never be placed in frontend JavaScript or browser storage.

## MTP2026 boundary

MTP2026 is a registered SSO consumer. Its consumer-side login transaction, PKCE state, token encryption and `mtp_session` are owned by the MTP2026 repository. VexaAccount provides the identity/SSO contract and Owner tooling; consumer-specific source repairs should be made in the consumer repository through the protected Owner workflow rather than embedding MTP-specific business logic in VexaAccount.

## Verification boundary

A visible Owner button or successful frontend request does not prove persistence or downstream success. High-impact operations should be verified through API response, database state, session/token state, CI/deployment status and resulting application behavior.
