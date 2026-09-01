# VexaAccount

VexaAccount is the central identity, authentication, account-management and single sign-on (SSO) service for the Vexa ecosystem. Applications such as VexaTrade, VexaStore, MTP2026 App Launcher and future Vexa applications integrate with the existing VexaAccount SSO service using an application-specific client created in the VexaAccount Super Admin panel.

> **Integration rule:** An application integrating VexaAccount SSO does not copy or modify VexaAccount backend source code. The application adds the integration layer inside its own repository and backend deployment.

---

## 1. Architecture

```text
VexaAccount Super Admin
        |
        | creates application client
        v
Client ID + Client Secret + Redirect URI
        |
        v
Your Application Backend
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
6. Activate the application.
7. Generate or copy the Client ID and Client Secret.
8. Store the credentials only in the application's backend environment variables.

Example callback:

```text
https://your-app.example.com/auth/callback
```

The callback URI used by the application must exactly match the URI registered in VexaAccount.

---

## 3. Required backend environment variables

Every integrating application's backend should have an application-specific SSO configuration.

```env
VEXA_ACCOUNT_SSO_CONFIG={"url":"https://api-vexaaccount.onrender.com","clientId":"YOUR_APP_CLIENT_ID","clientSecret":"YOUR_APP_CLIENT_SECRET","redirectUri":"https://your-app.example.com/auth/callback","timeoutMs":10000}
```

If the application signs its own local JWT/session after VexaAccount authentication, configure a separate application-owned secret:

```env
CLIENT_JWT_SECRET=generate_a_long_random_secret_for_this_application
```

Do not commit real secrets to GitHub. Do not put the VexaAccount Client Secret in frontend JavaScript, HTML, CSS or public environment variables.

### Render

In the application's Render backend service:

1. Open the backend service.
2. Open **Environment**.
3. Add `VEXA_ACCOUNT_SSO_CONFIG`.
4. Add the application's own session/JWT secret if required.
5. Save and redeploy.

The production redirect URI in `VEXA_ACCOUNT_SSO_CONFIG` must be identical to the URI registered in VexaAccount Super Admin.

---

## 4. Ready-to-use backend structure

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

## 5. `backend/config/vexaAccount.js`

```js
function loadVexaAccountConfig() {
  const raw = process.env.VEXA_ACCOUNT_SSO_CONFIG;

  if (!raw) {
    throw new Error("VEXA_ACCOUNT_SSO_CONFIG is required");
  }

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    throw new Error("VEXA_ACCOUNT_SSO_CONFIG must be valid JSON");
  }

  const required = ["url", "clientId", "clientSecret", "redirectUri"];
  for (const key of required) {
    if (!config[key] || typeof config[key] !== "string") {
      throw new Error(`VEXA_ACCOUNT_SSO_CONFIG.${key} is required`);
    }
  }

  return {
    url: config.url.replace(/\/$/, ""),
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    timeoutMs: Number(config.timeoutMs) || 10000
  };
}

module.exports = { loadVexaAccountConfig };
```

---

## 6. `backend/services/vexaAccountSso.js`

The exact endpoint names should follow the VexaAccount SSO service available to your registered application. This module keeps all VexaAccount HTTP calls in one place.

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

  return {
    verifier,
    challenge,
    method: "S256"
  };
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
    headers: {
      "Content-Type": "application/json"
    },
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
    headers: {
      "Content-Type": "application/json"
    },
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
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
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

## 7. `backend/routes/auth.js`

The following example uses Express and server-side sessions. If the application already has an authentication route file, merge these routes into the existing architecture instead of replacing unrelated routes.

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

  // Add only scopes registered for this application.
  authorizeUrl.searchParams.set("scope", "openid profile email");

  res.redirect(authorizeUrl.toString());
});

router.get("/callback", async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect("/login?error=" + encodeURIComponent(error));
    }

    const pending = req.session.vexaSso;

    if (!code || !state || !pending || pending.state !== state) {
      return res.status(400).json({
        success: false,
        message: "Invalid VexaAccount SSO callback"
      });
    }

    // Short-lived authorization attempt.
    if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
      delete req.session.vexaSso;
      return res.status(400).json({
        success: false,
        message: "VexaAccount SSO request expired"
      });
    }

    const tokenResult = await exchangeAuthorizationCode({
      code,
      codeVerifier: pending.codeVerifier
    });

    const accessToken =
      tokenResult.access_token ||
      tokenResult.accessToken;

    if (!accessToken) {
      throw new Error("VexaAccount did not return an access token");
    }

    const userInfo = await getUserInfo(accessToken);

    // Keep the application's own authenticated session.
    req.session.user = {
      vexaAccountId:
        userInfo.sub ||
        userInfo.user_id ||
        userInfo.id,
      email: userInfo.email || null,
      name:
        userInfo.name ||
        userInfo.display_name ||
        null
    };

    // Do not expose provider tokens to browser JavaScript unless the
    // application's architecture explicitly requires a secure token strategy.
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
    return res.status(401).json({
      success: false,
      message: "No authenticated VexaAccount user"
    });
  }

  res.json({
    success: true,
    user: req.session.user
  });
});

module.exports = router;
```

Mount it in the application's existing server:

```js
const authRoutes = require("./routes/auth");

app.use("/auth", authRoutes);
```

