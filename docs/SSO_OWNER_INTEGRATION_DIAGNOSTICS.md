# SSO Owner Integration Diagnostics

Use this sequence when a registered SSO consumer cannot complete login.

## Provider-side diagnostic chain

1. Confirm the Super Admin session is live.
2. Confirm the registered client exists and is active.
3. Confirm the client ID used by the consumer matches the registry.
4. Compare the redirect URI exactly with the registered HTTPS URI.
5. Confirm every requested scope is allowed.
6. Confirm the client secret is supplied only by the consumer backend.
7. Confirm PKCE uses S256 and the callback verifier matches the original challenge.
8. Confirm authorization state is fresh and consumed only once.
9. Confirm the authorization code is exchanged before expiry and cannot be replayed.
10. Confirm token response and refresh lifecycle are valid.
11. Confirm userinfo returns the expected stable `sub`.
12. Confirm the consumer creates its own authenticated session.
13. For logout, inspect consumer session removal and provider-side revocation.
14. For consent removal, verify the related provider SSO session and refresh tokens are revoked.

## MTP2026 troubleshooting order

Start with the MTP backend. MTP owns its login transaction, PKCE verifier/state, token encryption and `mtp_session`. Verify MTP deployment, environment, database tables and callback handling before changing provider code.

Only change VexaAccount when the provider contract itself is demonstrably incorrect or a separately authorized VexaAccount defect is identified.

## Do not collect secrets

Never request, print or log raw client secrets, refresh tokens, access tokens, authorization codes, PKCE verifiers or encryption keys while diagnosing an integration.

Use IDs, status codes, timestamps, non-secret hashes and sanitized event metadata instead.

## Integration Kit diagnostics

If Owner GitHub installation fails, inspect the signed plan expiry, repository/branch binding, reviewed source blob SHA, current branch head, generated manifest, generated file SHA-256/size and Owner approval state. Any mismatch should produce a fail-closed result and require a new read-only plan rather than forcing a write.