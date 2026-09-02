# VexaAccount application packaging

The web application is the canonical VexaAccount client. The production PWA layer supports browser installation on Android, iOS/iPadOS, Windows and desktop Chromium browsers.

## Android

`android/twa-manifest.json` is the Bubblewrap/TWA source configuration. Generate the Android project with the current GoogleChromeLabs Bubblewrap tooling, then build a signed APK/AAB with the production keystore. Store keystore files and passwords only in CI secrets; never commit them.

Required production values:
- package ID: `com.vexaaccount.app`
- host: `vexaaccount-management.onrender.com`
- HTTPS origin
- 192x192 and 512x512 PNG icons
- Digital Asset Links for the TWA release signing fingerprint

## iOS / iPadOS

The PWA itself installs directly from Safari using **Share → Add to Home Screen**. `src/pwa.js` provides the install guidance because iOS does not expose Chromium's `beforeinstallprompt` API.

For an App Store binary, use PWABuilder's current iOS package to generate an Xcode project, then build/sign/archive it on macOS with Xcode and the Apple Developer account. A signed IPA cannot be produced by the Linux Render service and must not be fabricated in CI.

## Windows

Edge/Chromium can install the PWA directly as a Windows app from the manifest. For Microsoft Store distribution, generate the current MSIX package through PWABuilder, then sign/submit it according to Microsoft Store requirements.

## CI

`.github/workflows/pwa-packages.yml` validates the production manifest and required icons on every `master` push. If a generated Android Gradle project is added under `packaging/android`, the same workflow automatically builds release APK/AAB artifacts.

Store signing credentials are intentionally external to the repository.
