# VexaAccount

VexaAccount is the central identity, authentication, account-management and single sign-on (SSO) service for the Vexa ecosystem. Applications such as VexaTrade, VexaStore, MTP2026 App Launcher and future Vexa applications integrate with the existing VexaAccount SSO service using an application-specific client created in the VexaAccount Super Admin panel.

> **Integration rule:** An application integrating VexaAccount SSO does not copy or modify VexaAccount backend source code. The application adds the integration layer inside its own repository and backend deployment.

---

## 1. Architecture

```text
VexaAccount Super Admin
        |
        | creates + approves application client
        v
Client ID + Client Secret + Redirect URI + Scopes
        |
        | stored only in the integrating backend
        v
Your Application Backend (Render Web Service)
        |
        | authorization-code + PKCE exchange
        v
VexaAccount SSO API
        |
        v
Authenticated VexaAccount User
        |
        v
Your Application Session
```

Each application must have its **own** client registration. Never reuse another application's client ID, client secret or redirect URI.

---

## 2. Create an application client

In VexaAccount Super Admin:

1. Open **Applications / SSO Application Registry**.
2. Create a new application.
3. Set the application name and application key.
4. Add the exact production redirect URI.
5. Configure the permitted scopes required by that application.
6. Activate/approve the application.
7. The registry generates a unique Client ID and Client Secret.
8. Copy the Client Secret immediately. It is intentionally not recoverable from the registry after creation; rotate it if it is lost or exposed.
9. Generate the two backend environment values described below.
10. Store them only in the integrating application's Render backend environment.

Example callback:

```text
https://your-app.example.com/auth/callback
```

The callback URI used by the application must exactly match the URI registered in VexaAccount.

---

## 3. Required Render backend environment variables

Every integrating application's backend should use **two VexaAccount-specific environment variables**. These are application deployment variables, not VexaAccount frontend variables.

### Variable 1 — `VEXA_ACCOUNT_CLIENT_SECRET`

Store the generated Client Secret from VexaAccount Super Admin:

```env
VEXA_ACCOUNT_CLIENT_SECRET=YOUR_GENERATED_VEXAACCOUNT_CLIENT_SECRET
```

### Variable 2 — `VEXA_ACCOUNT_SSO_CONFIG`

Store the non-secret connection configuration separately from the secret:

```env
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"YOUR_APP_CLIENT_ID","redirectUri":"https://your-app.example.com/auth/callback","timeoutMs":10000}
```

The backend integration combines the two values when authenticating with VexaAccount:

```js
const config = JSON.parse(process.env.VEXA_ACCOUNT_SSO_CONFIG);
const clientSecret = process.env.VEXA_ACCOUNT_CLIENT_SECRET;

if (!clientSecret) {
  throw new Error('VEXA_ACCOUNT_CLIENT_SECRET is required');
}
```

**Do not put the Client Secret inside frontend code, Vite/React public variables, HTML, CSS, GitHub, or a public config file.** `VEXA_ACCOUNT_SSO_CONFIG` is safe to store as deployment configuration only when it contains no secret. The secret must remain in `VEXA_ACCOUNT_CLIENT_SECRET`.

If the application signs its own local JWT/session after VexaAccount authentication, configure a separate application-owned secret:

```env
CLIENT_JWT_SECRET=generate_a_long_random_secret_for_this_application
```

### Render deployment flow

In the application's **Render Web Service → Environment**:

```text
VEXA_ACCOUNT_CLIENT_SECRET = generated secret from VexaAccount Super Admin
VEXA_ACCOUNT_SSO_CONFIG    = JSON connection configuration
```

Then save and redeploy the backend. The production redirect URI in `VEXA_ACCOUNT_SSO_CONFIG` must be identical to the URI registered in VexaAccount Super Admin.

---

## 4. How the Super Admin creates the integration credentials

The VexaAccount Super Admin application registry is the credential-generation authority.

```text
Super Admin → Applications
      ↓
Create application
      ↓
Application name + application key
      ↓
Exact redirect URI(s)
      ↓
Allowed SSO scopes
      ↓
Create
      ↓
VexaAccount generates:
  • Client ID
  • Client Secret
      ↓
Copy Client Secret once
      ↓
Build backend values:
  VEXA_ACCOUNT_CLIENT_SECRET=<Client Secret>
  VEXA_ACCOUNT_SSO_CONFIG={...clientId, redirectUri, url...}
      ↓
Add both to the other app's Render backend
      ↓
Activate/approve application
      ↓
Other app can start VexaAccount SSO
```

