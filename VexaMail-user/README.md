# VexaMail User

Standalone VexaMail web/PWA frontend designed for separate Render Static Site deployment.

## Architecture

- Identity: VexaAccount session / SSO.
- Frontend: `VexaMail-user/` (static site).
- Mail API: VexaAccount backend `/api/mail/*` for the initial integrated deployment.
- Database: `vexamail_messages` migration.
- Delivery: existing VexaAccount SMTP/Brevo email service.

## Render Static Site

Root Directory: `VexaMail-user`

Build Command: leave empty for this zero-build static frontend.

Publish Directory: `.`

Start Command: none (Static Site).

Set `VEXA_ACCOUNT_API_BASE` in the page configuration only if the VexaAccount API URL differs from the production default.

## Mail API

The frontend calls:

- GET `/api/mail/messages?folder=inbox`
- POST `/api/mail/send`
- POST `/api/mail/messages/:id/read`

The frontend requires an authenticated VexaAccount session.

## PWA

The app includes a web manifest, service worker, responsive mobile navigation and standalone display metadata.

## Important production boundary

Sending mail is implemented through the existing server-side SMTP service. Receiving arbitrary external email into VexaMail is **not** implemented by the static frontend; it requires an inbound mail/IMAP ingestion service and domain/mailbox configuration.