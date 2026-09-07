# VexaAccount SSO Application Kit

VexaAccount now has a reusable Owner-only application integration kit alongside the existing SSO implementation. The kit is intentionally additive: it does not replace the existing `/api/sso`, registry, session, consent, recovery, or account authentication flows.

## Owner workflow

1. Open **Owner OS**.
2. Choose **Generate App Integration Kit**.
3. Enter the future application's key and display name.
4. Enter its GitHub repository and branch when source analysis is needed.
5. Enter its backend web-service URL, user frontend static-site URL, and admin frontend static-site URL.
6. Run **Analyze target source**. Analysis is read-only and identifies likely frontend/backend stacks, authentication/JWT/OAuth candidates, routing candidates, configuration candidates, and files that should be reviewed before any replacement.
7. Review the integration plan and the proposed operations. The analyzer does not modify the target repository.
8. Generate the backend, frontend-user, frontend-admin, environment and documentation files using the detected stack/language metadata.
9. Review or download the generated files. Existing target authentication files are not automatically overwritten.
10. Register the application and exact HTTPS redirect URI in the existing SSO Application Registry.
11. Optionally use the existing Owner GitHub deployer to commit reviewed generated files to an allowlisted repository.
12. Install/adapt the generated adapters in the target application and configure its server-side secrets.

## Source analyzer

The Owner analyzer uses a **dedicated read-only analysis credential** when `GITHUB_SSO_ANALYZE_TOKEN` is configured. It falls back to `GITHUB_SSO_DEPLOY_TOKEN` for backward compatibility. Keep both credentials server-side. Private repositories can therefore be analyzed without exposing a GitHub token to the browser.

The analyzer is deliberately bounded and read-only:

- Maximum 120 source files inspected per analysis.
- Files larger than 400 KB are skipped.
- Environment files, private keys, PEM files, credential/secret-named files and similar secret-bearing paths are excluded.
- The analyzer returns file paths, sizes, classifications and an integration plan rather than returning source contents to the Owner UI.
- Target repository changes are never made by the analyzer endpoint.

Recommended deployment configuration:

- `GITHUB_SSO_ANALYZE_TOKEN` — GitHub credential with only the repository read access required for source analysis.
- `GITHUB_SSO_DEPLOY_TOKEN` — separate credential for the existing explicit deployment flow.
- `GITHUB_SSO_ALLOWED_REPOSITORIES` — comma-separated repository allowlist.

## Integration planning and replacement safety

The analyzer produces an **additive-first** plan. Authentication/session files are classified as review candidates, not automatic replacement targets. For supported stacks, the plan can identify backend route/entry anchors and frontend authentication/login anchors where the generated adapter should be connected.

A complete target-file replacement is intentionally **not automatic**. Before any future replacement/deployment operation, Owner review must establish:

1. the current target file contents;
2. the current target file/blob hash;
3. the relevant integration anchors and existing auth/session behavior;
4. the generated replacement and its preservation of required application behavior; and
5. explicit Owner approval for the selected files.

This prevents the VexaAccount integration system from silently destroying an application's existing authentication or business logic.

## Generated package

The current kit contains:

- `backend/src/integrations/vexaaccount-sso.js` — Authorization Code + S256 PKCE client adapter and application-owned JWT session helper.
- `backend/src/routes/vexaaccount-auth.js` — backend login/callback adapter with encrypted stateless PKCE transaction cookie.
- `frontend-user/src/integrations/vexaaccount.js` — user-side login/account-management adapter.
- `frontend-admin/src/integrations/vexaaccount.js` — admin-side identity integration metadata.
- `backend/.env.vexaaccount.example` — deployment configuration template with the exact generated callback URI.
- `VEXAACCOUNT_SSO_INTEGRATION.md` — installation and security guidance.

## Secret boundaries

The target application owns its own `JWT_SECRET`. VexaAccount does not need to know or store it. The VexaAccount client secret is a separate server-side credential and must be stored only in the target application's backend secret manager.

The Owner UI may locally insert the target application's JWT secret into the generated environment file for download. It is never included in the VexaAccount API request.

Do not copy Telegram, browser, WebApp, or other third-party cookies/tokens between devices. If a target application supports VexaAccount SSO, create a fresh application session on each device through the application's own authorization flow.

## GitHub deployment

The existing Owner GitHub deployer can commit reviewed generated files to an allowlisted repository. Keep GitHub credentials on the VexaAccount backend; never place a GitHub token in Owner frontend code.

Deployment remains a separate explicit action after generation/review. The analyzer itself has no write capability.
