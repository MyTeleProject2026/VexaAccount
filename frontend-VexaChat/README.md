# VexaChat Static Site

VexaChat is the VexaAccount-connected messenger frontend. The UI is now built as a single VexaChat Telegram-style v5 design system with responsive mobile and desktop chat patterns.

## UI architecture
- `telegram-style-v5.css` is the sole application stylesheet.
- The retired `vexachat-foundation.css`, `styles.css`, and `premium-luxury-v4.css` visual layers are no longer loaded or required.
- Authentication, chat, contacts, calls, profile, conversation details, settings, composer, attachment, and responsive mobile surfaces use the unified v5 system.
- The implementation uses familiar Telegram/WhatsApp-style interaction patterns without copying their proprietary branding or assets.

## Render Static Site
- Root directory: `frontend-VexaChat`
- Build command: `npm run build`
- Publish directory: `frontend-VexaChat` (when Render Root Directory is repository root)
- If Root Directory is already `frontend-VexaChat`, Publish Directory: `.`
- Environment variable: `VEXA_CHAT_API_BASE=https://api-vexaaccount.onrender.com`

## Android
The Android project in `packaging/vexachat/android` hosts the Static Site in a secure WebView. The GitHub Actions workflow produces a release APK artifact.
