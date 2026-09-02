# VexaAccount — Owner Control Center Update

## Latest architecture

VexaAccount has a central Owner Control Center in the Super Admin frontend. The Owner can use authenticated, audited workflows for supported user-account, security, SSO application, redirect URI and support operations.

### User account controls

- Search and inspect user accounts
- Edit supported profile fields
- Enable/disable account status
- Reset 2FA enrollment
- Reset passcode enrollment
- Revoke all active SSO sessions and refresh tokens
- Adjust credit score and coins with a reason
- Inspect/manage storage metadata
- Add Owner notes
- Permanently delete an account after explicit email confirmation
- Inspect sessions and security events

### SSO controls

- Create/manage registered SSO applications through the application registry
- Approve/disable/maintain/revoke applications
- Manage exact redirect URI allowlists
- Manage allowed scopes
- Rotate client credentials
- Inspect SSO sessions, consents and audit events

### Redirect URI contract

```text
GET    /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
```

Redirect URIs are validated server-side. Only exact active registered values may be used by `/api/sso/authorize`.

### Support

The Owner Control Center exposes support tickets and two-way conversation controls. Owner replies are persisted and generate user notifications. Ticket status is explicitly managed.

### Security boundary

The Owner Control Center does not execute arbitrary production source code or SQL. It controls supported platform behavior through explicit authenticated APIs, validation, database operations, audit events and deployment-controlled source changes.

### SSO secret boundary

```text
VEXA_ACCOUNT_SSO_CONFIG
  = non-secret connection configuration

VEXA_ACCOUNT_CLIENT_SECRET
  = secret stored separately on the integrating application's backend
```

The client secret must never be embedded in the browser or in `VEXA_ACCOUNT_SSO_CONFIG`.

## Repository verification

`.github/workflows/verify.yml` performs JavaScript syntax checks for the backend, user frontend and Super Admin frontend and enforces the non-secret SSO configuration contract.

For the full integration guide, see `docs/SSO_INTEGRATION.md`. For the Owner Control Center design and API contract, see `docs/OWNER_CONTROL_CENTER.md`.
