# VexaAccount Android Packaging

The Android package is a web-backed shell around the VexaAccount user experience. It must preserve the provider's server-authoritative identity and security boundaries.

## Runtime boundary

The Android client must not contain VexaAccount provider client secrets or persistent provider refresh tokens. Authentication, account state, SSO consent, security changes and session revocation remain backend-controlled.

## Current package

- Application package: `com.vexaaccount.app`
- Provider host: `vexaaccount-management.onrender.com`
- HTTPS web origin
- TWA-compatible web experience

## Release process

1. Build from the current `master` source.
2. Validate the web manifest, icons and production URLs.
3. Generate/update the Android project with current Bubblewrap tooling.
4. Build the release APK/AAB.
5. Sign using a protected production keystore.
6. Verify Digital Asset Links and the deployed web origin.
7. Run an authenticated VexaAccount account/SSO smoke test.
8. Release only after the deployed identity flow is verified.

Keystores, passwords and other signing credentials must never be committed.

## MTP2026

MTP2026 is a separate consumer. Its launcher/mobile integration remains in the MTP2026 repository and consumes the existing VexaAccount SSO contract.

## Verification boundary

A successful Android build proves packaging only. It does not prove SSO, account security or backend persistence. Those require deployed runtime testing.