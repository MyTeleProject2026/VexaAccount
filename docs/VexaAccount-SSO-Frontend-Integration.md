# VexaAccount SSO — Frontend Integration

The VexaAccount user frontend now includes a dedicated SSO authorization bridge at:

```text
#/sso/authorize
```

An integrating application can open the VexaAccount frontend with the standard authorization parameters:

```text
https://<vexaaccount-user-host>/#/sso/authorize?client_id=...&redirect_uri=...&response_type=code&scope=openid%20profile%20email&state=...&code_challenge=...&code_challenge_method=S256
```

## Browser flow

1. The VexaAccount frontend receives the authorization request.
2. It displays a secure SSO continuation screen with the requested scopes.
3. If the user is not signed in, the existing VexaAccount login flow is used.
4. The authorization request is preserved in session storage during login.
5. After successful login, the frontend resumes the authorization request.
6. The frontend sends the authorization request to `POST/GET /api/sso/authorize` using the authenticated VexaAccount session.
7. VexaAccount validates the client, exact redirect URI, requested scopes, state and S256 PKCE challenge.
8. VexaAccount redirects the browser to the registered application callback with `code` and `state`.
9. The integrating application's backend exchanges the code at `/api/sso/token` using its private client secret and PKCE verifier.
10. The backend obtains identity claims from `/api/sso/userinfo` and creates its own application session.

## Two Render backend variables

The Super Admin integration receipt separates the deployment values into:

```env
VEXA_ACCOUNT_CLIENT_SECRET=GENERATED_CLIENT_SECRET
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"YOUR_CLIENT_ID","redirectUri":"https://your-app.example.com/auth/callback","timeoutMs":10000}
```

`VEXA_ACCOUNT_CLIENT_SECRET` is private and backend-only. It must never be exposed to the VexaAccount frontend or the integrating application's browser bundle.

`VEXA_ACCOUNT_SSO_CONFIG` contains connection metadata only. Do not put a client secret inside it.

## Security requirements

- Use authorization code + S256 PKCE.
- Generate and validate a cryptographically random `state` value in the integrating backend.
- Register the exact production callback URI in VexaAccount Super Admin.
- Store the client secret only in the integrating backend deployment environment.
- Never commit the client secret to GitHub.
- Never place the client secret in React/Vite public environment variables.
- Request only the scopes required by the application.
- Create a separate VexaAccount application client for each connected application.