The VexaAccount registry currently supports these scopes:

```text
openid
profile
email
account
session
applications
notifications
```

Request only the scopes that the application actually needs. If an application is intentionally designed to use the complete VexaAccount integration surface, the Super Admin may grant all of the supported scopes above. The backend still enforces the scopes contained in the issued SSO token.

---

## 5. Full SSO access flow for another Vexa application

The recommended flow is OAuth/OIDC-style authorization code + PKCE with the VexaAccount SSO service.

```text
1. User opens VexaTrade / VexaStore / another Vexa app
                         |
                         v
2. User clicks "Continue with VexaAccount"
                         |
                         v
3. App backend creates state + PKCE verifier
                         |
                         v
4. Browser redirects to VexaAccount /api/sso/authorize
                         |
                         v
5. VexaAccount checks the user's existing VexaAccount session
                         |
              +----------+----------+
              |                     |
         no session             valid session
              |                     |
              v                     v
       VexaAccount login       consent / authorization
                                    |
                                    v
6. VexaAccount returns authorization code + state
                         |
                         v
7. App backend validates state
                         |
                         v
8. App backend POSTs /api/sso/token with:
     • client_id
     • VEXA_ACCOUNT_CLIENT_SECRET
     • code
     • redirect_uri
     • PKCE code_verifier
                         |
                         v
9. VexaAccount validates client, redirect URI and PKCE
                         |
                         v
10. VexaAccount returns short-lived access token + refresh token
                         |
                         v
11. App backend calls /api/sso/userinfo
                         |
                         v
12. App backend creates its own secure application session
                         |
                         v
13. User is signed in to the other Vexa application
```

The other application does **not** need to receive or store the VexaAccount password. The application receives identity and the permissions represented by the SSO scopes.

---

## 6. Full-access integration meaning

"Full access" means **all VexaAccount SSO scopes that the application has explicitly been granted**, not unrestricted access to arbitrary database rows or another application's private data.

With all supported scopes, the integration can receive the corresponding claims/features exposed by the SSO service:

| Scope | Purpose |
|---|---|
| `openid` | SSO identity subject |
| `profile` | Name/profile/contact claims supported by VexaAccount |
| `email` | Email and verification state |
| `account` | VexaAccount account identity claims |
| `session` | SSO session-related claim |
| `applications` | Application-access claim |
| `notifications` | Notification-access claim |

The application's backend must still authorize every operation. A scope is not a replacement for application-level authorization.

---

## 7. Ready-to-use backend structure

Add the following structure to the integrating application's backend without replacing unrelated application files:

```text
backend/
├── config/
│   └── vexaAccount.js
├── services/
│   └── vexaAccountSso.js
├── routes/
│   └── auth.js
├── middleware/
│   └── requireVexaAccount.js
└── server.js
```

Existing projects may use different folder names. Keep the application's existing architecture and add the equivalent modules.

---

## 8. `backend/config/vexaAccount.js`

```js
function loadVexaAccountConfig() {
  const raw = process.env.VEXA_ACCOUNT_SSO_CONFIG;
  const clientSecret = process.env.VEXA_ACCOUNT_CLIENT_SECRET;

  if (!raw) {
    throw new Error("VEXA_ACCOUNT_SSO_CONFIG is required");
  }

  if (!clientSecret) {
    throw new Error("VEXA_ACCOUNT_CLIENT_SECRET is required");
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error("VEXA_ACCOUNT_SSO_CONFIG must be valid JSON");
  }

  const required = ["url", "clientId", "redirectUri"];
  for (const key of required) {
    if (!config[key] || typeof config[key] !== "string") {
      throw new Error(`VEXA_ACCOUNT_SSO_CONFIG.${key} is required`);
    }
  }

  return {
    url: config.url.replace(/\/$/, ""),
    clientId: config.clientId,
    clientSecret,
    redirectUri: config.redirectUri,
    timeoutMs: Number(config.timeoutMs) || 10000
  };
}

module.exports = { loadVexaAccountConfig };
```

---

## 9. `backend/services/vexaAccountSso.js`

