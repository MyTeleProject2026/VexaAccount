# VexaAccount Node.js/Express Consumer Integration

This directory contains the reusable Node.js/Express consumer boundary for integrating an application with VexaAccount SSO.

## Provider contract

Register the consuming application in VexaAccount first. Configure exact HTTPS redirect URI(s), required scopes and the server-side client credential.

The consumer uses Authorization Code + S256 PKCE:

1. Generate state and PKCE verifier.
2. Store the transaction server-side or in an equivalently protected encrypted mechanism with a short expiry.
3. Redirect the browser to VexaAccount authorization.
4. Validate and consume the callback state exactly once.
5. Exchange the authorization code server-to-server with the verifier.
6. Retrieve VexaAccount userinfo server-to-server.
7. Establish a consumer-owned HttpOnly session.
8. Keep provider client secrets and refresh tokens server-side.
9. Refresh or revoke upstream credentials according to the provider contract.

## Generated adapter

The current reusable kit targets Node.js/Express and can generate a backend adapter plus frontend metadata/adapter. It deliberately rejects unsupported backend stacks instead of pretending that Express code is portable to another framework.

## Secret boundary

The consumer owns its own application `JWT_SECRET` or session secret. VexaAccount does not need that secret. The VexaAccount client secret belongs only in the consumer backend secret manager.

Never commit credentials, private keys, refresh tokens or session encryption keys.

## MTP2026

MTP2026 already owns its consumer-side login transaction, PKCE verifier, encrypted provider token storage and `mtp_session`. MTP-specific fixes and deployment changes belong in `MyTeleProject2026/MTP2026-App-Launcher`.

## Production checklist

- Provider application is active.
- Redirect URI matches exactly.
- Requested scopes are registered.
- Client secret is server-side.
- PKCE uses S256.
- State/verifier cannot be replayed.
- Userinfo returns a stable subject.
- Consumer session is created with Secure/HttpOnly settings appropriate to deployment.
- Logout/revocation behavior is tested.
- Browser never receives provider refresh tokens.
