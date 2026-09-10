# VexaAccount

## Current implementation guide

This README documents the current repository implementation on `master`, distinguishing implemented source behavior from production runtime certification.

### Runtime components

- `backend/` — Express API, authentication, SSO registry, Owner controls, infrastructure integration, Source Repair/Integration Kit services, and System C observability.
- `frontend-VexaAccount-Super-admin/` — authenticated Owner/Super Admin Control Center and System C UI.
- `frontend-VexaAccount-user/` — VexaAccount user-facing runtime.
- Production API: `https://api-vexaaccount.onrender.com`
- Super Admin UI: `https://super-admin-vexaaccount.onrender.com`
- User UI: `https://vexaaccount-management.onrender.com`

## Owner authentication

The Owner runtime verifies the Super Admin session before loading protected Owner data. Core endpoints are `POST /api/auth/super-admin/login` and `GET /api/auth/super-admin/session`. Owner APIs are protected by `requireSuperAdmin`; browser recovery logic avoids duplicate concurrent session checks.

## Owner Control Center

The Owner gateway exposes System A (VexaAccount SSO Full Controlling System), System B (Owner Control Center), and System C (Live Integration & Runtime Observatory). Controls call authenticated backend APIs and are not intended to be client-only mock state.

## SSO application lifecycle

The implemented registry flow is: Owner creates an application; backend validates metadata, redirect URIs and scopes; client ID and secret are generated; the secret is stored server-side as a hash; application state is persisted in `sso_clients` and `sso_client_registry`; Owner can inspect configuration/diagnostics; Owner can update redirect URIs, scopes and lifecycle status; disable/revoke deactivates the client and revokes associated sessions/tokens; rotation replaces the client credential; removal revokes dependent authentication state before deleting records.

Current default scopes: `openid`, `profile`, `email`, `account`, `session`, `applications`, `notifications`.

## Integration Kit and Source Repair

The Owner SSO application workflow now includes repository-aware source analysis and Source Repair. For an allowlisted repository/branch, the backend can inspect a bounded source tree, detect stack/auth/session/routing candidates, prepare a precise source review plan, and generate supported integration material without modifying the target repository during analysis.

The Super Admin Source Repair console is loaded by the Owner frontend and is designed to progress through: repository/branch selection, full bounded repository analysis, affected-file findings, repair selection, generated replacement source, review, fresh preflight, and explicit Owner-approved commit. Source integrity is bound to reviewed blob SHA/branch state and protected deployment checks; secrets and credential-bearing paths are excluded.

The UI also exposes live operation phases for analysis, source review, integration generation and deployment verification. These phases represent real backend operations and must not be treated as runtime certification until the resulting operation and downstream checks succeed.

## Infrastructure and deployment

Owner infrastructure controls can connect to Render, list services, manage application environment variables, trigger deployments, and bind a Render service to an SSO application. MTP2026 provisioning can create/reuse `mtp2026-app-launcher`, configure its SSO settings, write generated configuration/credential values to the selected Render service environment, persist the infrastructure binding, and trigger deployment.

## System C

System C exposes `GET /api/system-c/health`, `GET /api/system-c/snapshot`, and `GET /api/system-c/stream`. The stream uses SSE with periodic snapshots, heartbeats and disconnect cleanup. Snapshot data covers database status, SSO applications, security/administrative/observability events, active sessions/consents and API metrics. The frontend reads database connection/running/question values from `snapshot.databaseStatus`.

## Platform settings

Platform settings require Super Admin authentication. Mutations also pass through the centralized Owner audit middleware before persistence in `vexa_platform_settings`, with the authenticated Owner recorded as `updated_by`.

## End-to-end control model

**Owner UI action → frontend handler → authenticated API request → `requireSuperAdmin` → route validation → service/database/provider operation → audit where required → JSON response → UI state refresh.**

For Source Repair/Integration Kit, the protected deployment path additionally requires reviewed source integrity, current branch/source verification and explicit Owner approval before a target repository commit.

## Verification policy

A feature is implemented when its source route/handler and frontend/backend contract exist. It is runtime-certified only after the relevant GitHub Actions and production smoke checks finish successfully. Queued or in-progress workflows are not certification, and a successful build alone does not prove end-to-end SSO runtime behavior.

## Documentation maintenance

Keep this README synchronized with actual source on `master`. Document only traceable behavior, distinguish implementation from runtime certification, and verify the full frontend → API → middleware → service/database/provider → response chain after material changes.
