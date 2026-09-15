# VexaAccount Current Implementation Status

**Documentation baseline:** September 16, 2026
**Repository branch:** `master`

## Implemented provider capabilities

- Canonical user authentication/session validation.
- DB-backed Super Admin authentication and protected Owner routes.
- Registration, verification, profile, preferences, security and recovery workflows.
- Email/password change workflows with appropriate session invalidation.
- Passcode controls and security-state management.
- People/privacy and application-consent workflows.
- SSO client registry and application lifecycle.
- Exact redirect URI and per-client scope controls.
- Authorization Code + S256 PKCE.
- One-time authorization codes.
- Provider-side access/refresh token lifecycle and SSO sessions.
- Session-version invalidation for sensitive security changes.
- Application-consent removal with related SSO session/refresh-token revocation.
- Authenticated storage records and Owner controls.
- Support and notification persistence/workflows.
- System C identity, SSO/session, API/latency, security, audit and runtime observability.
- PWA/Android packaging validation.
- Production smoke/E2E tooling and migration verification.
- Owner-only SSO Application Analyzer, precise source planner and Integration Kit.
- Signed source-plan and signed generated-file-manifest protection for explicit GitHub installation.

## Current SSO provider scope contract

The provider currently supports:

`openid profile email account session applications notifications`

The Owner registry controls the subset permitted for each client. The recommended default for a normal consumer login is `openid profile email`. Additional scopes must be justified by the consuming application's requirements and approved by the Owner.

## Consumer-owned UI contract

A consuming application can preserve its own frontend design and pages and add **Continue with VexaAccount** to its existing Login UI. It may also retain consumer-local Register, Forgot Password, Verify Email, Resend OTP and Help pages.

The current `/api/sso/*` provider contract is for authorization, token exchange, userinfo and logout. It is not a public delegated VexaAccount registration/password-reset/OTP API. A consumer must not write directly to provider tables or invent undocumented provider endpoints. Provider-hosted account registration/recovery remains required unless VexaAccount later exposes dedicated delegated APIs.

## SSO Application Integration Factory

The intended Owner workflow is:

`Analyze → Confirm → Review → Repair/Generate → Preflight → Explicit Commit → CI → Deployment → Real SSO E2E`

Analysis is read-only. Generated repair source is target-specific and additive-first. It must preserve unrelated target source/UI behavior and must not blindly replace an existing authentication system.

Installation must fail closed if the reviewed repository/branch, source blob SHA, current branch HEAD, generated manifest or generated file hashes differ from the Owner-approved plan.

## Node/Express integration reference

The repository contains a reference consumer integration under `integrations/vexaaccount-node-backend/`, including:

- provider SSO client/PKCE helper;
- consumer authentication route adapter;
- environment configuration example; and
- integration documentation.

Equivalent responsibilities can be implemented in other backend frameworks; filenames are not required to be identical.

## SSO frontend security boundary

Provider client secrets, refresh tokens, PKCE verifiers and GitHub credentials remain server-side. The browser receives only the consumer application's session and safe identity state.

## Verification boundary

This document describes source capabilities and integration contracts, not blanket production certification. Deployment health, real database state, configured secrets, registered client credentials and authenticated browser behavior must be verified independently.

Use **source/build verified** for repository-level checks, **runtime verified** for deployed health/smoke checks, and **production verified** only when the actual deployed authenticated integration path has succeeded.