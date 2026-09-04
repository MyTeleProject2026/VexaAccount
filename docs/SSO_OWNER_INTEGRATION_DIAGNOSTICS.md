# SSO Owner Integration Diagnostics

The Owner/Super Admin SSO registry is the authoritative control plane for connected applications. The diagnostics endpoint provides a read-only health view of a registered client and a narrowly scoped status-repair action.

## Diagnostics endpoint

```text
GET /api/sso-registry/applications/:clientId/diagnostics
```

The endpoint is protected by the Super Admin authorization middleware. It reports:

- registry status and client active flag;
- whether the registry/client records are present;
- whether registry status and `sso_clients.is_active` agree;
- redirect URI presence and HTTPS/localhost validity;
- allowed-scope presence and supported-scope validity;
- whether a client-secret hash exists (the secret itself is never returned);
- last use and last secret rotation timestamps;
- active SSO session and consent counts;
- recent recorded SSO failure events;
- canonical provider endpoints.

The endpoint never returns the client secret or secret hash value.

## Status synchronization

```text
POST /api/sso-registry/applications/:clientId/repair-status
```

This action is also Super Admin protected. It does **not** create credentials, change redirect URIs, change scopes, or recover a secret. It only synchronizes `sso_clients.is_active` with the already-authoritative registry status when the client record and its redirect/scope configuration are valid.

The safe mapping is:

```text
registry status = active
        → sso_clients.is_active = 1

registry status = pending/disabled/maintenance/rejected/revoked
        → sso_clients.is_active = 0
```

If the client record is missing, the registry status is invalid, or redirect/scope configuration is invalid, the repair operation refuses to modify the client.

## Owner UI

The Super Admin Owner Control Center exposes **Check health** and **Sync status** actions for each registered SSO application. The diagnostics modal displays configuration checks, active session/consent counts, recent failures, redirect URIs, allowed scopes and provider endpoints.

## Troubleshooting the MTP2026 App Launcher integration

For the production MTP2026 App Launcher registration, verify all of the following in the Owner Control Center:

1. Registry status is `active`.
2. Client active is `Yes` in diagnostics.
3. The registered callback is exactly:

```text
https://mtp2026-app-launcher.onrender.com/auth/callback
```

4. The client allows every scope requested by MTP2026.
5. The application backend uses the same client ID and exact callback.
6. The client secret currently configured in the MTP2026 backend is the secret from the latest creation/rotation operation.
7. The MTP2026 browser begins at the VexaAccount User frontend `#/sso/authorize` bridge.

After source changes are deployed, run a real authenticated end-to-end login. Repository commits and source checks are not a substitute for production certification.
