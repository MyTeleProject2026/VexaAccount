# VexaAccount

VexaAccount is the identity, account-management and SSO provider used by consuming applications such as MTP2026.

## Repository baseline

- Default branch: `master`
- Documentation update: September 7, 2026
- Current source baseline: `2911480811a16b71b8379a122bd46db2f8504681`
- Runtime stack: Node.js + Express + MySQL-compatible storage
- User client: `frontend-VexaAccount-user`
- Owner client: `frontend-VexaAccount-Super-admin`

This README describes the implementation that exists in the repository. It does not replace source-code behavior or claim production certification that has not been exercised.

## Architecture

```text
Browser
  ├── VexaAccount User Frontend
  └── VexaAccount Super Admin Frontend
          │
          ▼
     VexaAccount Backend
          ├── canonical user authentication/session
          ├── DB-backed Super Admin authentication
          ├── account/profile/security/recovery workflows
          ├── SSO authorization/token/session lifecycle
          ├── owner user/application/platform/support controls
          ├── authenticated storage
          └── System C observability
                    │
                    ▼
             MySQL-compatible DB
```

## Authentication and account workflows

The user account system covers registration/sign-in, verification, profile and preferences, security controls, password/email changes, recovery, passcode controls, people/privacy controls, SSO application consent, active SSO sessions, notifications, support interactions and authenticated storage.

Sensitive account and owner security changes invalidate affected sessions. Session-version changes provide an additional server-side invalidation boundary.

## SSO provider workflow

1. A consuming application is registered in the SSO registry.
2. The consumer uses an exact HTTPS redirect URI and allowed scopes.
3. The consumer creates fresh state and an S256 PKCE verifier/challenge.
4. The browser enters the VexaAccount authorization flow.
5. VexaAccount validates the client, redirect URI, state-related request data and scopes.
6. User authorization produces a one-time authorization code.
7. The consumer backend exchanges the code server-to-server with the PKCE verifier and client authentication.
8. The consumer obtains userinfo and creates its own application session.
9. VexaAccount maintains the provider-side SSO session and refresh-token lifecycle.
10. Consent removal, credential revocation or security changes revoke applicable provider-side sessions/tokens.

Provider client secrets and refresh tokens remain server-side. A consumer must never use browser storage as its identity authority.

## Owner Control Center

The Super Admin application is a real operating console backed by protected backend routes. It provides user administration, security/status controls, session revocation, SSO application registration and lifecycle management, redirect URI/scope management, credential rotation/revocation, support, platform controls and System C observability.

Frontend visibility is never the authorization boundary. Backend middleware performs the actual authorization.

## SSO Application Integration Kit

The Owner-only kit provides a read-only target source analyzer, precise source planner, generated integration files and an explicit GitHub installation flow.

The current generated implementation is intentionally Node.js/Express-oriented. Unsupported backend stacks are rejected rather than receiving incompatible generated code.

The installation boundary is protected by:

- signed source-plan token;
- current reviewed source blob SHA verification;
- current target branch-head SHA verification;
- signed generated-file manifest containing exact file SHA-256 and byte size;
- exact generated-file-set verification; and
- explicit Owner approval before repository installation.

The analyzer never writes to a target repository. Existing authentication files are not silently replaced.

## System C

System C is an authenticated observability surface for identity, SSO/session activity, API/latency signals, security events, audit events and runtime health. Its UI requires a live Super Admin session and its backend routes remain protected independently.

## Migrations

`backend/scripts/migrate.js` applies ordered SQL migrations and records them in `vexa_schema_migrations`. The current migration set covers SSO core/security, owner controls, application lifecycle, account center, passcode, observability and session-version compatibility.

## Production verification boundary

Source/build verification, API health and smoke tests are useful but are not equivalent to production certification. A true production certification requires the deployed services, real database, registered SSO client, configured secrets and authenticated end-to-end browser flow to be exercised.

The repository deliberately uses precise wording: source/build verified when only source-level checks passed; production verified only after the deployed integration path has actually succeeded.

## Consumer boundary: MTP2026

MTP2026 is a consuming SSO application. Its own backend owns its login transaction, PKCE verifier, encrypted provider token storage and `mtp_session` cookie. Consumer-specific fixes belong in `MyTeleProject2026/MTP2026-App-Launcher`; VexaAccount should not be changed merely to compensate for an MTP-side implementation problem.

## Security rules

- HTTPS in production.
- Exact redirect URI matching.
- Authorization Code + S256 PKCE.
- One-time authorization codes and state.
- Server-side consumer sessions.
- HttpOnly/Secure session cookies where applicable.
- No provider client secrets in browser bundles.
- No refresh tokens in browser storage.
- No copying of third-party browser/WebApp cookies between devices.
- Audit and session invalidation for sensitive owner/account operations.

## Related documentation

See `docs/` for SSO, Owner Control Center, System C, diagnostics, production E2E and current implementation details. Packaging and integration-specific READMEs describe their respective boundaries.