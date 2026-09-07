# VexaAccount User Frontend

The user frontend is the browser-facing account center for the VexaAccount identity platform.

## Functional surface

- Registration, sign-in and verification
- Profile and preferences
- Security state and security score
- Email/password change workflows
- Account recovery
- Passcode controls
- People/privacy controls
- SSO application consent
- Active SSO session visibility
- Notifications and support interactions
- Authenticated storage/upload workflows
- PWA installation/runtime support

## Authentication boundary

The frontend is never the authority for identity or permissions. It communicates with the VexaAccount backend using the canonical authenticated session workflow. Sensitive changes are verified and persisted by the backend, including the required session invalidation behavior.

Provider client secrets and refresh tokens must never be placed in frontend JavaScript, local storage or URLs.

## Account-center runtime

The account-center runtime is assembled from the existing loader, fetch/session guards, workflow bridge, runtime, premium theme and compatibility layers. These layers should be kept compatible with the backend API contracts rather than replaced with mock state.

## MTP2026

MTP2026 starts its consumer login through its own backend, which creates the server-side state/PKCE transaction and redirects the browser to VexaAccount. After authorization, the consumer receives an authorization code at its registered callback. VexaAccount remains the identity provider; MTP owns its own application session.

## Security behavior

- Use HTTPS in production.
- Treat backend session responses as authoritative.
- Do not store Vexa access/refresh tokens in browser storage.
- Clear invalid/expired authentication state and return to the sign-in flow when the backend requires it.
- Do not copy third-party cookies or WebApp tokens between devices.

## Production verification

A rendered account page is not sufficient proof of a working workflow. Verify the backend API response, persisted state and browser interaction for account/security changes and SSO-dependent actions.
