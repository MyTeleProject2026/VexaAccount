# VexaAccount Android packaging

This is the canonical native Android packaging project for the VexaAccount User and Owner Control Center web applications.

## Variants

- `user`: `com.mytele.vexaaccount.user`
- `owner`: `com.mytele.vexaaccount.owner`

The app opens the HTTPS web application configured in `WEB_APP_URL`. The default deployment values can be overridden at build time with `-PuserWebAppUrl=...` and `-PownerWebAppUrl=...`.

## Build

```bash
chmod +x gradlew
gradlew assembleUserRelease bundleUserRelease assembleOwnerRelease bundleOwnerRelease
```

GitHub Actions builds both APK and AAB artifacts on every `master` push and manual run. The project targets Android API 36; JDK 17 and the Android SDK are provisioned by CI.

Release signing is intentionally not committed. Configure the production signing key in the release pipeline before publishing to an app store.
