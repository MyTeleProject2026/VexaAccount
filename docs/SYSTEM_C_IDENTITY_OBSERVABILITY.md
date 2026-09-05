# System C — Identity Observability OS

System C is an isolated, read-only observability addition. Existing VexaAccount routes, Owner OS files, User frontend files and SSO implementation files are not modified by this addition.

## New sources

- `backend/src/observatory/system-c-server.js`
- `frontend-VexaAccount-Super-admin/system-c/index.html`
- `frontend-VexaAccount-Super-admin/system-c/system-c.css`
- `frontend-VexaAccount-Super-admin/system-c/system-c.js`

## Runtime

Start the isolated service from the backend environment:

`node src/observatory/system-c-server.js`

It requires the existing backend environment, including database configuration and `JWT_SECRET`. It uses the existing Super Admin cookie/JWT authorization middleware.

Default service port: `5051`.

The service exposes:

- `GET /health`
- `GET /api/system-c/snapshot`
- `GET /api/system-c/stream` (Server-Sent Events)

## What is genuinely live

The snapshot reads current authoritative database state for registered applications, active SSO sessions, active consents, recent SSO security events and Owner audit evidence. The browser animation is driven by those snapshots.

No random transactions or synthetic SSO events are generated.

## Integration constraint

Because the existing `frontend-VexaAccount-Super-admin/src/owner-os.js` is intentionally not modified, System C is provided as an independent frontend entrypoint and is not automatically inserted into the existing System A/System B selector.

Automatically adding a System C button to the existing Owner OS selector requires editing the existing selector runtime. This addition deliberately does not do that, in accordance with the source-preservation requirement.

## Security

System C is read-only. It does not expose database credentials, client secrets, password hashes, arbitrary SQL execution or arbitrary code execution.
