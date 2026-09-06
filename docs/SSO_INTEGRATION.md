# VexaAccount SSO Integration

VexaAccount is the identity provider. Each external application is an independent SSO client/relying party.

## Owner setup

1. Super Admin → SSO Applications → Create application.
2. Set the application name/key and environment metadata.
3. Add the exact callback URL used by the application's backend.
4. Grant only the scopes the application actually needs.
5. Activate the client.
6. Deliver the Client ID and one-time Client Secret securely to the application operator.
7. Store the secret only as `VEXA_ACCOUNT_CLIENT_SECRET` on the application's backend.
8. Store non-secret connection metadata in `VEXA_ACCOUNT_SSO_CONFIG`.

## Redirect URI contract

The callback must be an exact registered redirect URI. Production callbacks must use HTTPS; wildcard production callbacks are not supported.

The Owner can manage the allowlist through:

```text
GET    /api/sso-registry/applications/:clientId/redirect-uris
POST   /api/sso-registry/applications/:clientId/redirect-uris
DELETE /api/sso-registry/applications/:clientId/redirect-uris
```

The authorization server performs its own backend validation against the authoritative registered values. The browser frontend cannot override this check.

## Browser authorization entry point

The browser should start SSO at the canonical VexaAccount User frontend bridge, not by directly opening the protected backend authorization endpoint:

```text
https://<vexaaccount-user-host>/#/sso/authorize?client_id=...&redirect_uri=...&response_type=code&scope=openid%20profile%20email&state=...&code_challenge=...&code_challenge_method=S256
```

The User frontend bridge:

1. receives and validates the authorization request shape;
2. shows the requested access/continuation state;
3. uses the normal VexaAccount Login/Register/Forgot Password/verification/2FA workflows when the browser is not authenticated;
4. preserves the pending SSO request during the authentication transition;
5. resumes the request after successful authentication;
6. calls the protected `/api/sso/authorize` endpoint with the authenticated VexaAccount session;
7. follows the registered redirect URI with the one-time authorization code and original state.

A direct unauthenticated request to `/api/sso/authorize` can correctly return `Authentication required`; that endpoint is not the public login page.

## Other application backend

The integrating backend generates a cryptographically random `state`, PKCE `code_verifier` and S256 `code_challenge`. It stores the state/verifier in a short-lived protected login transaction.

After the browser returns to the application's callback, the backend:

1. validates `state`;
2. sends the one-time authorization code to `/api/sso/token`;
3. authenticates the token request with the Client Secret;
4. sends the same exact redirect URI and PKCE verifier;
5. obtains the access/refresh tokens;
6. calls `/api/sso/userinfo` with the access token;
7. uses `userinfo.sub` as the stable VexaAccount identity key;
8. creates or finds the application's own local user;
9. establishes its own application session.

## Complete flow

```text
Other App Backend
  → generate state + S256 PKCE
  → browser redirects to VexaAccount User #/sso/authorize
  → VexaAccount login/register/recovery/verification/2FA as required
  → authenticated browser resumes pending request
  → VexaAccount /api/sso/authorize
  → exact registered callback + one-time code + state
  → Other App validates state
  → Other App Backend /api/sso/token
  → access token + refresh token
  → Other App Backend /api/sso/userinfo
  → local user mapping by sub
  → Other App local session
```

## Token lifecycle

Authorization codes are short-lived and one-time. Access tokens are used for userinfo. Refresh tokens are rotated and the previous refresh token is revoked. Logout/revocation is handled through the VexaAccount SSO lifecycle and the application's own session lifecycle.

## Secret rule

Never put `clientSecret` inside `VEXA_ACCOUNT_SSO_CONFIG`. Correct:

```env
VEXA_ACCOUNT_CLIENT_SECRET=generated-secret
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","userUrl":"https://<vexaaccount-user-host>","clientId":"...","redirectUri":"https://app.example.com/auth/vexaaccount/callback","scopes":["openid","profile","email"],"timeoutMs":10000}
```

The Client Secret is returned only during client creation/secret rotation and must remain server-side thereafter.

## Supported scopes

The provider currently supports:

```text
openid
profile
email
account
session
applications
notifications
```

Clients must satisfy both provider-supported-scope validation and per-client allowed-scope validation. Use least privilege.

## Ownership boundary

VexaAccount owns identity, authentication, authorization-code issuance, SSO client registration, redirect validation, token lifecycle, consent and SSO security events. The external application owns its local authorization, business data and application session.
