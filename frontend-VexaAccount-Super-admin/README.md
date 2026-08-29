# VexaAccount Super Admin Frontend

Standalone static frontend for the Vexa ecosystem owner / Super Admin control plane.

## Deployment

Deploy this directory independently from the VexaAccount backend and User frontend.

Configure the backend/API origin through environment-specific frontend configuration. Never place TiDB credentials, JWT signing keys, client secrets, or other server secrets in this static application.

## Responsibilities

- VexaAccount user administration
- SSO application/client management
- Redirect URI and scope administration
- Sessions and security monitoring
- Audit/security event review
- Roles and administrative permissions
- Ecosystem application controls
- System health and configuration UI
