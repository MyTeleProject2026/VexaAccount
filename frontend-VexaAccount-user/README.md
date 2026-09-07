# VexaAccount User Frontend

The user frontend is the account-center client for the VexaAccount identity platform.

## Current workflows

- Sign-in/registration and verification
- Profile and preferences
- Security, password/email changes and recovery
- Passcode controls
- People/privacy controls
- SSO application consent and active sessions
- Notifications and support interactions
- Authenticated storage/upload workflows

The frontend calls the VexaAccount backend and must not invent client-side authorization state.

## MTP2026 relationship

MTP2026 redirects users into the existing VexaAccount SSO authorization experience. After consent, VexaAccount returns an authorization code to the registered consumer callback. No VexaAccount source change is required for the MTP2026 consumer rebuild.

## Security

Do not store provider client secrets or refresh tokens in browser storage. Sensitive account changes must use the backend's verified workflow and session invalidation rules.