The exact endpoint names follow the VexaAccount SSO service. This module keeps all VexaAccount HTTP calls in one place.

```js
const crypto = require("crypto");
const { loadVexaAccountConfig } = require("../config/vexaAccount");

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createPkce() {
  const verifier = base64Url(crypto.randomBytes(64));
  const challenge = base64Url(
    crypto.createHash("sha256").update(verifier).digest()
  );

  return { verifier, challenge, method: "S256" };
}

async function vexaFetch(path, options = {}) {
  const config = loadVexaAccountConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.url + path, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || "VexaAccount request failed");
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function exchangeAuthorizationCode({ code, codeVerifier }) {
  const config = loadVexaAccountConfig();
  return vexaFetch("/api/sso/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier
    })
  });
}

async function refreshAccessToken(refreshToken) {
  const config = loadVexaAccountConfig();
  return vexaFetch("/api/sso/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret
    })
  });
}

async function getUserInfo(accessToken) {
  return vexaFetch("/api/sso/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

module.exports = {
  createPkce,
  exchangeAuthorizationCode,
  refreshAccessToken,
  getUserInfo
};
```

---

## 10. `backend/routes/auth.js`

The integrating application's backend starts the SSO flow, validates state, exchanges the code and creates the application's own session.

```js
const crypto = require("crypto");
const express = require("express");
const { loadVexaAccountConfig } = require("../config/vexaAccount");
const {
  createPkce,
  exchangeAuthorizationCode,
  getUserInfo
} = require("../services/vexaAccountSso");

const router = express.Router();

router.get("/login", (req, res) => {
  const config = loadVexaAccountConfig();
  const state = crypto.randomBytes(32).toString("hex");
  const pkce = createPkce();

  req.session.vexaSso = {
    state,
    codeVerifier: pkce.verifier,
    createdAt: Date.now()
  };

  const authorizeUrl = new URL(config.url + "/api/sso/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", pkce.challenge);
  authorizeUrl.searchParams.set("code_challenge_method", pkce.method);
  authorizeUrl.searchParams.set(
    "scope",
    "openid profile email account session applications notifications"
  );

  res.redirect(authorizeUrl.toString());
});

router.get("/callback", async (req, res, next) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect("/login?error=" + encodeURIComponent(error));

    const pending = req.session.vexaSso;
    if (!code || !state || !pending || pending.state !== state) {
      return res.status(400).json({ success: false, message: "Invalid VexaAccount SSO callback" });
    }

    if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
      delete req.session.vexaSso;
      return res.status(400).json({ success: false, message: "VexaAccount SSO request expired" });
    }

    const tokenResult = await exchangeAuthorizationCode({
      code,
      codeVerifier: pending.codeVerifier
    });

    const accessToken = tokenResult.access_token;
    if (!accessToken) throw new Error("VexaAccount did not return an access token");

    const userInfo = await getUserInfo(accessToken);

    req.session.user = {
      vexaAccountId: userInfo.sub,
      email: userInfo.email || null,
      name: userInfo.name || null
    };

    delete req.session.vexaSso;
    return res.redirect("/");
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

router.get("/session", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "No authenticated VexaAccount user" });
  }
  res.json({ success: true, user: req.session.user });
});

module.exports = router;
```

Mount it in the application's existing server:

```js
const authRoutes = require("./routes/auth");
app.use("/auth", authRoutes);
```

Do not duplicate an existing `/auth` mount; merge the SSO handlers into the existing authentication architecture.

---

## 11. `backend/middleware/requireVexaAccount.js`

```js
function requireVexaAccount(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.vexaAccountId) {
    return res.status(401).json({
      success: false,
      message: "VexaAccount sign-in required"
    });
  }

  next();
}

module.exports = { requireVexaAccount };
```

Use this middleware on protected application APIs and always scope application data using the authenticated server-side VexaAccount identifier.

---

## 12. Frontend integration

The frontend does not need either credential. It only starts the application's backend SSO route:

```html
<button type="button" id="vexaSignIn">Continue with VexaAccount</button>
<script>
  document.getElementById("vexaSignIn").addEventListener("click", () => {
    window.location.assign("/auth/login");
  });
</script>
```

The browser never receives `VEXA_ACCOUNT_CLIENT_SECRET`.

