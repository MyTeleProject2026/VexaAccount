# VexaAccount Backend

The backend is the authoritative server for VexaAccount identity, account management, SSO, Owner controls, storage, support/notification persistence and System C observability.

## Runtime

- Node.js + Express
- `mysql2/promise` with TLS-aware database configuration
- Transactional migration runner: `scripts/migrate.js`
- Database migration ledger: `vexa_schema_migrations`

## Authentication boundaries

### User authentication

User-protected routes use the canonical user session/authentication middleware. Account and security mutations verify the current authenticated user and invalidate sessions when required.

### Super Admin authentication

Privileged owner routes use DB-backed Super Admin authentication through `requireSuperAdmin`. Frontend role flags are never authoritative.

### SSO

The provider implements registered clients, exact redirect URI validation, scopes, Authorization Code + S256 PKCE, one-time authorization codes, access/refresh tokens and provider-side SSO sessions.

## Account workflows

The backend exposes the real server-side workflows behind profile/preferences, security, email/password changes, recovery, passcode controls, people/privacy, application consent, SSO sessions, support, notifications and authenticated storage.

Security-sensitive changes can increment session version and revoke affected sessions/tokens.

## Owner and integration services

Owner routes cover user administration, SSO registry/lifecycle, support, platform controls, diagnostics and System C. The SSO Application Kit provides read-only GitHub analysis/planning and controlled generation/installation.

The GitHub installation service requires a signed source plan, current source blob matches, unchanged branch head and a signed generated-file manifest. The generated manifest binds exact paths, SHA-256 content hashes and byte sizes. Target writes fail closed when integrity checks do not match.

## Environment and secrets

Server credentials remain server-side. In particular, GitHub credentials and SSO client secrets must never be embedded in frontend bundles. The SSO plan-token signing secret must be a stable deployment secret of at least 32 characters; it must be consistent across backend instances.

## Database migrations

Run `scripts/migrate.js` as part of deployment/startup according to the service configuration. Migrations are ordered, recorded and designed to be restart-safe where compatibility migrations require it.

## Production verification

Source checks and public smoke checks do not equal production certification. Verify deployed API health, database connectivity, migration state, registered SSO client, redirect URI, PKCE exchange, userinfo, session creation, refresh, logout/revocation and authenticated browser behavior.

## Consumer boundary

MTP2026 is an external consumer. Its MTP-specific session, PKCE login transaction and token encryption belong in `MyTeleProject2026/MTP2026-App-Launcher`. VexaAccount backend changes should only be made for VexaAccount/provider requirements, not as a shortcut for consumer-side bugs.
