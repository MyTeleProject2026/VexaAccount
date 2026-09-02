# VexaAccount User Frontend

Standalone static frontend for the VexaAccount Account Center.

## Deployment

Deploy this directory independently from the VexaAccount backend and Super Admin frontend.

Configure the backend/API origin through environment-specific frontend configuration. This application must never contain database credentials, SMTP credentials, SSO Client Secrets or other server secrets.

## Canonical runtime

The production entrypoint is `index.html`. It loads the authentication/session bridge, Account Center loader, live notification runtime, SSO frontend and PWA runtime. The Account Center loader then loads exactly one primary Account Center runtime (`account-center-runtime-v2.js`) plus its compatibility/theme layers.

Superseded duplicate Account Center/auth/React/toast runtimes were removed from this frontend source tree. Do not reintroduce parallel runtime entrypoints.

## Responsibilities

- VexaAccount profile and account settings
- Security and recovery settings
- Sessions/devices
- Connected Vexa applications
- SSO consent and account controls
- Account Center notifications and live unread notification polling
- Mobile-first responsive UI
- PWA installation support
