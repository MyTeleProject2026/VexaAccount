# Owner Control Center Workflow

## Authentication

Owner operations begin with the live DB-backed Super Admin session. Frontend state alone is never sufficient authorization.

## User operations

Owner user actions call protected backend routes, validate the target user, perform the requested mutation, write audit/security information where applicable, and invalidate affected sessions for security-sensitive changes.

## SSO operations

The owner registers an application with exact HTTPS redirect URI(s) and allowed scopes. The lifecycle supports create, inspect, update, enable/disable, rotate credentials and revoke application sessions. MTP2026 uses this registry as an SSO consumer.

## Platform and support

Platform settings and support actions are server-authorized and persisted. Frontend controls are only controls for the corresponding backend routes; they are not mock UI state.

## System C

System C provides authenticated observability over identity, SSO/session, API, latency, security and audit activity. It requires a live Super Admin session.

## Integration boundary

Do not add MTP-specific logic to the VexaAccount owner panel. MTP2026 owns its own integration, deployment and runtime session behavior.
