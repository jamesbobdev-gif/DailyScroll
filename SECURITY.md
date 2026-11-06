# Security

## Reporting a problem

If you find a way past the daily hour that a page or another user could trigger, a way to read another person's sessions, saved posts or rooms, or anything that leaks a sign-in or a token, please report it privately rather than in a public issue: use GitHub's **Report a vulnerability** button on the Security tab of this repository. You will get a reply within a few days, and credit in the fix if you want it.

## What the app is, in security terms

Daily Scroll opens the real websites of six social platforms inside its own window, counts the time, and closes them after one hour a day. It is not a parental control or a system-wide blocker: it does nothing to other browsers or the platforms' own apps. The things it must get right are keeping your sign-ins to itself, keeping the hour honest, and keeping the small service that tracks the hour private to you.

## What the app stores, and where

| What | Where | How it is protected |
|---|---|---|
| Your sign-ins to YouTube, Instagram and the others | The Windows app keeps them in its own browser profile (`persist:daily-scroll-social`) under `%APPDATA%\daily-scroll-desktop`. The browser app with the Chrome companion uses your Chrome profile. The phone app uses its own WebView. | Never read, copied or sent anywhere by Daily Scroll. Only the platform's own pages see them. The browsing view runs sandboxed with no access to your files, and it refuses notification, camera and microphone requests. |
| The daily hour: when it opens, how much is used today | The service's `store.json`. The Windows app runs its own copy of the service on a loopback port and keeps the file under `%APPDATA%\daily-scroll-desktop\allowance`. A service you run with `npm run service` keeps it in `data/` (or `SERVICE_DATA_DIR`). | A plain file on your computer. |
| Guest profiles and username accounts | The same `store.json`. | A guest profile is tied to a random device cookie. Passwords are hashed with scrypt and a per-user salt and compared in constant time. Sign-in attempts are rate-limited. The session cookie is `HttpOnly`, and `Secure` whenever the service is reached over HTTPS. |
| Optional YouTube and Twitch connections | Refresh tokens in the service's token vault. | Encrypted with AES-256-GCM. The key comes from `TOKEN_ENCRYPTION_KEY` or is generated once and kept next to the store, readable by that user only. Signing out of a guest account unlinks its connections from the device. |
| Rooms and saved posts | `store.json`. | Rooms are joined by a random invite code. Saved posts are public links you pasted. |

Nothing is sent to the authors of this app. There is no telemetry, no crash reporting and no analytics.

## What leaves the computer

- Page requests go to the platforms themselves, exactly as a browser would make them. The Windows app presents the browsing view as Chrome so the sites behave; it does not change what they receive beyond that.
- Public video and preview data is fetched from the platforms' public endpoints with no account.
- If you connect YouTube or Twitch, the OAuth exchange goes to that provider; the tokens come back to your service and stay in the vault.
- If you run the service for a phone, the phone talks to your computer over your Wi-Fi. The invite link for a room carries your computer's local address, so share it only with people on the same network.

## Design points worth knowing

- **The hour is enforced by the service, not the page.** The browsing view holds a short lease it must renew; when the hour is over or the lease lapses, the service refuses and the app closes the site and silences companion playback. A page cannot extend its own time.
- **Navigation is fenced.** The Windows app and the companion only allow addresses on the chosen platform and its sign-in domains. Other links are blocked, and new windows are refused.
- **The desktop app's service is loopback-only** on a random port, reachable by that app alone. The stand-alone service (`npm run service`) listens on every interface so phones can reach it: run it only on a network you trust, and never expose it to the internet without HTTPS and a `PUBLIC_ORIGIN` set. [docs/HOSTING.md](docs/HOSTING.md) describes the hosted setup.
- **Testing mode switches the hour off.** It exists for development. The Windows app enforces the hour by default and only turns testing mode on with `--testing` or `SCROLL_TEST_MODE=1`; a hosted service must never run with `--testing`.
- **The installers are not code-signed yet**, so Windows shows an "unrecognized app" warning. Each release carries a SHA-256 checksum file next to the installer; compare your download with `certutil -hashfile <file> SHA256` if you want to be sure of what you got. The Android APK is signed with the project's own key, which lives outside the repository.

## Out of scope

Someone with your computer unlocked can open the app and use your hour, or read `store.json`. The app does not try to stop you using the platforms elsewhere; that is a choice you make, not a lock.
