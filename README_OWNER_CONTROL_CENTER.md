# VexaAccount Owner Control Center

## Current status

The Owner Control Center is the Super Admin operating surface for the VexaAccount platform. It is backed by the canonical DB-backed Super Admin authentication middleware and real backend routes.

### Owner areas

- **Users:** search users, inspect account state, change supported status/security controls, revoke sessions and perform permitted account administration.
- **SSO Registry:** create/update registered applications, manage redirect URIs and scopes, toggle application status, rotate credentials and revoke application sessions.
- **Support:** owner-side support operations and user-facing support replies are persisted through backend workflows.
- **Platform:** platform/account-center settings are controlled through authenticated owner routes.
- **System C:** identity, SSO/session, API latency, security and audit observability; UI access is gated by a live Super Admin session.

### Security rules

All owner mutations must use the canonical `requireSuperAdmin` authentication path. User security/status changes and explicit revoke-all operations invalidate canonical user sessions and related SSO sessions/tokens where applicable.

### SSO operating lifecycle

Register the application first, verify exact HTTPS redirect URI(s), configure allowed scopes, generate/rotate the client secret, then configure the consuming application's server-side environment. Client secrets must never be sent to browser code.

### MTP2026

MTP2026 is a consuming SSO client. Its integration is intentionally implemented in the MTP2026 repository. Do not edit VexaAccount code to accommodate ordinary MTP integration changes.

### Verification boundary

Owner UI availability does not prove a production action succeeded. Verify the API response, persisted database state, resulting session/token state and downstream behavior for high-impact operations.
