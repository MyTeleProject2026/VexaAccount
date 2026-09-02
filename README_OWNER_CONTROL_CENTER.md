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

The Super Admin entrypoint loads the canonical Owner runtime and then uses `owner-control-center-loader.js` to load the integrated control surface after the Owner shell is mounted. This ordering prevents the previous initialization race.

## User management workflow

```text
Owner login
  → authenticated Owner session
  → Users
  → search/select account
  → inspect safe account details
  → apply supported control
  → confirm backend response
  → review audit/security event
```

Supported controls include safe profile edits, account enable/disable, supported 2FA/passcode reset, SSO-session revocation, supported credit/coin adjustments with an explicit reason, Owner notes, storage metadata inspection and explicit permanent account deletion. Password hashes and other sensitive credential material are excluded from the safe detail response.

## SSO application workflow

```text
Create client
  → configure exact redirect URI
  → grant supported scopes
  → activate
  → external backend uses state + S256 PKCE
  → authorize
  → token exchange
  → userinfo
  → external local session
```

Redirect URI API:

```text
GET    /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
```

Production callbacks must be exact HTTPS values. No wildcard production callbacks.

## Client Secret handling

During application creation or secret rotation, the backend deliberately returns the new Client Secret once. The Owner UI displays it transiently so the Owner can transfer it to the external application's backend secret store.

The browser must never persist the secret in localStorage/sessionStorage, URLs, logs, PDFs or `VEXA_ACCOUNT_SSO_CONFIG`. The external application keeps it only in its server-side secret configuration:

```env
VEXA_ACCOUNT_CLIENT_SECRET=server_only_secret
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"YOUR_CLIENT_ID","redirectUri":"https://your-app.example.com/auth/vexaaccount/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

`VEXA_ACCOUNT_SSO_CONFIG` must never contain `clientSecret`. The Owner runtime contains no legacy `clientJWT`/`clientJwt` credential aliases.

## Support and notification two-way workflow

```text
User creates ticket
      ↓
Owner lists/opens ticket
      ↓
Owner replies
      ↓
Backend persists reply + notification + audit
      ↓
User notification API exposes the persisted notification
      ↓
User acknowledges notifications as read
      ↓
Owner closes ticket
```

Owner replies are backend-backed and auditable. The User frontend's live notification runtime polls the authenticated notification API while visible, and also refreshes when the application becomes visible or authentication changes.

## Production E2E certification

The repository includes a real authenticated production E2E:

```text
scripts/e2e-support-notification.js
```

and workflow:

```text
.github/workflows/vexaaccount-e2e.yml
```

It verifies the deployed User → Owner → notification → read acknowledgement → close → audit path using separate authenticated sessions.

The workflow requires these four dedicated GitHub Actions secrets:

```text
VEXA_E2E_USER_EMAIL
VEXA_E2E_USER_PASSWORD
VEXA_E2E_OWNER_EMAIL
VEXA_E2E_OWNER_PASSWORD
```

Use dedicated non-personal test accounts. A manual workflow run without all four credentials fails explicitly. Scheduled runs perform smoke checks and skip authenticated certification when credentials are absent.

### Certification procedure

1. Deploy the intended `master` backend.
2. Ensure the dedicated E2E User and Owner accounts exist in the production database.
3. Configure all four GitHub Actions secrets.
4. Run **VexaAccount production E2E** manually against `master`.
5. Require the authenticated job to execute successfully.
6. Confirm the output contains `Support two-way notification E2E passed`.
7. Record that workflow run as certification evidence for the deployed revision.

A repository commit is not itself proof of live certification. The credentials cannot be safely manufactured by source code, and they must not be committed to the repository.

See `docs/PRODUCTION_E2E.md` for the complete operational runbook.

## Platform and security controls

```text
GET /api/owner/platform/settings
PUT /api/owner/platform/settings/:key
GET /api/owner/platform/health
GET /api/owner/platform/integration/:clientId
GET /api/owner/platform/scopes
```

These are explicit validated controls. The Owner browser is never granted arbitrary SQL, shell, JavaScript or source-code execution.

## User Account Center runtime

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

Authentication/session, notification, SSO and PWA bridges are loaded by the canonical User entrypoint. Superseded duplicate Account Center/auth/React/toast runtimes have been removed.

## Security rules

1. Keep Client Secrets server-side except the deliberate one-time creation/rotation display.
2. Use exact redirect URIs.
3. Use S256 PKCE.
4. Validate state server-side.
5. Use `userinfo.sub` as the stable external identity key.
6. Rotate compromised secrets immediately.
7. Revoke compromised sessions/applications.
8. Keep Owner actions explicit, validated and auditable.
9. Never expose arbitrary code execution from the Owner UI.
10. Never put Client Secrets in browser storage, URLs, logs, PDFs or non-secret integration configuration.

For repository-wide production verification, see `README.md` and `docs/PRODUCTION_E2E.md`.
