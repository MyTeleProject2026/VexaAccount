# VexaAccount SSO Integration Contract

VexaAccount is the identity provider. Consuming applications integrate through the registered SSO client contract.

## Provider contract

A consumer uses:

- registered client ID;
- exact HTTPS redirect URI;
- approved scopes;
- Authorization Code flow;
- S256 PKCE challenge/verifier;
- provider token endpoint;
- provider userinfo endpoint; and
- provider-side session/refresh-token lifecycle.

## Consumer implementation

A secure consuming backend should:

1. Generate unpredictable state.
2. Generate a high-entropy PKCE verifier and S256 challenge.
3. Store the login transaction with a short expiry.
4. Redirect the browser to VexaAccount authorization.
5. Validate and consume state exactly once.
6. Exchange the authorization code server-to-server.
7. Validate the returned userinfo and stable subject.
8. Create the consumer's own server-side session.
9. Keep provider client secrets and refresh tokens server-side.
10. Refresh access tokens only through the server-side token lifecycle.
11. Revoke/clear sessions during logout where supported.

## MTP2026 contract

MTP2026 follows this BFF-style boundary. Its backend owns `mtp_sso_login_transactions` and `mtp_sso_sessions`, encrypts stored Vexa access/refresh tokens and exposes only its own `mtp_session` cookie to browser code.

## Consent and revocation

Removing MTP2026 application consent in VexaAccount revokes the related provider SSO session and refresh tokens. MTP2026 must treat rejected, expired or revoked provider credentials as an authentication failure and start a fresh login.

## Cross-device rule

Do not copy VexaAccount, Telegram, WebApp or other third-party browser cookies/tokens between devices. Each device should create its own consumer application session through the normal SSO flow.

## Boundary

MTP2026-specific implementation and deployment fixes belong in `MyTeleProject2026/MTP2026-App-Launcher`. VexaAccount source should only change for provider-side requirements.