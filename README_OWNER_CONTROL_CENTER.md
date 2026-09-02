# VexaAccount — Owner Control Center

## Current architecture

The VexaAccount Super Admin frontend now uses a consolidated Owner Control Plane entrypoint. The Owner can operate supported account, security, SSO, support and platform controls through authenticated backend APIs.

```text
Super Admin
├── Core registry console
└── Owner Control Center
    ├── Users
    ├── SSO & Applications
    ├── Support
    └── Platform & Security
```

Legacy SSO/user/support patch scripts are no longer loaded by the Super Admin HTML entrypoint. Historical files may remain in the repository for source history, but they do not compete with the live entrypoint.

## User account controls

- Search and inspect user accounts
- Edit supported profile fields
- Enable/disable account status
- Reset supported 2FA enrollment
- Reset supported passcode enrollment
- Revoke all active SSO sessions
- Adjust credit score and coins with an explicit reason
- Inspect storage metadata
- Add Owner notes
- Permanently delete an account through an explicit confirmation flow
- Inspect SSO sessions and security events

User details intentionally use an explicit safe field list and do not expose password hashes or accidental secret fields.

## SSO application controls

- Create application
- Review registry records
- Activate/disable clients
- Manage exact redirect URI allowlists
- Review granted scopes
- Rotate Client Secret
- Permanently revoke a client
- Review SSO/audit activity

Redirect URI API:

```text
GET    /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
```

Redirect URI validation remains a backend security boundary. Production callbacks should use exact HTTPS values.

## Support

Owner support flow:

```text
List tickets → Open ticket → Read conversation → Reply → Set status
```

Owner replies are persisted and generate a VexaAccount notification for the affected user.

## Platform and security controls

The canonical Owner Center now exposes backend-backed platform operations:

```text
GET /api/owner/platform/settings
PUT /api/owner/platform/settings/:key
GET /api/owner/platform/health
GET /api/owner/platform/integration/:clientId
GET /api/owner/platform/scopes
```

This provides controlled settings and health visibility without giving the browser arbitrary SQL, shell, JavaScript or source-code execution.

## SSO secret boundary

```text
VEXA_ACCOUNT_SSO_CONFIG
  = non-secret URL/client/redirect/scope configuration

VEXA_ACCOUNT_CLIENT_SECRET
  = secret stored only by the integrating application's backend
```

Never place `clientSecret` inside `VEXA_ACCOUNT_SSO_CONFIG`.

## External app backend template

A complete reference is included at:

```text
integrations/vexaaccount-node-backend/
├── .env.example
├── README.md
└── src/
    ├── vexaaccount-sso.js
    └── routes/vexaaccount-auth.js
```

The template implements server-side state, S256 PKCE, authorization-code exchange, userinfo, refresh and logout. Each external application must map `userinfo.sub` to its own local user record and create its own session.

## User Account Center runtime consolidation

The user frontend now uses `account-center-loader.js` as the canonical Account Center runtime orchestrator. It loads the primary Account Center runtime, compatibility mapping and the supported full-workflow controller in a controlled order. The duplicate direct workflow script entrypoint was removed from `index.html`.

Authentication remains a separate runtime from the Account Center.

## Production verification

The repository contains:

```text
scripts/e2e-production-smoke.js
.github/workflows/vexaaccount-e2e.yml
```

The smoke workflow checks the deployed API health, SSO discovery and authentication protection. Full authenticated E2E certification still requires a real deployed test user, active SSO client, real callback service and database execution.

## Owner operational sequence

```text
1. Sign in as Super Admin
2. Review platform/database health
3. Search the user or application
4. Inspect security/audit state
5. Apply the smallest supported control required
6. Confirm the result in the backend response/UI
7. Review the generated audit/security event
8. For SSO, verify the external application's callback and token exchange
```

## Security rules

1. Keep all Client Secrets server-side.
2. Use exact redirect URIs.
3. Use S256 PKCE and backend state validation.
4. Use `sub` as the stable SSO identity key.
5. Rotate compromised secrets immediately.
6. Revoke compromised sessions/applications.
7. Never expose arbitrary code execution from the Owner UI.

For the complete repository-wide integration and user guidance, see the root `README.md` and `docs/SSO_INTEGRATION.md`.
