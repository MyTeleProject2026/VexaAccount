# VexaAccount SSO Application Integration Kit

The SSO Application Integration Kit is an Owner-only workflow for preparing a consuming application for VexaAccount SSO. It is additive and does not replace the existing VexaAccount authentication, account, SSO registry, consent, session or recovery contracts.

## End-to-end Owner workflow

1. Open Owner OS.
2. Select **Generate App Integration Kit**.
3. Enter application key, display name and target URLs.
4. Provide the GitHub repository and branch when source analysis is required.
5. Run the read-only source analyzer.
6. Review detected stack, authentication/session/routing candidates and warnings.
7. Select the source files that should form the precise review plan.
8. Build the signed source plan.
9. Confirm the reviewed file paths, GitHub blob SHAs, source SHA-256 values and integration anchors.
10. Generate the supported integration package.
11. Review generated file contents and their SHA-256 values.
12. Register the target application and exact HTTPS redirect URI in the VexaAccount SSO registry.
13. Configure target application secrets in its own server-side secret manager.
14. If installation is requested, explicitly approve the Owner installation action.
15. The server verifies the signed source plan, current reviewed blobs, current branch head and signed generated-file manifest before committing.
16. Adapt and test the generated integration in the target application.

The analyzer and planner are read-only. Generation prepares files; it does not automatically overwrite target authentication code.

## Source analyzer

The analyzer uses `GITHUB_SSO_ANALYZE_TOKEN` when configured and falls back to `GITHUB_SSO_DEPLOY_TOKEN` for compatibility. Credentials remain server-side.

Analysis limits are deliberately bounded:

- Maximum 120 source files per analysis.
- Files larger than 400 KB are skipped.
- Secret-bearing paths such as `.env`, PEM/private-key and credential/secret files are excluded.
- The Owner UI receives metadata and findings rather than arbitrary secret-bearing source files.
- No target repository write is performed by analysis.

Recommended server configuration:

- `GITHUB_SSO_ANALYZE_TOKEN`: least-privilege repository-read credential.
- `GITHUB_SSO_DEPLOY_TOKEN`: separate credential for explicit installation.
- `GITHUB_SSO_ALLOWED_REPOSITORIES`: repository allowlist.

## Precise source planning

The planner selects a bounded set of relevant files and records GitHub blob SHA plus source SHA-256. It identifies useful anchors such as authentication imports, session cookies, bearer middleware, login routes, callback routes and frontend login entry points.

The generated plan is additive-first. Existing authentication/session files are review candidates and are not treated as safe automatic replacement targets.

### Installation guard

Before any patch or replacement is installed, the current target blob SHA must exactly match the reviewed plan. If it differs, the installation must stop and a new read-only plan must be created.

## Generated package

The current generator is intentionally Node.js/Express-oriented. Unsupported backend stacks are rejected rather than receiving incompatible code.

Generated files include:

- `backend/src/integrations/vexaaccount-sso.js` — Authorization Code + S256 PKCE client and consumer-owned JWT-session helper.
- `backend/src/routes/vexaaccount-auth.js` — backend login/callback adapter with encrypted stateless PKCE transaction cookie.
- `frontend-user/src/integrations/vexaaccount.js` — user-side integration adapter.
- `frontend-admin/src/integrations/vexaaccount.js` — admin-side integration metadata/adapter.
- `backend/.env.vexaaccount.example` — environment template and exact callback configuration.
- `VEXAACCOUNT_SSO_INTEGRATION.md` — target installation/security guidance.

The generator version is tracked by the backend kit route; the current repository implementation is version `1.3.0`.

## Secret boundaries

The target application owns its own `JWT_SECRET`. VexaAccount does not receive or store that secret. The VexaAccount client secret belongs only in the consuming backend secret manager.

Browser JavaScript must never contain GitHub credentials, provider client secrets or refresh tokens.

Do not copy Telegram, browser, WebApp or unrelated third-party cookies/tokens between devices. A target application must create a fresh application session through its own SSO flow.

## Signed installation boundary

Installation is protected by multiple independent integrity checks:

- signed source-plan token with short expiry;
- exact repository and branch binding;
- exact reviewed source-file set and blob SHA verification;
- current branch-head SHA verification to prevent stale-branch writes;
- signed generated manifest bound to repository/branch/source plan/application;
- exact generated file paths;
- exact generated file SHA-256 and byte-size verification; and
- explicit Owner confirmation.

If any check fails, no target repository commit is created.

## Production expectations

Generation success is not SSO certification. Certification requires the target application's deployed backend, configured secrets, registered redirect URI, authorization-code + PKCE exchange, userinfo, application session, logout/revocation and browser behavior to be tested in the deployed environment.
