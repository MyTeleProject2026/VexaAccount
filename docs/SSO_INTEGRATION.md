# VexaAccount SSO Integration

VexaAccount is the identity provider. Each external application is an independent SSO client.

## Owner setup

1. Super Admin -> SSO & Applications -> Create application.
2. Set application name, key and environment.
3. Add the exact callback URL used by the application's backend.
4. Grant only required scopes.
5. Save and approve the client.
6. Deliver the Client ID and one-time Client Secret securely to the application operator.
7. Store the secret only as `VEXA_ACCOUNT_CLIENT_SECRET` on the other application's backend.
8. Store non-secret configuration as `VEXA_ACCOUNT_SSO_CONFIG`.

## Redirect URI contract

The callback must be an exact registered redirect URI. The Owner can manage the allowlist through:

```text
GET    /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
```

The SSO authorization server performs its own backend validation against the authoritative registered values. The frontend cannot override this check.

## Other application backend

The integrating backend generates a cryptographically random `state`, PKCE `code_verifier` and S256 `code_challenge`. It stores the state/verifier in a short-lived protected login transaction, redirects the browser to VexaAccount `/api/sso/authorize`, validates the returned state, and exchanges the one-time authorization code at `/api/sso/token` using the client secret.

The backend then calls `/api/sso/userinfo`, uses the returned `sub` as the stable VexaAccount identity key, creates or finds its own local user, and establishes its own application session.

## Other application frontend

The frontend displays `Continue with VexaAccount` and starts the application's backend SSO login route. It must never contain the client secret.

## Complete flow

```text
Other App Frontend
  -> Other App Backend login route
  -> state + PKCE generated/stored
  -> VexaAccount /api/sso/authorize
  -> VexaAccount user session/login
  -> exact redirect URI + state + authorization code
  -> Other App validates state
  -> Other App Backend /api/sso/token
  -> access token + refresh token
  -> Other App Backend /api/sso/userinfo
  -> local user mapping by sub
  -> Other App local session
```

## Token lifecycle

Authorization codes are short-lived and one-time. Access tokens are used for userinfo. Refresh tokens are rotated and the previous refresh token is revoked. Logout/revocation is handled through the VexaAccount SSO lifecycle and the application's own session lifecycle.

## Secret rule

Never put `clientSecret` inside `VEXA_ACCOUNT_SSO_CONFIG`. Correct:

```env
VEXA_ACCOUNT_CLIENT_SECRET=generated-secret
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"...","redirectUri":"https://app.example.com/auth/vexaaccount/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

## Ownership boundary

VexaAccount owns identity, authentication, authorization-code issuance, SSO client registration, redirect validation, token lifecycle, consent and SSO security events. The external application owns its local authorization, business data and application session.
