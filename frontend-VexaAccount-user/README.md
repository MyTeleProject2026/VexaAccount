# VexaAccount User Frontend

Canonical standalone static frontend for the VexaAccount User Account Center.

## Current runtime entrypoint

`index.html` is the production entrypoint. It loads the canonical runtime chain:

```text
account-center-fetch-guard.js
app.js
auth-session-bridge.js
account-center-toast-guard.js
vexa-notify-bridge.js
functional-runtime-bridge.js
sso-frontend.js
account-center-loader.js
account-workflow-bridge.js
notification-live-runtime.js
pwa.js
```

`account-center-loader.js` loads the Account Center runtime (`account-center-runtime-v2.js`) and its compatibility/theme dependencies. Superseded duplicate Account Center/auth/runtime entrypoints must not be added.

## Real backend connection

The frontend uses the VexaAccount API at `https://api-vexaaccount.onrender.com`.

Authentication is cookie/session based. The session bridge sends credentials and validates `/api/auth/session`; the backend is the security source of truth.

Existing API-backed workflows include Login, registration, email verification/resend, forgot/reset password, profile, password/security changes, 2FA/passcode controls, devices/sessions, connected applications and SSO consent, people/sharing, notifications, support, recovery, deactivation and deletion.

The frontend must never contain database credentials, SMTP credentials, SSO client secrets or JWT signing keys.

## SSO browser workflow

External applications start at the canonical browser bridge:

```text
/#/sso/authorize
```

The bridge preserves the pending authorization request while VexaAccount performs the existing Login/Register/recovery/verification/2FA flow. After authentication it resumes authorization and calls the protected provider API.

Direct unauthenticated calls to `/api/sso/authorize` are expected to return `401 Authentication required`; the browser bridge is the authentication layer.

## Production verification

Repository verification checks the current canonical source entrypoint and API bridge contracts. Production runtime smoke checks the deployed HTML and every required runtime asset.

A green source/CI check does **not** certify a stale deployment. The deployed User frontend must actually serve the current `index.html` and referenced runtime assets before production certification is complete.

Authenticated production E2E credentials, when configured, must be dedicated test credentials and must never be committed.
