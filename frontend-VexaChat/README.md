# VexaChat Static Site

VexaChat is a VexaAccount-connected messenger with an original Vexa visual system and familiar modern chat patterns. It is not a pixel-for-pixel copy of Telegram or WhatsApp.

## Render Static Site
- Root directory: `frontend-VexaChat`
- Build command: `npm run build`
- Publish directory: `frontend-VexaChat` (when Render Root Directory is the repository root)
- If Root Directory is already `frontend-VexaChat`, Publish Directory: `.`
- Environment variable: `VEXA_CHAT_API_BASE=https://api-vexaaccount.onrender.com`

The static client authenticates through the existing VexaAccount session/token and calls:
- `/api/chat/me`
- `/api/chat/users`
- `/api/chat/conversations`
- `/api/chat/conversations/:id/messages`
- `/api/chat/events` (SSE)
- `/api/chat/presence`
- `/api/chat/reactions`
- `/api/chat/blocks`

## Required backend CORS
Set the backend Render environment variable:
`VEXA_ALLOWED_ORIGINS=https://<your-actual-vexachat-render-host>`

If the site uses the default `https://vexachat.onrender.com`, the example configuration already matches it.

## Android
The Android project in `packaging/vexachat/android` hosts the Static Site in a secure WebView. The GitHub Actions workflow produces a release APK artifact.
