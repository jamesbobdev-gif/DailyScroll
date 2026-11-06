# Working on Daily Scroll

## Product goal

Help an end user choose a social platform, browse/scroll, pause, and return to the six-app picker reliably. Prioritize complete user journeys, obvious exit controls, and clear error recovery. The user prefers plain-language explanations and wants working changes, not just proposed plans.

## Repository map

- `desktop/main.mjs`: Electron main process, embedded official-site browsing, navigation, local budget service.
- `desktop/shell.{html,css,js}`: persistent sidebar, navigation, Pause, timer, app picker.
- `desktop/prepare.mjs`: generates `desktop/runtime/` from the shared service sources. Edit the originals, not the generated copies.
- `App.tsx`: Expo shell, hidden service WebView, native browsing handoff and budget bridge.
- `NativeFeed.tsx`: native platform WebView, tabs, pause/resume and return controls.
- `native-platforms.mjs`: native platform URLs, navigation rules, lease calculations.
- `web/client.js`, `web/client.html`, `web/*.css`: browser UI, public feeds, rooms, companion handoff.
- `server.mjs`, `budget.mjs`: service routes, persistence, schedule, daily allowance, session leases.
- `oauth.mjs`, `token-vault.mjs`, `connected-feeds.mjs`: optional provider connections and encrypted grants.
- `public-youtube.mjs`, `youtube-feed.mjs`, `public-previews.mjs`, `content.mjs`: public sources and content handling.
- `chrome-companion/`: extension source and managed-site lifecycle.
- `*.test.mjs`: Node test suite; `client.test.mjs` includes client navigation/playback regressions.
- `README.md` (what the app is, install, limitations), `CONTRIBUTING.md`, `SECURITY.md` (what is stored where, reporting path), `LICENSE` (MIT), `GITHUB-DESCRIPTION.md` (the About box text and topics), `RELEASE-NOTES.md` (the current release).
- `docs/`: `HOSTING.md` (Fly.io), `PHONE-INSTALLATION.md`, `ANDROID-APK.md`, `STORE-READINESS.md`, `DEVELOPMENT-HISTORY.md` (older notes), `images/` (README screenshots: from the app in testing mode, no account signed in, nothing personal).
- `.github/workflows/`: the installer build. `Dockerfile`, `fly.toml`, `docker-entrypoint.sh`: the hosted service.

## Commands

From repository root: `npm ci`, `npm run service`, `npm test`, `npm run check`.
For Expo: `npm start` with the service running separately.
For Windows: `cd desktop`, `npm ci`, `npm start`; `npm run build` builds the installer.
Use the committed lockfiles. Do not commit dependencies or build output.

## Current behavior and recent fixes

Testing mode intentionally disables time limits and counts elapsed browsing time. `npm run service:limited` enables normal enforcement. The desktop app enforces the hour by default; `--testing` on its command line or `SCROLL_TEST_MODE=1` turns testing mode on there too.

The browser's Saved navigation tab was removed, though saved-content data and internal UI remain. Public feed browsing and real-site browsing are separate implementations.

The latest navigation fix makes native close restore `state.page='choose'`, leaves the picker ready underneath the native WebView, and makes Android Back exit the platform. Browser All apps bypasses the global busy flag and stays above swipe overlays. Desktop All apps closes the platform; it no longer opens the platform's homepage. Keep a visible exit available while loading, paused, and playing.

Recent earlier fixes preserve the selected saved YouTube post when filters hide it, preserve room mode when resuming, and stop repeatedly muting active companion media. Expired sessions still pause/silence companion playback.

## Verification and limitations

Latest navigation work: seven client regression tests and TypeScript checking passed; Windows YouTube -> All apps -> picker was manually verified, including stopped elapsed time. The Windows installer was rebuilt. Native navigation changes have not been checked on a physical phone.

Prior desktop walkthrough observed YouTube Shorts playback, Instagram browsing, Twitch discovery, and Snapchat Spotlight navigation. This is not comprehensive authenticated acceptance testing. TikTok/Facebook authentication and mobile provider compatibility remain unresolved.

Known broader limitations: multiple UI implementations can drift; rooms synchronize post selection, not playback; public previews cannot reproduce personal recommendation feeds; provider sign-in can be restricted in embedded browsers; connection errors and one-item-feed controls need continued end-user review. Do not claim production readiness or complete device coverage.

## Data and working conventions

Keep platform login cookies in local browser profiles and OAuth grants encrypted server-side. Never add private `.env` files, token keys, service ledgers, browser profiles, recordings, or logs to Git. `.env.example` contains blank placeholders only.

Change source files rather than packaged ASAR files or generated runtime files. Rebuild Windows artifacts before saying a source change is present in the executable. Test the affected flow and report exactly what was verified. Historical notes in `docs/DEVELOPMENT-HISTORY.md` may contradict the current implementation; prefer the source and root README.

This is a public repository. Never add a real name (beyond the LICENSE line), email, phone number, street address, local network address, machine path or account detail anywhere, including tests, docs and screenshots. No emoji in UI text, docs or commit messages. Most text files use CRLF line endings: keep each file's existing endings and never rewrite a whole file with a tool that changes them.
