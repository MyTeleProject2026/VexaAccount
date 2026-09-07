# Production E2E Guidance

## Required layers

1. Build and syntax checks.
2. Backend health/database connectivity.
3. Migration state and required tables.
4. SSO client registration and exact redirect URI.
5. Authorization-code + PKCE exchange.
6. Userinfo retrieval.
7. Server-side session creation and cookie behavior.
8. Refresh and logout/revocation.
9. Browser navigation and UI behavior.
10. Persistence verification for account, support, notification and storage workflows.

## VexaAccount checks

The E2E workflow can run public smoke checks and authenticated checks when the required GitHub secrets are configured. Authenticated tests require real test credentials.

## MTP2026 checks

MTP2026 must independently verify its deployed frontend revision, backend health, TiDB MySQL connection, SSO configuration and login redirect contract. A production browser login should be tested with a real VexaAccount test account before declaring certification.

## Security

Never put client secrets, refresh tokens or session encryption keys in frontend bundles, URLs or logs. Verify that one-time login state cannot be replayed and that logout/revocation removes local sessions.

## Certification wording

Use “source/build verified” for code checks. Use “production verified” only after the deployed runtime and real integration path have actually been exercised.
