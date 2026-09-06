# VexaAccount external Node.js backend integration

This folder is a copy-safe reference for another application's **backend Web Service**. It consumes VexaAccount through the public SSO API and does not copy VexaAccount authentication or database code.

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
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","userUrl":"https://<vexaaccount-user-host>","clientId":"YOUR_CLIENT_ID","redirectUri":"https://your-app.example.com/auth/vexaaccount/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

`VEXA_ACCOUNT_SSO_CONFIG` is non-secret. **Never add `clientSecret` to it.** `VEXA_ACCOUNT_CLIENT_SECRET` is server-only.

## Start-to-finish setup

1. Super Admin creates a separate SSO application for this application.
2. Add the exact production callback URI: `https://your-app.example.com/auth/vexaaccount/callback`.
3. Grant only required scopes.
4. Activate the client.
5. Save the Client ID and securely deliver the one-time Client Secret.
6. Put the Client Secret in `VEXA_ACCOUNT_CLIENT_SECRET`.
7. Put the VexaAccount API URL, User frontend URL, Client ID, exact redirect URI and scopes in `VEXA_ACCOUNT_SSO_CONFIG`.
8. Deploy/restart the backend Web Service.
9. Mount the example route module in the existing server:

```js
const vexaAccountAuth = require('./src/routes/vexaaccount-auth');
app.use('/auth', vexaAccountAuth);
```

10. Implement `app.locals.findOrCreateUserFromVexaAccount(profile)` using the other application's own database. Use `profile.sub` as the stable external identity key.
11. Add a **Continue with VexaAccount** button that navigates to `/auth/vexaaccount/login` on the other application's backend.

## Browser SSO flow

The other application's backend login route creates and stores the state and S256 PKCE verifier, then redirects the browser to the canonical VexaAccount User frontend bridge:

```text
https://<vexaaccount-user-host>/#/sso/authorize?client_id=...&redirect_uri=...&response_type=code&scope=openid%20profile%20email&state=...&code_challenge=...&code_challenge_method=S256
```

Do **not** redirect users directly to the protected `/api/sso/authorize` endpoint as the login page. That endpoint requires an authenticated VexaAccount browser session. The User frontend bridge performs the VexaAccount Login/Register/Forgot Password/verification/2FA transition and resumes the pending SSO request after authentication.

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
- Use a unique client registration and exact redirect URI set per application/environment.

## VexaAccount API sequence

```text
Browser → VexaAccount User #/sso/authorize
GET  /api/sso/authorize      # authenticated browser authorization step
POST /api/sso/token          # authorization_code or refresh_token
GET  /api/sso/userinfo       # Authorization: Bearer ACCESS_TOKEN
POST /api/sso/logout
```

The authorization-code request uses S256 PKCE. The callback receives `code` and `state`; the backend validates state, exchanges the code, fetches userinfo, maps `sub`, and creates the application's own session.

## Production checklist

- [ ] Separate production client registration exists.
- [ ] Redirect URI exactly matches the deployed callback URL.
- [ ] `VEXA_ACCOUNT_CLIENT_SECRET` exists only on the backend service.
- [ ] `VEXA_ACCOUNT_SSO_CONFIG` contains no secret.
- [ ] State + PKCE verifier are server-side.
- [ ] Browser starts at the VexaAccount User `#/sso/authorize` bridge.
- [ ] `sub` is persisted as the external identity key.
- [ ] Local application session is created after userinfo succeeds.
- [ ] Refresh-token rotation is implemented when long-lived sessions are required.
- [ ] Logout/revocation handling is implemented.
- [ ] Tokens and secrets are absent from logs.
- [ ] Super Admin client status is `active`.
- [ ] A real production login has been exercised end-to-end.
