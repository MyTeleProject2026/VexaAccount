# VexaAccount

## Current production workflow baseline

This repository is the identity and account platform used by MTP2026. The current `master` baseline is the source of truth for the already-implemented VexaAccount workflow. From this point forward, MTP2026 changes must integrate with these existing contracts rather than changing VexaAccount.

### Core architecture

- **Backend:** Node.js/Express with MySQL-compatible storage and transactional migrations.
- **User frontend:** `frontend-VexaAccount-user` — account center, authentication, profile/security, application consent, sessions, notifications and account workflows.
- **Owner frontend:** `frontend-VexaAccount-Super-admin` — owner control center, user controls, SSO registry/integration, support, platform controls and System C observability.
- **SSO:** OAuth-style authorization-code flow with PKCE, registered clients, scopes, one-time authorization codes, access/refresh tokens and server-side sessions.
- **Storage:** authenticated user uploads use the canonical user session and persisted storage records.
- **Security:** canonical user and Super Admin authentication, session-version invalidation, SSO-session/refresh-token revocation and audit/security events.
- **Migrations:** `backend/scripts/migrate.js` transactionally applies SQL migrations recorded in `vexa_schema_migrations`.

### Current SSO lifecycle

1. MTP2026 starts login against its backend.
2. MTP backend creates server-side state + PKCE verifier/challenge.
3. User is sent to VexaAccount authorization.
4. VexaAccount validates the registered client, redirect URI and requested scopes.
5. After user authorization, VexaAccount issues a one-time authorization code.
6. MTP backend exchanges the code using client authentication + PKCE verifier.
7. MTP fetches VexaAccount userinfo and creates its own encrypted server-side session.
8. MTP requests remain authenticated through the MTP session cookie; Vexa access/refresh tokens are never exposed to browser JavaScript.
9. Refresh uses the Vexa refresh-token contract. Logout/revocation removes the MTP session and attempts upstream Vexa revocation.
10. Removing application consent in VexaAccount revokes the related Vexa SSO session and refresh tokens.

### Account and security workflows

The implemented account center supports profile/preferences, security state, email-change verification, password changes, recovery flows, passcode controls, people/sharing controls, SSO application consent, SSO sessions and security events. Sensitive account/security changes invalidate canonical sessions as appropriate.

### Owner controls

The Super Admin control center uses DB-backed Super Admin authentication. Owner operations include user search/control, account status/security controls, session revocation, SSO client registry/lifecycle, redirect URI and scope management, credential rotation/revocation, support, platform settings and System C observability.

### Important integration rule

**Do not modify VexaAccount `master` as part of MTP2026 work.** MTP2026 must consume the published VexaAccount API/SSO contract. If an MTP issue appears, fix the MTP repository first unless a separate, explicitly authorized VexaAccount task is requested.

### Production verification

The repository contains smoke/E2E tooling, but a passing source-level test is not the same as browser-level production certification. Production certification requires the deployed services, real database, configured SSO client credentials and authenticated test accounts to be exercised.

Current VexaAccount `master` baseline: `8697a9d9341ab5ee02805fb90dc351c5494ec547`.
