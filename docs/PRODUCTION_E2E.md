# VexaAccount Production E2E Certification

## Purpose

This document defines the real deployed production verification for the User → Owner → notification → audit workflow.

A successful source build, static CI check or smoke check is **not** an authenticated production certification. Certification requires an actual GitHub Actions run against the deployed API with the four dedicated E2E credentials configured.

## Production target

```text
https://api-vexaaccount.onrender.com
```

The workflow is:

```text
.github/workflows/vexaaccount-e2e.yml
```

The authenticated test is:

```text
scripts/e2e-support-notification.js
```

## Required dedicated accounts

Create/maintain two dedicated non-personal production test accounts:

### E2E User

Must be able to:

- authenticate through `/api/auth/login`
- establish `/api/auth/session`
- create a support ticket
- read notifications
- acknowledge notifications as read

### E2E Owner

Must be able to:

- authenticate through `/api/auth/super-admin/login`
- list support tickets
- reply to a support ticket
- close a support ticket
- inspect the resulting audit event

Use dedicated accounts so the automated test cannot modify a personal or business-critical account.

## Required GitHub Actions secrets

Configure all four as GitHub Actions repository secrets or environment secrets:

```text
VEXA_E2E_USER_EMAIL
VEXA_E2E_USER_PASSWORD
VEXA_E2E_OWNER_EMAIL
VEXA_E2E_OWNER_PASSWORD
```

Secret values must never be committed to Git, placed in workflow source, printed by scripts, or pasted into issues/PR comments.

The repository's authenticated test intentionally exits when any required variable is missing.

## Exact authenticated workflow

```text
1. User login
2. User session verification
3. User creates support ticket
4. Owner login
5. Owner lists tickets and finds the new ticket
6. Owner replies to the ticket
7. User polls/read notification API and finds the persisted notification
8. User calls notification read-all acknowledgement
9. Owner closes the ticket
10. Owner audit API is checked for the support reply event
```

This is a two-sided API test: the User and Owner use separate authenticated cookie jars. It therefore verifies that authorization boundaries and persisted state work across both roles, rather than merely calling a public health endpoint.

## How to execute certification

1. Deploy the current `master` backend.
2. Confirm the production database contains the dedicated E2E User and Owner accounts.
3. Configure all four GitHub Actions secrets.
4. Open the **VexaAccount production E2E** workflow in GitHub.
5. Choose **Run workflow** against `master`.
6. Confirm the **Authenticated user-owner-notification E2E** job runs.
7. Require a successful result from the authenticated job.
8. Confirm the log contains:

```text
Support two-way notification E2E passed for ticket #...
```

9. Record the successful workflow run URL/commit as the certification evidence for that deployment.

## Scheduled behavior

The workflow also has an hourly schedule. Scheduled runs always perform deployed smoke checks. Authenticated E2E runs only when all four dedicated secrets are configured.

If scheduled credentials are absent, authenticated certification is skipped and is **not** claimed.

If a user manually starts the workflow without all four credentials, the authenticated job fails explicitly with the missing-secret requirement. This prevents a green-looking manual run from being mistaken for authenticated production certification.

## Failure interpretation

### Smoke passes, authenticated job skipped

Production health/security smoke is working, but authenticated certification has **not** been completed.

### Authenticated job fails at login

Check the dedicated test account credentials, account state, production authentication configuration and deployed API.

### Owner cannot see the ticket

Check Owner authorization, support-ticket ownership/visibility and the production database transaction path.

### Owner reply succeeds but notification is absent

Check notification persistence, the User notification query and the notification transaction path.

### Notification exists but audit event is absent

Treat the run as failed. The support reply must be auditable.

### Workflow succeeds

The executed deployment has passed the complete automated User → Owner → notification → read acknowledgement → ticket close → audit path for that run.

## Security boundary

This E2E workflow does not require or expose database credentials, Client Secrets, JWT signing keys or SMTP credentials. The test uses normal public application authentication APIs and dedicated account credentials.

Do not modify the test to bypass authentication, directly edit production database rows, or inject privileged tokens. The goal is to verify the real deployed application flow.

## Certification statement

The correct status language is:

> **Implemented:** the authenticated production E2E test and workflow are present in the repository.
>
> **Certified:** only when the authenticated GitHub Actions job has actually completed successfully against the deployed production API.

A source inspection cannot substitute for the second statement.
