# VexaAccount Super Admin Frontend

Canonical standalone static frontend for the VexaAccount Owner OS and Super Admin control plane.

## Current runtime entrypoint

`index.html` directly loads the canonical Owner runtime:

```text
owner-os.js
sso-integration-generator.js
sso-runtime-sync.js
sso-status-sync.js
sso-integration-factory-v4.js
sso-github-deployer.js
sso-application-integration-builder.js
sso-application-builder-launcher.js
```

The current Owner OS source is authoritative. Older loader/control-center entrypoints are not loaded by the production index.

## Real backend connection

The Owner frontend uses the VexaAccount backend at `https://api-vexaaccount.onrender.com` and uses the existing Super Admin authentication/session boundary.

Existing Owner capabilities are API-backed, including SSO application registry, application details, exact redirect URI management, scope grants, activation/disablement, secret rotation, diagnostics/runtime synchronization, user management, support and platform operations.

The SSO Integration Factory generates integration source packages from the authoritative registry configuration. Generated client secrets remain one-time/server-side values and are never persisted in browser storage.

## GitHub integration deployment

The optional generated-package GitHub deployment path is server-side. The frontend does not receive the GitHub deployment credential. The backend performs repository validation and the atomic commit through the configured deployment service.

## Verification

`.github/workflows/verify.yml` checks the current Owner OS entrypoint, SSO factory contracts, deployment API contracts and security rules. Production runtime smoke separately checks that the deployed Super Admin HTML actually serves the current Owner OS assets.

A passing static check does not certify a stale deployment. Production certification requires the deployed application to serve the current repository runtime and complete the real API workflow.
