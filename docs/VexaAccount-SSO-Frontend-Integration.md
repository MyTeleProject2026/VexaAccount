# VexaAccount SSO Frontend Integration

The browser is a consumer interface. It must not become the holder of VexaAccount client secrets or provider refresh tokens.

## Recommended consumer pattern

```text
Consumer frontend
   → consumer backend /api/auth/login
   → server-side state + PKCE transaction
   → VexaAccount authorization
   → consumer backend callback
   → server-to-server code exchange
   → VexaAccount userinfo
   → consumer-owned HTTP-only session
   → consumer frontend
```

The frontend should call its own backend session endpoint and use credentialed requests. Provider access/refresh tokens remain server-side.

## MTP2026

The MTP frontend starts login through its backend `/api/auth/login`. The MTP backend creates the login transaction and PKCE material, redirects to VexaAccount and consumes the callback. On success it creates the `mtp_session` cookie.

The frontend checks `/api/auth/session` and never treats a browser-stored provider token as proof of identity.

## Error handling

- Remove callback query parameters after processing.
- Show a clear authentication failure when the backend rejects an expired/invalid session.
- Return to the sign-in state when a new authorization is required.
- Do not retry one-time authorization callbacks indefinitely.

## Security requirements

- HTTPS in production.
- Credentialed requests for the consumer session cookie.
- HttpOnly/Secure/SameSite settings appropriate to the deployment.
- No provider client secret in frontend source or bundle.
- No provider refresh token in localStorage/sessionStorage.
- No authentication bypass based on frontend state.
- No copying of third-party cookies or WebApp tokens between devices.

## Boundary

This document describes consumption of the existing VexaAccount provider contract. Consumer-specific fixes belong in the consumer repository.