# VexaAccount SSO Application Kit

VexaAccount now has a reusable Owner-only application integration kit alongside the existing SSO implementation. The kit is intentionally additive: it does not replace the existing `/api/sso`, registry, session, consent, recovery, or account authentication flows.

## Owner workflow

1. Open **Owner OS**.
2. Choose **Generate App Integration Kit**.
3. Enter the future application's key and display name.
4. Enter its GitHub repository and branch when source analysis is needed.
5. Enter its backend web-service URL, user frontend static-site URL, and admin frontend static-site URL.
6. Run **Analyze target source**. Analysis is read-only and identifies likely frontend/backend stacks, authentication/JWT/OAuth candidates, routing candidates, configuration candidates, and files that should be reviewed before any replacement.
7. Review the generated integration plan. The analyzer does not modify the target repository.
8. Generate the backend, frontend-user, frontend-admin, environment and documentation files using the detected stack/language metadata.
9. Review or download the generated files. Existing target authentication files are not automatically overwritten.
10. Register the application and exact HTTPS redirect URI in the existing SSO Application Registry.
11. Optionally use the existing Owner GitHub deployer to commit reviewed generated files to an allowlisted repository.
12. Install/adapt the generated adapters in the target application and configure its server-side secrets.

## Source analyzer

The Owner analyzer uses the server-side GitHub deployment credential, so private repositories can be analyzed without exposing the GitHub token to the browser. It is deliberately bounded and read-only:

- Maximum 120 source files inspected per analysis.
- Files larger than 400 KB are skipped.
- Environment files, private keys, PEM files, credential/secret-named files and similar secret-bearing paths are excluded.
- The analyzer returns file paths, sizes, classifications and an integration plan rather than returning source contents to the Owner UI.
- Target repository changes are never made by the analyzer endpoint.

`GITHUB_SSO_DEPLOY_TOKEN` and `GITHUB_SSO_ALLOWED_REPOSITORIES` therefore control both the existing reviewed deployment flow and source-analysis access. Keep both server-side.

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

The existing Owner GitHub deployer can commit reviewed generated files to an allowlisted repository. Keep `GITHUB_SSO_DEPLOY_TOKEN` and the repository allowlist on the VexaAccount backend; never place the token in Owner frontend code.

Deployment remains a separate explicit action after generation/review. The analyzer itself has no write capability.
