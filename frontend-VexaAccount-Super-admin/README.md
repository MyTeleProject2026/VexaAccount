# VexaAccount Super Admin Frontend

Standalone static frontend for the Vexa ecosystem Owner / Super Admin Control Plane.

## Deployment

Deploy this directory independently from the VexaAccount backend and User frontend.

Configure the backend/API origin through environment-specific frontend configuration. Never place database credentials, JWT signing keys, SMTP credentials, Client Secrets or other server secrets in this static application.

## Canonical runtime

```text
index.html
  ↓
owner-console-runtime.js
  ↓
owner-control-center-loader.js
  ↓
owner-control-center.js
```

The loader waits for the authenticated Owner shell before loading the integrated control center. The previous legacy `app.js`, SSO patch scripts, user-management patch runtime, support/platform patch runtimes and duplicate React notification runtime have been removed.

## Responsibilities

- User administration
- SSO application/client management
- Exact redirect URI and scope administration
- Security/session controls
- Audit/security review
- Owner support workflow
- User notification workflow
- Platform settings and health

All operations are explicit backend APIs. The browser is not an arbitrary SQL, shell, JavaScript or source-code execution interface.

## Client Secret boundary

During application creation or secret rotation, the backend returns the Client Secret once. The Owner UI displays it transiently for transfer to the external application's backend.

The browser must not store the secret in localStorage/sessionStorage, URLs, logs or generated PDFs. It must not be placed in `VEXA_ACCOUNT_SSO_CONFIG`. The integrating application's backend stores it as `VEXA_ACCOUNT_CLIENT_SECRET`.

The canonical runtime contains no legacy `clientJWT`/`clientJwt` credential aliases.

## Support → notification workflow

```text
User creates ticket
  → Owner lists/opens ticket
  → Owner replies
  → backend persists reply + notification + audit
  → User reads persisted notification
  → User acknowledges read state
  → Owner closes ticket
```

## Production E2E certification

The repository's real authenticated production test is:

```text
scripts/e2e-support-notification.js
```

It is executed by:

```text
.github/workflows/vexaaccount-e2e.yml
```

The test uses separate User and Owner authenticated sessions and verifies login, session state, support creation, Owner visibility, Owner reply, persisted User notification, notification read acknowledgement, ticket closure and Owner audit evidence.

### Required dedicated credentials

Configure these as GitHub Actions repository/environment secrets:

```text
VEXA_E2E_USER_EMAIL
VEXA_E2E_USER_PASSWORD
VEXA_E2E_OWNER_EMAIL
VEXA_E2E_OWNER_PASSWORD
```

Use dedicated non-personal test accounts. Never commit or print their values.

A manual workflow run without all four credentials fails explicitly. Scheduled runs perform deployed smoke checks and skip authenticated certification when the dedicated credentials are absent. A successful source/CI check does not equal live production certification.

### Certification procedure

1. Deploy the intended backend revision.
2. Confirm the dedicated test User and Owner accounts exist and have the required permissions.
3. Configure all four GitHub Actions secrets.
4. Run **VexaAccount production E2E** manually against `master`.
5. Require the authenticated job to pass.
6. Confirm the log reports `Support two-way notification E2E passed`.
7. Keep the workflow run as evidence for the deployed revision.

See `docs/PRODUCTION_E2E.md` and the repository root `README.md` for the complete operational procedure.
