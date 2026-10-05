# VexaChat Static Site

VexaChat is the VexaAccount-connected messenger frontend. The application now uses one unified Telegram/WhatsApp-inspired messenger interaction system for desktop and mobile, while retaining VexaChat branding and VexaAccount authentication.

## UI architecture
- `telegram-style-v7.css` is the sole application stylesheet loaded by `index.html`.
- Retired visual layers such as `styles.css`, `premium-luxury-v4.css`, and earlier Telegram-style CSS generations are not part of the current frontend.
- The shell uses a two-pane desktop messenger layout and a full-screen mobile navigation model.
- Chat folders, Chats/Contacts/Calls navigation, search, pinned/muted/archived state, unread counters, drafts, message history, date separators, unread separators, jump-to-latest, replies, reactions, edit/delete, forwarding, attachments, voice notes, typing state, context menus, long-press actions, swipe-to-reply, swipe-to-archive, calls, profile, conversation details, settings and responsive safe-area behavior are implemented through the same UI system.
- Authentication remains inside VexaChat and calls the VexaAccount API directly. It does not redirect the user to the VexaAccount dashboard.
- The implementation follows familiar Telegram/WhatsApp-style interaction patterns without copying their proprietary branding, source code, or assets.

## Render Static Site
- Root directory: `frontend-VexaChat`
- Build command: `npm run build`
- Publish directory: `frontend-VexaChat` (when Render Root Directory is repository root)
- If Root Directory is already `frontend-VexaChat`, Publish Directory: `.`
- Environment variable: `VEXA_CHAT_API_BASE=https://api-vexaaccount.onrender.com`

## Android
The Android project in `packaging/vexachat/android` hosts the Static Site in a secure WebView. The GitHub Actions workflow produces a release APK artifact.
