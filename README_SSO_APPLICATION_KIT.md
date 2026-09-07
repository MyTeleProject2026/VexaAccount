# VexaAccount SSO Application Kit

VexaAccount now has a reusable Owner-only application integration kit alongside the existing SSO implementation. The kit is intentionally additive: it does not replace the existing `/api/sso`, registry, session, consent, recovery, or account authentication flows.

## Owner workflow

1. Open **Owner OS**.
2. Choose **Generate App Integration Kit**.
3. Enter the future application's key and display name.
4. Enter its backend web-service URL, user frontend static-site URL, and admin frontend static-site URL.
5. Optionally enter the application's own JWT secret. The secret is processed in the Owner browser and is never sent to VexaAccount by the generator UI.
6. Generate and review the backend, frontend-user, frontend-admin, environment and documentation files.
7. Register the application and exact HTTPS redirect URI in the existing SSO Application Registry.
8. Install the generated adapters in the target application and configure its server-side secrets.

## Generated package

The current kit contains:

- `backend/src/integrations/vexaaccount-sso.js` — Authorization Code + S256 PKCE client adapter.
- `backend/src/routes/vexaaccount-auth.js` — backend login/callback adapter.
- `frontend-user/src/integrations/vexaaccount.js` — user-side login/account-management adapter.
- `frontend-admin/src/integrations/vexaaccount.js` — admin-side identity integration metadata.
- `backend/.env.vexaaccount.example` — deployment configuration template.
- `VEXAACCOUNT_SSO_INTEGRATION.md` — installation and security guidance.

## Secret boundaries

The target application owns its own `JWT_SECRET`. VexaAccount does not need to know or store it. The VexaAccount client secret is a separate server-side credential and must be stored only in the target application's backend secret manager.

Do not copy Telegram, browser, WebApp, or other third-party cookies/tokens between devices. If a target application supports VexaAccount SSO, create a fresh application session on each device through the application's own authorization flow.

## GitHub deployment

The existing Owner GitHub deployer can commit reviewed generated files to an allowlisted repository. Keep `GITHUB_SSO_DEPLOY_TOKEN` and the repository allowlist on the VexaAccount backend; never place the token in Owner frontend code.
