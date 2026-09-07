# VexaAccount Application Packaging

The VexaAccount web application is the canonical client. Packaging wraps that deployed web experience without moving identity authority into the client shell.

## PWA

The production PWA supports installation on Android, iOS/iPadOS, Windows and desktop Chromium browsers through the web manifest/service-worker layer.

Authentication, account state, SSO consent and security operations remain server-authoritative.

## Android

`packaging/android/twa-manifest.json` is the TWA source configuration. Generate/build the Android project with current Bubblewrap tooling and sign the release APK/AAB using the production keystore.

Production identifiers currently include:

- package ID: `com.vexaaccount.app`
- host: `vexaaccount-management.onrender.com`
- HTTPS origin
- 192x192 and 512x512 icons
- Digital Asset Links for the release signing fingerprint

Keystores and signing passwords must exist only in protected build/CI secrets.

## iOS / iPadOS

Safari can install the PWA through **Share → Add to Home Screen**. The web client provides installation guidance because iOS does not expose Chromium's `beforeinstallprompt` API.

An App Store package requires a real Xcode/PWABuilder workflow on macOS. A signed IPA must not be fabricated by a Linux service.

## Windows

Edge/Chromium can install the PWA directly. Microsoft Store distribution requires a properly generated and signed MSIX package and the normal Store submission process.

## CI and release verification

`.github/workflows/pwa-packages.yml` validates the web manifest and required icons. If a generated Android Gradle project is present, CI can build the release artifacts according to the workflow configuration.

Packaging success is not identity-flow certification. Before release, verify the deployed frontend/API, authenticated account flow and SSO behavior separately.
