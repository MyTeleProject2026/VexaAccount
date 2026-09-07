# Production E2E Verification

Production verification must follow the complete deployed workflow rather than stopping at compilation or a green source-level test.

## Verification layers

1. Source syntax/build checks.
2. Deployed frontend availability and revision.
3. Deployed backend health.
4. Real database connectivity.
5. Migration ledger and required tables.
6. Super Admin authentication for owner-only checks.
7. SSO client registration and active status.
8. Exact HTTPS redirect URI.
9. Allowed scopes.
10. Authorization Code + S256 PKCE authorization.
11. One-time state/code consumption.
12. Server-to-server token exchange.
13. Userinfo and stable subject.
14. Consumer-owned session creation.
15. Cookie security and browser navigation.
16. Refresh behavior.
17. Logout and revocation.
18. Consent removal and provider-side session/token revocation where applicable.
19. Account/profile/security persistence.
20. Support/notification persistence.
21. Authenticated storage behavior.
22. System C observability and audit signals.

## VexaAccount automated checks

Repository workflows include verification, runtime smoke and authenticated E2E tooling. Authenticated production checks require real test credentials and the corresponding deployment configuration.

A green static/build workflow does not prove a real user can complete an SSO login.

## MTP2026 checks

MTP2026 must independently verify its deployed frontend revision, backend health, TiDB/MySQL connectivity, SSO configuration, login redirect contract, callback exchange, `mtp_session` creation, refresh and logout. A real VexaAccount test account should complete the browser flow before production certification.

## Security rules

Never put client secrets, refresh tokens, session encryption keys, authorization codes or PKCE verifiers into frontend bundles, URLs or logs. Verify that state and one-time codes cannot be replayed and that logout/revocation removes local sessions.

## Certification language

- **Source/build verified:** repository/build-level checks passed.
- **Runtime verified:** deployed health/smoke behavior passed.
- **Production verified:** the actual deployed authenticated integration path passed.

Do not use stronger wording than the evidence supports.