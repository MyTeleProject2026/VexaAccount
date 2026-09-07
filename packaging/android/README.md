# VexaAccount Android Packaging

The Android package wraps the VexaAccount user experience as a web-backed application.

## Runtime boundary

Authentication, account state, SSO consent and security operations remain server-authoritative. The Android shell must not contain provider client secrets or persistent refresh tokens.

## MTP2026

MTP2026 is a separate consuming application. Its Android/web launcher integration is maintained in the MTP2026 repository and should consume the existing VexaAccount SSO contract.

## Release guidance

Build from the current repository baseline, verify the deployed API/frontend endpoints, and perform an authenticated SSO smoke test before release. Do not treat packaging success as identity-flow certification.
