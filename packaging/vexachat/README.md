# VexaChat Android

Native Android WebView shell for the VexaChat Static Site. The messaging UI and API integration remain in frontend-VexaChat; this APK provides an installable Android host.

Build command:
./gradlew :app:assembleRelease -PVEXACHAT_WEB_URL=https://your-vexachat-render-url.onrender.com

The GitHub Actions workflow builds the release APK and publishes it as a workflow artifact.
