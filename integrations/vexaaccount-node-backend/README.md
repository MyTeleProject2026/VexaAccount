# VexaAccount external Node.js backend integration

This folder is a copy-safe reference for another application's **backend Web Service**. It does not copy VexaAccount authentication or database code; it consumes VexaAccount through the public SSO API.

## Files to create in the other application

```text
other-app/
├── .env                         # backend-only secrets; never commit
├── .env.example
├── src/
│   ├── vexaaccount-sso.js       # this reference client
│   └── routes/
│       └── vexaaccount-auth.js  # login/callback/logout routes
├── server.js                    # existing application server
└── package.json
```

Install the application's normal session middleware. The callback example expects `req.session`.

## Required VexaAccount environment variables

Only these two VexaAccount-specific variables are required:

```env
VEXA_ACCOUNT_CLIENT_SECRET=the-secret-issued-by-vexaaccount-owner
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"YOUR_CLIENT_ID","redirectUri":"https://your-app.example.com/auth/vexaaccount/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

`VEXA_ACCOUNT_SSO_CONFIG` is non-secret. **Never add `clientSecret` to it.** `VEXA_ACCOUNT_CLIENT_SECRET` is server-only.

## Start-to-finish setup

1. Super Admin creates a separate SSO application for this application.
2. Add the exact production callback URI: `https://your-app.example.com/auth/vexaaccount/callback`.
3. Grant only required scopes.
4. Save the Client ID and Client Secret.
5. Put the Client Secret in `VEXA_ACCOUNT_CLIENT_SECRET`.
6. Put URL, Client ID, exact redirect URI and scopes in `VEXA_ACCOUNT_SSO_CONFIG`.
7. Deploy/restart the backend Web Service.
8. Mount the example route module in the existing server:

```js
const vexaAccountAuth = require('./src/routes/vexaaccount-auth');
app.use('/auth', vexaAccountAuth);
```

9. Implement `app.locals.findOrCreateUserFromVexaAccount(profile)` using the other application's own database. Use `profile.sub` as the stable external identity key.
10. Add a **Continue with VexaAccount** button that navigates to `/auth/vexaaccount/login` on the other application's backend.

## Security requirements

- Generate state and S256 PKCE verifier on the backend.
- Store state/verifier server-side and expire them quickly.
- Validate state before exchanging a code.
- Never expose the Client Secret to browser JavaScript.
- Never put the secret in Vite/React public environment variables.
- Do not log access tokens, refresh tokens or Client Secrets.
- Do not use email as the stable SSO identity key; use `sub`.
- Store VexaAccount tokens server-side when the application needs a persistent session.
- Rotate the Client Secret from Super Admin if it is exposed.
- Use a unique client registration and redirect URI set per application/environment.

## VexaAccount API sequence

```text
GET  /api/sso/authorize
POST /api/sso/token              grant_type=authorization_code
GET  /api/sso/userinfo           Authorization: Bearer ACCESS_TOKEN
POST /api/sso/token              grant_type=refresh_token
POST /api/sso/logout
```

The authorization-code request uses S256 PKCE. The callback receives `code` and `state`; the backend validates state, exchanges the code, fetches userinfo, maps `sub`, and creates the application's own session.

## Production checklist

- [ ] Separate production client registration exists.
- [ ] Redirect URI exactly matches the deployed callback URL.
- [ ] `VEXA_ACCOUNT_CLIENT_SECRET` exists only on the backend service.
- [ ] `VEXA_ACCOUNT_SSO_CONFIG` contains no secret.
- [ ] State + PKCE verifier are server-side.
- [ ] `sub` is persisted as the external identity key.
- [ ] Local application session is created after userinfo succeeds.
- [ ] Refresh-token rotation is implemented when long-lived sessions are required.
- [ ] Logout revokes the VexaAccount refresh token.
- [ ] Tokens and secrets are absent from logs.
- [ ] Super Admin client status is `active`.
- [ ] A real production login has been exercised end-to-end.
