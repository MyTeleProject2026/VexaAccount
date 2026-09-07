# VexaAccount SSO Integration

## Provider contract

VexaAccount is the identity provider. Consumers use the registered client ID, exact HTTPS redirect URI, allowed scopes, authorization code, PKCE S256 verifier/challenge, token endpoint and userinfo endpoint.

## Consumer requirements

A consuming backend should:

1. Generate unpredictable state and PKCE verifier.
2. Persist state/verifier server-side with a short expiry.
3. Send the user to VexaAccount authorization.
4. Consume the state exactly once.
5. Exchange the authorization code server-to-server.
6. Validate userinfo and establish the consumer's own session.
7. Keep Vexa client secrets and refresh tokens server-side.
8. Refresh access tokens when necessary.
9. Revoke the upstream session when the consumer logs out where supported.

## MTP2026 contract

MTP2026 follows this pattern. Its server owns `mtp_sso_login_transactions` and `mtp_sso_sessions`, encrypts stored Vexa access/refresh tokens, and exposes only its own HTTP-only session cookie to the frontend.

## Consent and revocation

Removing MTP2026 consent in VexaAccount revokes the related Vexa SSO session and refresh tokens. MTP2026 must treat rejected/expired upstream tokens as an authentication failure and require a new login.

## Boundary

Do not modify VexaAccount source files to implement MTP2026-specific UI or backend behavior. Make those changes in the MTP2026 repository.
