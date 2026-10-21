# Daily Scroll

A social browsing app with a six-platform picker: YouTube, Instagram, TikTok, Facebook, Twitch, and Snapchat. This repository contains the Windows desktop app, an Expo phone app, a browser interface, a Chrome companion, and their shared Node.js service.

Development prototype. Testing mode currently disables the daily schedule and time limit. The phone app is not published to an app store.

## Start here

- **Claude / coding assistants:** read [CLAUDE.md](CLAUDE.md).
- **Windows app:** [desktop/README.md](desktop/README.md).
- **Optional provider credentials:** [ACCOUNT-SETUP.md](ACCOUNT-SETUP.md).
- Earlier implementation notes: [docs/DEVELOPMENT-HISTORY.md](docs/DEVELOPMENT-HISTORY.md). Some describe superseded interfaces.

## Run the service and browser interface

Use Node.js 22 or later and npm.

```sh
npm ci
npm run service
```

Open http://localhost:8787. This starts testing mode. For the scheduled daily hour and allowance enforcement, use `npm run service:limited` instead.

The service creates anonymous device profiles and writes local state to `data/` by default. `SERVICE_DATA_DIR` can select another private data directory. No Daily Scroll account is required.

## Run the Windows app

After installing root dependencies:

```sh
cd desktop
npm ci
npm start
```

Build the Windows installer with `npm run build` from `desktop/` on Windows. The build prepares shared service modules automatically. Installers, downloaded dependencies, and generated runtime files are excluded from Git.

The desktop app opens official platform websites inside an Electron browsing pane and starts its own local service. Sign-ins stay in its local browser profile. The **All apps** button returns to the picker; **Exit YouTube** (or the selected platform's name) closes the current site. The arrow buttons navigate within the site. Audio is enabled and controlled by the site's player.

## Run the phone app

Start the service first, then in a second terminal at the repository root:

```sh
npm start
```

Use the Expo development workflow and connect to `http://YOUR_COMPUTER_LAN_IP:8787` from a phone on the same network. `EXPO_PUBLIC_SERVICE_URL` sets the service address for a configured build. Phone browsing uses a separate native WebView; All apps and Android Back return to the picker. Physical-device sign-in, playback, and navigation still require verification.

## Browser and Chrome companion

The browser picker offers managed browsing through the Chrome companion and a public-video fallback. To use the companion during development, load `chrome-companion/` as an unpacked extension in Chrome, then reload the local service page. Generated extension ZIP files are not committed; the extension source is included.

Public feeds and embeds differ from the platforms' personalized feeds. Sites may refuse embeds or embedded-browser sign-in. Room participants follow the same selected post; playback position and play/pause are not synchronized. The Chrome mirror is experimental and requires a user-selected capture surface.

## Checks

```sh
npm test
npm run check
```

Tests cover the budget/service, platform navigation policies, provider adapters, room behavior, companion lifecycle, and client regressions. Automated tests do not establish that real social-account sign-in works.

## Configuration and private data

`.env.example` lists optional provider settings with blank credentials. Copy it to a private `.env` and run `node --env-file=.env server.mjs` when using configured providers. Add `--testing` if testing mode is wanted. Never put secrets in `EXPO_PUBLIC_*` values.

Do not commit `.env`, service data, encryption keys, account cookies, browser profiles, logs, installers, or local screenshots. No live credentials or user data are required to inspect this source. Production deployment needs HTTPS, persistent private storage, registered provider applications where applicable, and further review.
