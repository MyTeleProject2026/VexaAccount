# VexaAccount — Owner Control Center

## Current architecture

The VexaAccount Super Admin frontend uses one canonical Owner Control Plane runtime. The Owner operates supported account, security, SSO, support and platform controls through authenticated backend APIs.

```text
Super Admin
└── Canonical Owner Console
    ├── Overview
    ├── Applications / SSO
    ├── SSO Activity & Audit
    ├── Security Control
    ├── Platform Settings
    └── Integrated Owner Control Center
        ├── Users
        ├── SSO & Applications
        ├── Support
        └── Platform & Security
```

The Super Admin HTML entrypoints load only the canonical Owner runtime and required Owner Control Center styles/runtime. The superseded app/patch/React notification/SSO patch files have been removed from the active source tree.

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

## Support and notification flow

```text
User creates ticket
      ↓
Owner sees ticket
      ↓
Owner replies
      ↓
Reply + notification are committed server-side
      ↓
User Account Center polls notification API
      ↓
Unread notification appears in the Account Center
      ↓
User can mark notifications as read
```

Owner replies are persisted and generate a VexaAccount notification for the affected user in the same database transaction. The user frontend now runs a lightweight authenticated notification poller every 15 seconds while visible, with immediate polling when the tab/app becomes visible or authentication changes.

An authenticated production E2E script is included to verify the complete user → Owner → notification → read-acknowledgement → audit path.

## Platform and security controls

The canonical Owner Center exposes backend-backed platform operations:

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

The canonical Owner runtime has one secret-handling path: the server returns `clientSecret` only during creation/rotation, the UI displays it transiently for secure manual transfer, and it is never placed into `VEXA_ACCOUNT_SSO_CONFIG`, URL parameters, browser storage or generated PDFs. The runtime contains no legacy `clientJWT`/`clientJwt` credential aliases.

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

The user frontend now has one canonical Account Center runtime path:

```text
index.html
  ↓
account-center-loader.js
  ↓
account-center-runtime-v2.js
  ↓
account-center-v2-compat.js
  ↓
account-center-premium-theme.js
```

The supported authentication/session, notification, SSO and PWA bridges remain separate and are loaded exactly once by the canonical user entrypoint. Superseded duplicate Account Center/auth/React/toast runtimes were removed from the source tree after verifying they were not part of the active entrypoint.

## Production verification

The repository contains two verification layers:

```text
scripts/e2e-production-smoke.js
scripts/e2e-support-notification.js
.github/workflows/vexaaccount-e2e.yml
```

The smoke test verifies deployed health, SSO discovery and unauthenticated protection. The authenticated E2E verifies the real deployed user/Owner support-to-notification path when four dedicated GitHub Actions secrets are configured:

```text
VEXA_E2E_USER_EMAIL
VEXA_E2E_USER_PASSWORD
VEXA_E2E_OWNER_EMAIL
VEXA_E2E_OWNER_PASSWORD
```

The workflow intentionally skips the authenticated test when those secrets are absent rather than pretending that production certification occurred.

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
9. For support, verify the user notification and read acknowledgement
```

## Security rules

1. Keep all Client Secrets server-side except the deliberate one-time creation/rotation display.
2. Use exact redirect URIs.
3. Use S256 PKCE and backend state validation.
4. Use `sub` as the stable SSO identity key.
5. Rotate compromised secrets immediately.
6. Revoke compromised sessions/applications.
7. Never expose arbitrary code execution from the Owner UI.
8. Never put a Client Secret in browser storage, URLs, logs, PDFs or non-secret integration configuration.

For the complete repository-wide integration and user guidance, see the root `README.md` and `docs/SSO_INTEGRATION.md`.
