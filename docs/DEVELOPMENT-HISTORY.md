# Historical development notes

These notes describe earlier iterations and may be outdated. Start with the root README.md and CLAUDE.md for current behavior.

# The Daily Scroll

A working local service and shared mobile interface for iPhone, Android, and browsers. No sign-up or Daily Scroll account is required. The opening screen is a six-app picker; the feed keeps the timer small. The app is not published to either app store.

## Run locally

Time limits are currently disabled for development: `npm run service` uses `--testing`. All six platforms can open at any hour, without spending the saved daily allowance. The local app displays Testing. Use `npm run service:limited` to restore the normal scheduled daily hour and one-hour cap. Browser permissions, platform login requirements, muted audio and connection-loss cleanup still apply.

Requires Node.js 22 or later.

```
npm ci
npm run service
```

Open `http://localhost:8787`. The browser currently running in this chat uses a separate data directory under `work/live-data`. A normal service run writes to `data/` in this folder. Set `SERVICE_DATA_DIR` to a persistent private directory for deployment.

Opening the app automatically restores or creates a private device profile. No Daily Scroll name, email, or password is requested. Platform cards open public feeds without a platform connection. On YouTube, enter a public @handle or channel link and choose Videos or Shorts. Saved channel buttons refresh that source. Other platforms use supported public post or stream links from Saved. Optional provider connections remain available in My hour; they require developer configuration.

## Public feed mode

Works directly in Chrome at the service URL; no extension is needed for this version. The timer controls playback inside Daily Scroll, not other browser tabs or original apps. No browser overlay or extension is installed.

The public YouTube reader loads up to 40 items per channel tab, caches results for 30 minutes, and remembers up to 20 sources per device profile. It reads public channel page data, so changes to YouTube pages or unavailable embeds may interrupt loading. This is a chosen-channel feed, not the signed-in recommendation feed. Instagram, TikTok, Facebook, Snapchat, and Twitch remain public-link collections, not automatically discovered feeds.

