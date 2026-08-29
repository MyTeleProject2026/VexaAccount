# VexaAccount Backend

Standalone VexaAccount Web Services / API deployment.

This service owns the VexaAccount TiDB database and exposes authentication, SSO, account, security, and Super Admin APIs.

The backend does not require either static frontend to be deployed from this directory. User and Super Admin frontends are independent static deployments.

Never put database credentials or signing secrets in frontend projects.
