# System C Identity Observability

System C is the authenticated observability surface for VexaAccount identity and platform operations.

## Observability domains

- authentication and identity activity;
- SSO authorization, token and session activity;
- API request and latency signals;
- security events;
- Owner/Super Admin audit events; and
- runtime and health indicators.

## Access control

The System C frontend is available only to a live authenticated Super Admin session. This is a usability gate, not the security boundary. Backend System C routes independently enforce Super Admin authorization.

## Operational model

```text
Protected request
  → telemetry middleware / route instrumentation
  → persisted or aggregated observability data
  → System C backend endpoint
  → Super Admin authorization
  → System C UI
```

Observability must not expose credentials, access tokens, refresh tokens, authorization codes or PKCE verifiers.

## MTP2026

MTP2026 is observed as an external SSO consumer. When MTP login fails, troubleshoot the MTP runtime first and then use provider-side System C/diagnostic signals to confirm whether the provider contract was reached and where the failure occurred.

## Security events

Sensitive owner/account actions can produce audit/security signals and invalidate affected sessions. These signals are intended to support operational verification without exposing secret material.

## Verification boundary

System C visibility does not prove that an operation succeeded end-to-end. For important changes, correlate the request with the API result, database state, session/token state and downstream application behavior.