---

## 13. Application data isolation

Every application must use the VexaAccount identity returned after SSO as the user boundary. Never load another user's data based only on an email or user ID supplied by browser code.

---

## 14. Redirect URI rules

These must match exactly:

```text
Registered:
https://app.example.com/auth/callback

Application config:
https://app.example.com/auth/callback
```

The following can be different redirect URIs: `http` vs `https`, different domains, different ports, or `/auth/callback` vs `/auth/callback/`.

For local development, register a separate local callback URI/client when appropriate.

---

## 15. Scopes and permissions

Request only scopes needed by the application. If the application is intentionally approved for complete supported VexaAccount SSO access, the complete supported set is:

```text
openid profile email account session applications notifications
```

The authorization endpoint checks the registered client's allowed scopes. The token endpoint validates the client secret and PKCE. The userinfo endpoint exposes claims according to the issued token scopes.

---

## 16. Logout

Application logout should destroy the application's local session, clear the application session cookie and clear application-specific state. VexaAccount identity itself must not be deleted by application logout.

---

## 17. Security checklist

Before deploying an integration:

- [ ] Client created in VexaAccount Super Admin.
- [ ] Application approved/activated.
- [ ] Client ID configured in `VEXA_ACCOUNT_SSO_CONFIG`.
- [ ] Client Secret configured only in `VEXA_ACCOUNT_CLIENT_SECRET`.
- [ ] Exact production redirect URI registered.
- [ ] State validation enabled.
- [ ] PKCE S256 enabled.
- [ ] Authorization code exchanged only by backend.
- [ ] Client Secret never sent to frontend.
- [ ] Provider tokens not unnecessarily exposed to browser code.
- [ ] Application creates its own authenticated session.
- [ ] Application data is scoped to the authenticated VexaAccount user ID.
- [ ] Protected backend routes verify the local authenticated session.
- [ ] Production Render environment variables are configured.
- [ ] Redirect, session, refresh and logout paths tested.

---

## 18. Troubleshooting

### Redirect URI mismatch

Check that the URI registered in VexaAccount Super Admin, `VEXA_ACCOUNT_SSO_CONFIG.redirectUri`, and the application's `/auth/callback` route describe the same exact URL.

### Invalid state

The application's login-start route must store state in the server-side session before redirecting. The callback must compare the returned state before exchanging the code.

### Token exchange fails

Check Client ID, `VEXA_ACCOUNT_CLIENT_SECRET`, redirect URI, authorization-code expiry, PKCE verifier and client activation status.

### User information fails

Verify the access token and requested/approved scopes.

### User sees another user's data

Do not use a browser-provided user ID or default account. Scope database queries from the authenticated server-side VexaAccount user ID.

---

## 19. Reusable integration checklist for future Vexa apps

When creating a new Vexa app:

1. Create the application in VexaAccount Super Admin.
2. Register the app's exact callback URL.
3. Generate the app's own Client ID and Client Secret.
4. Add `VEXA_ACCOUNT_CLIENT_SECRET` to the app's Render backend.
5. Add `VEXA_ACCOUNT_SSO_CONFIG` to the app's Render backend.
6. Add the backend SSO modules shown in this README.
7. Add `/auth/login`, `/auth/callback`, `/auth/session` and logout handling.
8. Add a frontend **Continue with VexaAccount** entry point.
9. Protect application APIs with authenticated session middleware.
10. Scope application data using the authenticated VexaAccount identity.
11. Test register/login/2FA/callback/session/logout using VexaAccount.
12. Deploy without committing secrets.

---

## 20. Vexa ecosystem model

```text
                       VexaAccount
                    Identity + SSO
                          |
          +---------------+---------------+
          |               |               |
      VexaTrade       VexaStore      MTP2026 Launcher
          |               |               |
          +---------------+---------------+
                          |
                   Future Vexa Apps
```

VexaAccount remains the central account and SSO provider. Each application keeps its own repository, backend, data and application session while trusting the VexaAccount identity returned through its registered SSO client.

---

## Support for application developers

Use this README as the integration contract for a new Vexa application. Preserve the application's existing architecture and add the equivalent SSO modules in the locations used by that application.

The application integration should be additive: **do not replace unrelated routes, storage, business logic or existing platform features merely to add VexaAccount SSO**.