Do not duplicate `app.use("/auth", ...)` if the application already mounts an auth router; add the SSO routes to that existing router instead.

---

## 8. `backend/middleware/requireVexaAccount.js`

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

Use this middleware on protected application APIs:

```js
const { requireVexaAccount } =
  require("../middleware/requireVexaAccount");

router.get(
  "/my-data",
  requireVexaAccount,
  async (req, res) => {
    // Always scope data using req.session.user.vexaAccountId.
  }
);
```

---

## 9. Frontend integration

The frontend does not need the Client Secret.

A simple sign-in button:

```html
<button type="button" id="vexaSignIn">
  Continue with VexaAccount
</button>

<script>
  document
    .getElementById("vexaSignIn")
    .addEventListener("click", () => {
      window.location.assign("/auth/login");
    });
</script>
```

A session check:

```js
async function getCurrentUser() {
  const response = await fetch("/auth/session", {
    credentials: "include"
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.user || null;
}

async function requireLogin() {
  const user = await getCurrentUser();

  if (!user) {
    window.location.assign("/login");
    return;
  }

  return user;
}
```

For React:

```jsx
export function signInWithVexaAccount() {
  window.location.assign("/auth/login");
}

export async function fetchVexaSession() {
  const response = await fetch("/auth/session", {
    credentials: "include"
  });

  if (!response.ok) return null;

  const data = await response.json();
  return data.user || null;
}
```

The browser only starts the redirect and communicates with the integrating application's backend. The browser must never contain the application Client Secret.

---

## 10. Application data isolation

Every application must use the VexaAccount identity returned after SSO as the user boundary.

Example:

```text
VexaAccount user A
        |
        +-- Application data belonging to user A

VexaAccount user B
        |
        +-- Application data belonging to user B
```

Never load another user's data based on an email supplied by the browser. Use the authenticated server-side VexaAccount identifier.

---

## 11. Redirect URI rules

These must match exactly:

```text
Registered:
https://app.example.com/auth/callback

Application config:
https://app.example.com/auth/callback
```

The following can be considered different by SSO systems:

- `http` vs `https`
- different domains
- different ports
- `/auth/callback` vs `/auth/callback/`

For local development, register a separate local callback URI/client if required by the application's environment.

---

## 12. Scopes

Request only scopes needed by the application.

Typical identity scopes:

```text
openid
profile
email
```

Additional VexaAccount scopes should only be requested when the application's registered permissions require them.

Do not request broad access merely because it is available.

---

## 13. Logout

Application logout should:

1. Destroy the application's local session.
2. Clear the application's session cookie.
3. Clear application-specific client state.

Do not delete the user's VexaAccount identity. Whether global VexaAccount logout is appropriate depends on the intended product experience.

---

## 14. Security checklist

Before deploying an integration:

- [ ] Client created in VexaAccount Super Admin.
- [ ] Correct Client ID configured in the application backend.
- [ ] Correct Client Secret stored only in backend environment variables.
- [ ] Exact production redirect URI registered.
- [ ] State validation enabled.
- [ ] PKCE S256 enabled.
- [ ] Authorization codes exchanged only by backend.
- [ ] Client Secret never sent to frontend.
- [ ] Provider tokens not unnecessarily exposed to browser code.
- [ ] Application creates its own authenticated session.
- [ ] Application data is scoped to the authenticated VexaAccount user ID.
- [ ] Protected backend routes verify the local authenticated session.
- [ ] Logout clears local application session.
- [ ] Production environment variables are configured.
- [ ] Redirect and error paths tested.

---

## 15. Troubleshooting

### Redirect URI mismatch

Check that:

- the URI registered in VexaAccount Super Admin,
- `VEXA_ACCOUNT_SSO_CONFIG.redirectUri`, and
- the application's `/auth/callback` route

describe the same exact URL.

### Invalid state

The application's login-start route must store state in the server-side session before redirecting. The callback must compare the returned state before exchanging the code.

### Token exchange fails

Check:

- Client ID
- Client Secret
- redirect URI
- authorization code expiry
- PKCE code verifier
- registered client status

### User information fails

Verify the access token and requested/approved scopes.

### User sees another user's data

Do not use a browser-provided user ID or default account. Scope database queries from the authenticated server-side VexaAccount user ID.

---

## 16. Reusable integration checklist for future Vexa apps

When creating a new Vexa app:

1. Create the application in VexaAccount Super Admin.
2. Register the app's exact callback URL.
3. Generate the app's own Client ID and Client Secret.
4. Add `VEXA_ACCOUNT_SSO_CONFIG` to the app backend deployment.
5. Add the backend SSO modules shown in this README.
6. Add `/auth/login`, `/auth/callback`, `/auth/session` and logout handling.
7. Add a frontend **Continue with VexaAccount** entry point.
8. Protect application APIs with authenticated session middleware.
9. Scope application data using the authenticated VexaAccount identity.
10. Test register/login/2FA/callback/session/logout using VexaAccount.
11. Deploy without committing secrets.

---

## 17. Vexa ecosystem model

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

Use this README as the starting integration contract for a new Vexa application. Preserve the application's existing architecture and add the equivalent SSO modules in the locations used by that application.

The application integration should be additive: **do not replace unrelated routes, storage, business logic or existing platform features merely to add VexaAccount SSO**.
