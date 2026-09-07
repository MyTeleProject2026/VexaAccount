# System C Identity Observability

System C is the authenticated observability surface for VexaAccount identity and platform operations.

## Observed domains

- authentication and identity activity
- SSO authorization/token/session activity
- API request and latency signals
- security events
- owner/admin audit events
- runtime/health indicators

## Access

The System C UI requires a live VexaAccount Super Admin session. Frontend visibility is not an authorization mechanism; backend routes enforce owner authorization.

## Integration use

MTP2026 is observed as an external SSO consumer. Troubleshoot MTP failures from the MTP repository/runtime first, then use provider-side diagnostics to confirm the SSO contract.

## Boundary

System C documentation describes the current VexaAccount provider. MTP2026 implementation work belongs in MTP2026 and must not alter VexaAccount source code.
