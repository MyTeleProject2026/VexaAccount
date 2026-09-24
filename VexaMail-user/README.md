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

## VexaAccount SSO

VexaMail now uses the VexaAccount OAuth/OIDC-style authorization-code flow with S256 PKCE as the browser login mechanism. The registered public client is `vexamail-user`, with the production redirect URI `https://vexamail.onrender.com/`.

The browser never receives a confidential VexaAccount client secret; `PUBLIC` identifies this PKCE public client. Access and refresh tokens are stored by the VexaMail browser session and the mail API accepts the VexaMail SSO access token only for `/api/mail`.

## Production deployment

Production VexaMail Static Site: `https://vexamail.onrender.com/`

The VexaAccount SSO client `vexamail-user` is registered for this exact origin. Render should use Root Directory `VexaMail-user`, Build Command empty, and Publish Directory `.`.

## Current mailbox capabilities

- VexaAccount SSO with PKCE
- Cloud-synced inbox, sent, drafts, starred, spam and trash
- Internal VexaAccount-to-VexaAccount delivery
- External SMTP sending through the existing VexaAccount email service
- Search, read/unread, star/unstar, spam, trash/restore and permanent delete
- Responsive mobile/desktop glass UI and PWA shell

The remaining production mail-system work is inbound Internet mail routing/receiving, MIME/attachment handling, provider delivery/bounce processing, mailbox/domain provisioning, and production anti-spam/DKIM/SPF/DMARC infrastructure.


## Production inbound Internet mail

VexaMail now includes a Brevo Inbound Parsing webhook endpoint at:

`POST https://api-vexaaccount.onrender.com/api/mail/inbound/brevo`

Brevo's Inbound Parsing service receives mail for a dedicated receiving domain/subdomain and posts structured messages to this webhook. Brevo documents that the receiving domain must be delegated to its inbound servers with MX records, and that inbound webhooks include message IDs, threading headers, HTML/text bodies, recipients and attachment download tokens. citeturn1search1turn1search0

Configure the VexaAccount Render Web Service with:

- `BREVO_API_KEY` — Brevo API key used to download inbound attachments.
- `VEXAMAIL_BREVO_WEBHOOK_TOKEN` — long random secret placed in the Brevo webhook's custom header as `x-vexamail-brevo-token`.
- Keep the existing `BREVO_SMTP_*` variables for outbound delivery.

Brevo webhook configuration:

- Type: `inbound`
- Event: `inboundEmailProcessed`
- URL: `https://api-vexaaccount.onrender.com/api/mail/inbound/brevo`
- Receiving domain: a dedicated verified inbound domain/subdomain.

Do not use the VexaMail web-app hostname itself as the receiving MX domain. Brevo's documentation recommends a separate receiving domain/subdomain from the sending domain. citeturn1search1

Inbound attachments are stored as protected Brevo download tokens and are retrieved through the VexaAccount API using the Brevo API key; the browser is not given the Brevo API key. citeturn1search0
