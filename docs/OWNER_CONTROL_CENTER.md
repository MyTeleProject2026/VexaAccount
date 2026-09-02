# VexaAccount Owner Control Center

The VexaAccount Super Admin is the Owner Control Plane. It is the authoritative administrative interface for supported VexaAccount operations.

## Control areas

- User discovery and complete supported account profile administration
- Account activation/deactivation
- Security reset operations (2FA/passcode)
- SSO session revocation
- Credit/coin adjustments with reason and audit trail
- User storage metadata administration
- Owner notes
- Permanent account deletion with explicit email confirmation
- SSO application registration and lifecycle control
- Redirect URI allowlist management
- SSO scope and credential controls
- Support ticket conversations, replies and status
- Platform settings and operational controls
- Security and audit visibility

## Redirect URI lifecycle

For an SSO client, the Owner can list, add and remove exact redirect URIs from the Super Admin panel. The backend validates every mutation and the authorization server checks the same authoritative allowlist before issuing an authorization code.

Endpoints:

```text
GET    /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
```

Redirect URI rules:

- absolute URL required
- HTTPS required except localhost development
- duplicate values rejected
- maximum 50 URIs per client
- an application must retain at least one URI
- changes are Super Admin authenticated and audited

## User-control lifecycle

```text
Owner UI
  -> authenticated Super Admin API
  -> authorization/validation
  -> database transaction or update
  -> audit event
  -> response
  -> UI reloads authoritative state
```

Destructive operations require explicit confirmation. Permanent deletion is irreversible and should only be used when the Owner has confirmed the user's email.

## Security boundary

The Owner Control Center controls all supported runtime operations through explicit APIs. It does not execute arbitrary JavaScript, arbitrary SQL, or arbitrary source-code edits in production. New backend functionality is introduced through source-controlled changes, automated verification, deployment, and then exposed as an audited Owner control when appropriate.

This keeps the Owner panel powerful without converting it into an unrestricted remote-code-execution interface.

## SSO secret boundary

`VEXA_ACCOUNT_SSO_CONFIG` contains only non-secret integration settings. `VEXA_ACCOUNT_CLIENT_SECRET` contains the client secret and is never embedded in browser configuration or the generated non-secret configuration object.
