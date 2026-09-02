# VexaAccount User Frontend

Standalone static frontend for the VexaAccount Account Center.

## Deployment

Deploy this directory independently from the VexaAccount backend and Super Admin frontend.

Configure the backend/API origin through environment-specific frontend configuration. This static application must never contain database credentials, SMTP credentials, SSO Client Secrets, JWT signing keys or other server secrets.

## Canonical runtime

The production entrypoint is `index.html`.

```text
index.html
  ├── authentication/session bridges
  ├── account-center-fetch-guard.js
  ├── sso-frontend.js
  ├── account-center-loader.js
  │     ├── account-center-runtime-v2.js
  │     ├── account-center-v2-compat.js
  │     └── account-center-premium-theme.js
  ├── notification-live-runtime.js
  └── pwa.js
```

Only one primary Account Center runtime is loaded. Superseded duplicate Account Center/auth/React/toast runtimes were removed and must not be reintroduced as parallel entrypoints.

## Account Center responsibilities

- authentication and session state
- registration and email verification
- forgot/reset password
- profile and personal information
- security and recovery controls
- password and supported 2FA/passcode workflows
- devices and active sessions
- connected applications and SSO consent
- notifications and unread state
- people/sharing and verification
- account activity/recovery
- help and support
- account deletion
- responsive mobile/desktop presentation
- PWA installation support

Security-sensitive operations are backed by the VexaAccount API; browser state is not the security source of truth.

## Live notification workflow

```text
Authenticated User
  → GET /api/account/notifications
  → notification-live-runtime.js polls while visible
  → new persisted unread notification is detected
  → Account Center notification UI updates
  → User marks notification read
  → backend persists read state
```

The runtime also polls when the application becomes visible and reacts to authentication/session changes. It does not store Client Secrets or privileged credentials.

## Support two-way workflow

```text
User creates support ticket
  → Owner replies through Owner Control Center
  → backend persists reply + notification + audit
  → User notification API returns the notification
  → User acknowledges it as read
```

The complete deployed User → Owner → notification → read acknowledgement → audit path is verified by the repository's authenticated production E2E workflow when its dedicated test credentials are configured.

## Production E2E

The repository contains:

```text
scripts/e2e-support-notification.js
.github/workflows/vexaaccount-e2e.yml
docs/PRODUCTION_E2E.md
```

The authenticated production certification requires four GitHub Actions secrets:

```text
VEXA_E2E_USER_EMAIL
VEXA_E2E_USER_PASSWORD
VEXA_E2E_OWNER_EMAIL
VEXA_E2E_OWNER_PASSWORD
```

These must be dedicated non-personal test credentials and must never be committed to this frontend or any other repository file.

A manual production workflow run without all four credentials fails explicitly. A scheduled run may perform smoke verification without authenticated certification when the credentials are not configured. **Implemented E2E tooling is not the same as a successful live certification run.**

See the repository root `README.md` and `docs/PRODUCTION_E2E.md` for the exact certification procedure.