The public channel concept was informed by the user-provided [yt-feed reference](https://github.com/jamesbobdev-gif/yt-feed); the adapter here is an independent implementation that also reads available Shorts tab data.

## What works

- Public YouTube, Instagram, TikTok, Facebook, Twitch, and Snapchat link parsing and their embedded viewers. Embeds can refuse particular posts, login-restricted content, private content, or unsupported clients.
- Immersive in-app playback for short videos: the main navigation disappears, vertical clips fill the viewport, and the countdown stays visible. Swipe the screen edges or bottom gesture strip to switch posts; embedded controls remain available. Embeds keep their own branding and layout, so they are not identical to the original apps.
- Saved posts, individual platform selection, next/previous controls, keyboard navigation, and a swipe control below the embedded player.
- Anonymous device profiles and saved collections persisted on the service.
- A default daily 8–9 p.m. window, configurable before that day’s usage begins.
- Server time and short renewable session leases; the client closes its player when its lease expires or connection fails.
- A personal daily allowance shared across all platforms and rooms.
- A remembered-device allowance that survives signing out and changing accounts in the same browser.
- Rooms with invitation codes, QR invites, joining/switching rooms, host-controlled post selection, and opt-in schedule matching including time zone.
- Browser social sign-in adapters and a mobile system-browser handoff with single-use return tickets. These require the app creator’s registered developer applications; they are not activated in the local demo. Users do not register developer apps.
- Persistent encrypted YouTube/Twitch grants, automatic refresh, and reconnect handling for revoked credentials.
- Connected Twitch followed-live-stream loading and YouTube subscription uploads. YouTube currently loads up to 12 subscriptions and three recent uploads from each; these are not YouTube Home or Shorts recommendations.

Room members follow the same **post**, with updates every few seconds. Play/pause and playback position are individual. Sharing uses the host’s network address in local testing; the friend must be on the same network and able to reach the service. Set `PUBLIC_ORIGIN` to a deployed HTTPS address for internet invites.

## Platform account connections

Copy `.env.example` to a private `.env`, enter the credentials from your registered developer applications, and run:

```
node --env-file=.env server.mjs
```

For each platform register this exact redirect URI, using your HTTPS service origin:

| Platform | Callback path | Account access |
| --- | --- | --- |
| Google / YouTube | `/api/oauth/youtube/callback` | Google identity and read-only YouTube subscriptions |
| Instagram | `/api/oauth/instagram/callback` | Professional account identity |
| TikTok | `/api/oauth/tiktok/callback` | Basic TikTok identity |
| Facebook | `/api/oauth/facebook/callback` | Public profile identity |
| Twitch | `/api/oauth/twitch/callback` | Twitch identity and followed live streams |
| Snapchat | `/api/oauth/snapchat/callback` | External ID and display name |

Enable the providers’ required products and request review where required. Google uses the Google client ID for YouTube; `TIKTOK_CLIENT_ID` contains TikTok’s **client key**. Unconfigured connection buttons return a setup message instead of pretending to connect. Public playback does not require a provider connection. Set `COOKIE_SECURE=1` behind HTTPS.

YouTube/Twitch connections can load supported subscription/followed content. They do **not** import personal Home, For You, friends, Story, or Spotlight recommendations. Other content comes from public links saved into the app. Snapchat Login Kit does not expose private messages or shared content. Instagram account sign-in here is for professional accounts, not ordinary consumer accounts. A full replacement for those apps’ personalized feeds cannot be promised with these APIs.

YouTube and Twitch access/refresh grants are encrypted with AES-256-GCM in the private service data directory. A stable local encryption key is created there for local use; configure `TOKEN_ENCRYPTION_KEY` as 64 hex characters from a private secret manager for deployment. Protect and back up the key separately from encrypted data. Tokens are never returned in public profiles or browser URLs. The other providers currently retain identity links only. Social passwords are never collected. Connecting a provider keeps the same daily budget. Expired access tokens renew with a refresh token; revoked refresh tokens require sign-in again. Twitch tokens are validated on first use after service start and at least hourly while used.

## Phone app

```
npx expo start
```

For local interface testing, open in Expo Go and connect to `http://YOUR_COMPUTER_LAN_IP:8787` on the same Wi-Fi. The production build uses `EXPO_PUBLIC_SERVICE_URL` so people do not see a setup screen.

Real mobile OAuth requires a development or standalone build with the `dailyscroll://oauth` scheme; it cannot be validated through the generic Expo Go app. The system browser performs social authentication; the embedded feed receives a short-lived one-time ticket to establish its own session. Apple and Google developer accounts and signing are needed for distribution. iOS/Android builds, provider consent, and real phone playback still need device testing.

## Enforcement limits

Joining a room never transfers the host’s allowance. Changing rooms, changing the host, signing back in, and using another account on a remembered device do not replenish time. Schedules lock after usage starts. A browser disconnect may conservatively count up to the end of its 15-second lease.

This is not tamper-proof identity verification. A person can use a different device, erase all local device identifiers, create new identities, or change the client code. Stronger resistance requires device attestation, verified identities, account-abuse controls, and native checks. The app does not block the original social apps. The JSON store supports a single service process; production hosting needs durable storage, backups, HTTPS, and a reviewed deployment configuration.

## Validation

```
npm test
npm run check
npx expo export --platform android --platform ios --no-bytecode
```

Tests cover link validation, server-window enforcement, a full hour’s usage, persistence, QR image generation, room permissions, host transfer, schedule matching, time preservation across rooms/accounts, OAuth state binding, expiry, replay prevention, encrypted token storage, automatic refresh, token rotation/revocation, and supported feed loading. Provider calls are mocked in automated tests; live OAuth and authenticated feeds are not verified without real registered client credentials. Both mobile JavaScript bundles were exported; optimized Hermes compilation in this environment failed and remains a release-build check.

YouTube and TikTok embedded players were observed loading in the browser. Instagram, Facebook, Twitch, and Snapchat still need successful content playback verification on target devices.

## Sources

- [YouTube embeds](https://developers.google.com/youtube/player_parameters)
- [Google authorization](https://developers.google.com/identity/protocols/oauth2/web-server)
- [TikTok Login Kit](https://developers.tiktok.com/docs/en/login-kit-web)
- [TikTok Display API limits](https://developers.tiktok.com/docs/en/display-api-get-started)
- [Meta’s Instagram API overview](https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login)
- [Twitch authentication](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth)
- [Twitch embeds](https://dev.twitch.tv/docs/embed/video-and-clips/)
- [Snapchat Login Kit](https://developers.snap.com/snap-kit/login-kit/overview)
- [Snapchat embeds](https://developers.snap.com/api/snapchat-for-web/social-plugins/embedding-web-content)

YouTube picker icon: official asset linked from https://brand.youtube/. TikTok picker icon: official asset linked from https://developers.tiktok.com/. Stored locally to avoid external logo requests during use.

## Native personal-feed views

The iPhone/Android shell now keeps the service WebView as the private budget bridge and opens official platform pages in a second top-level WebView inside the same app. My feed enters this view. Native controls show the timer, platform tabs, pause, and back. Start/renew/stop use the existing device profile and allowance, not a second timer or identity. A 15-second server lease is renewed every five seconds; network failure, backgrounding, and lease expiry close the social view. Platform sessions use the native cookie store, which is not your desktop Chrome session.

All six platform pages have routes; end-to-end account sign-in and playback have **not** been verified on phones. Platforms may restrict embedded clients or require their own app. Google blocks embedded-browser authorization, so a YouTube WebView cannot guarantee signed-in recommendations/subscriptions. Supported YouTube subscriptions and Twitch following use the existing OAuth/API connection when configured; My feed imports those connected feeds first. See [Google’s embedded-browser policy](https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/). No user-agent impersonation, cookie extraction, or restriction bypass is used.

The desktop browser preview continues to use supported public embeds. It does not embed full personalized websites or reuse another browser’s signed-in session. Public collections for the other platforms now have their own home layouts and inline link entry. Their preview tiles identify the platform; they are not fetched video thumbnails or discovered personalized feeds.

Testing stays silent: native media requires a user action and the native view applies a mute script to media elements. No real platform playback was used to verify this change.

## Phone preview

See [phone testing instructions](../PHONE-TEST.md). The running preview uses Expo Go SDK 58 and the local Wi-Fi service. Both iOS and Android development manifests and bundles were fetched successfully. Actual device playback and account access remain unverified. Public TikTok saved posts now read available public JSON for real captions, creator names, and cover images, with bounded responses, allowlisted image hosts, and a 30-minute cache. Page changes may make previews unavailable.

## Actual social websites in desktop Chrome (companion 0.2.0)

All six desktop picker buttons now lead to the official-site launcher. The previous empty collections and public embeds remain only under Saved posts & public videos. Those saved posts are not a personal feed. Desktop My feed also leads to the launcher instead of showing a dead-end mobile-only notice.

On this development computer, no ZIP is needed. Open chrome://extensions in desktop Chrome, enable Developer mode, choose Load unpacked, and select this project's chrome-companion folder. The app's Connect Chrome once instructions include Copy folder path. Open http://localhost:8787 in that same Chrome profile and refresh. If already installed, reload the companion to version 0.2.0 and accept any new site-access prompt. This version adds access to Instagram, TikTok, Facebook, Twitch and Snapchat. On another computer, /chrome-companion.zip is available for download and extraction. This build is not published in the Chrome Web Store.

During the chosen hour, Open [platform] starts that platform's actual desktop website in a Chrome popup with a small timer and Stop button. YouTube opens Home, Instagram Home, TikTok For You, Facebook Home, Twitch Discover, and Snapchat Spotlight. Chrome's profile supplies each site's remembered login; sign in on the official site if needed. Google/Twitch/Snap login redirects are allowlisted for navigation without injecting scripts on their separate authentication domains. No credentials or browser cookies are exported. Different Chrome profiles have different account sessions and Daily Scroll device cookies. A floating timer does not make a desktop website identical to the platform's native phone app.

The local source page remains open as a same-origin budget bridge, using its existing HttpOnly Daily Scroll device cookie. Only timing fields go to the companion. All platforms share one managed session and server allowance. Switching stops the previous lease before opening the next app, without resetting used time. The new tab starts blank, is muted at browser level, and only then loads the social website. Media elements remain muted too. No page contents, feed titles, credentials, screenshots or account data are sent to the Daily Scroll server.

Foreground content scripts and a worker heartbeat renew the 15-second lease. The worker heartbeat covers official authentication redirects without reading those pages. Content checks expiry every 250 ms; a 30-second alarm supervises a restarted worker. Browser suspension and timer throttling can interrupt browsing; expired sessions fail closed when execution resumes. Stop, source closure, unsupported navigation and failed budget renewals end managed browsing. Ordinary tabs, uninstalling/disabling the extension, and browser-session restoration are not OS-wide enforcement. Native phone WebViews remain separately implemented and unverified for real account sign-in and playback.

Verification: all six launch mappings, matching host permissions, mute-before-navigation, sender checks, login redirect handling, switching, and a single real service budget across all six are tested. Live anonymous HTTP checks found all six sites responding 200 and sending cross-origin framing restrictions. These HTTP checks are not interaction or sign-in tests. Chrome is unavailable through this session's browser controls, so installed companion behavior and real signed-in accounts still require manual acceptance testing. See ../PLATFORM-CHECK.md for the audit and exact limitations.

Research: [Chrome permission guidelines](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings), [official window example](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples/windows), [content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), and [tab muting](https://developer.chrome.com/docs/extensions/reference/api/tabs). The supplied [yt-feed repository](https://github.com/jamesbobdev-gif/yt-feed) is a chosen-channel public feed, not signed-in Home. The [captured surface article](https://developer.chrome.com/docs/web-platform/captured-surface-control) documents wheel/zoom forwarding, not a full interactive browser. Google's [embedded authorization policy](https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/) explains the restrictions on embedded sign-in.

## Chrome mirror

Open Daily Scroll at http://localhost:8787 in desktop Chrome, with YouTube signed in in another Chrome tab. Choose YouTube → Mirror Chrome → Choose Chrome tab or window, then select YouTube in the browser's sharing prompt. Each capture requires your selection; the app cannot silently access Chrome. Your real recommendations and subscriptions appear because this displays the real website.

The mirror receives video only, stays muted, and is not recorded, uploaded, or broadcast to friends. Mute the source Chrome tab too: mirroring cannot silence another browser's own speakers. Desktop Chrome 136+ can optionally forward wheel scrolling for a shared tab through Enable scrolling and a separate browser permission. A shared window is view-only. Clicks and typing still happen in the source Chrome tab. In the built-in preview browser, choose a separate Chrome window if tab sharing is unavailable.

The existing daily allowance starts when sharing succeeds. Stop, capture ending, lease expiry, or server failure tears down the local stream. This closes the mirror, not the original Chrome tab. This desktop feature does not mirror desktop Chrome onto a phone. Automated lifecycle tests use fake streams; real account capture requires the user's browser selection and has not been verified here.

## Automatic public YouTube feed

Opening YouTube now refreshes all saved public channel sources automatically. First-time profiles without video-channel sources get a starter mix of Veritasium, Marques Brownlee, and Mark Rober; previously saved Shorts sources remain. Use the channel chips to filter, Refresh to request fresh channel pages, and + to add or remove sources. Removed channels are not automatically re-added. The homepage mixes channels and shows real upload thumbnails and channel names. One unavailable source does not erase successful results or saved posts from unrelated platforms.

This follows the public chosen-channel approach of the user-provided yt-feed reference. It is not a signed-in YouTube Home recommendation feed. Browsing cards and refreshing do not start the daily usage timer; selecting a video still uses the existing playback lease and muted embed.


