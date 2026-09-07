# VexaAccount SSO Frontend Integration

The browser is a consumer UI, not the holder of the VexaAccount client secret.

## MTP2026 pattern

The MTP frontend starts login by calling its own backend `/api/auth/login`. The MTP backend creates and stores state/PKCE material, then redirects to VexaAccount. After authorization, the backend consumes the callback, exchanges the code and creates an HTTP-only `mtp_session` cookie.

The frontend checks `/api/auth/session` and uses credentialed requests to MTP APIs. It does not store Vexa access or refresh tokens in localStorage.

## Error handling

The frontend must clear callback query parameters after processing, show an actionable authentication error, and return to the sign-in state when the backend reports an expired/invalid session.

## Security rules

- Use HTTPS in production.
- Use credentialed requests for the MTP session cookie.
- Never expose the Vexa client secret.
- Never treat a frontend-stored token as proof of identity.
- Do not bypass the MTP backend session boundary.

## Integration boundary

This document describes how a consumer uses the existing VexaAccount provider. Consumer-specific fixes belong in the consumer repository.
