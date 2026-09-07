# VexaAccount Backend

The backend is the authoritative implementation for authentication, account workflows, SSO, owner controls, storage, support/notification persistence and observability.

## Runtime

- Node.js + Express
- MySQL-compatible database via `mysql2/promise`
- TLS-aware database connection
- Transactional migration runner: `scripts/migrate.js`

## Authentication boundaries

- User routes use the canonical user-session authentication middleware.
- Super Admin routes use DB-backed `requireSuperAdmin` authentication.
- SSO uses registered clients, PKCE, authorization codes, access/refresh tokens and server-side sessions.
- Sensitive changes invalidate sessions and related SSO credentials as required.

## Database

Migrations are ordered and recorded in `vexa_schema_migrations`. The current baseline includes SSO core/security, owner controls, application lifecycle, account center, passcode, observability and session-version compatibility migrations.

## Integration rule

MTP2026 consumes VexaAccount's existing SSO/API contract. MTP changes belong in the MTP2026 repository; this backend must not be modified for ordinary MTP integration work.

## Production verification

A source build or local smoke test is not production certification. Validate deployed API responses, real database persistence, SSO exchange, session lifecycle and authenticated browser behavior when credentials/environment permit.
