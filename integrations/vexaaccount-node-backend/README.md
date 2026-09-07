# VexaAccount Node Backend Integration

This integration package demonstrates the server-side consumer boundary for VexaAccount SSO.

## Required behavior

- Register an application in VexaAccount with exact HTTPS redirect URI(s) and scopes.
- Generate server-side state and PKCE verifier.
- Exchange authorization codes server-to-server.
- Fetch VexaAccount userinfo server-to-server.
- Establish a consumer-owned HTTP-only session.
- Keep client secrets and refresh tokens server-side.
- Revoke/clear sessions on logout where supported.

## MTP2026

MTP2026 already implements its consumer session boundary in its own repository. Do not copy VexaAccount internals into MTP2026 and do not modify VexaAccount for MTP-specific behavior.

## Production

Use environment variables/secrets for credentials and encryption keys. Never commit real credentials. Validate the deployed callback URI and provider registration before testing login.
