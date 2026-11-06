# Contributing

Thanks for looking. Small, focused changes land fastest.

## Run it

```
npm ci
npm run service:limited
```

Node 22 or newer. Open http://localhost:8787 for the browser app. `npm run service` starts the same service in testing mode, which switches the daily hour off so you can try things at any time of day. `npm test` runs the unit tests (the `*.test.mjs` files, with Node's built-in runner) and `npm run check` runs TypeScript over the phone app.

For the Windows app: `cd desktop`, `npm ci`, `npm start`. `npm run build` there makes the installer. The desktop app copies the shared service modules into `desktop/runtime/` when it starts or builds, so edit the originals at the repository root, never the copies.

## Where things are

- `server.mjs` and `budget.mjs` are the service: routes, the JSON-file store, the daily hour and allowance, session leases, rooms.
- `web/` is the browser app: plain HTML, CSS and one script, no bundler.
- `desktop/` is the Windows app: `main.mjs` (the Electron main process and the embedded browsing view), `shell.*` (the sidebar, Pause and timer), `prepare.mjs` (copies the service in).
- `chrome-companion/` is the Chrome extension that lets the browser app open the real sites.
- `App.tsx`, `NativeFeed.tsx` and `native-platforms.mjs` are the Expo phone app.
- `oauth.mjs`, `token-vault.mjs` and `connected-feeds.mjs` are the optional YouTube and Twitch connections.
- `docs/` holds the longer guides. [CLAUDE.md](CLAUDE.md) is the map written for coding assistants and is kept accurate.

## Ground rules for changes

- **The hour is the product.** Changes to the service, the desktop app or the companion must keep the daily limit honest: time counts while a site is open, Pause stops it, and nothing a page does should let it run past the hour. Testing mode is for development only and must stay off by default in anything a user installs.
- **No personal details in the repository.** No names, emails, addresses, account names, local network addresses, machine paths or screenshots of real accounts. Test fixtures use made-up values. Screenshots for the docs come from the app in testing mode with no account signed in.
- **Private things stay private.** Platform sign-ins live in the app's own browser profile and are never read or exported. Provider tokens stay in the encrypted vault. `.env`, the `data/` folder, keystores, installers and build output are git-ignored; keep them that way.
- **Plain English in the UI and the docs.** Write for someone who has never seen the code. No emoji.
- **Line endings.** Most source and doc files use CRLF. Keep a file's existing endings, and do not run tools that rewrite whole files to LF.
- Add or update a test when the change has logic worth protecting. The service and the budget are written without Electron or Expo so they can be tested on their own.

## Pull requests

- One change per pull request, with a title that says what changed from the user's point of view.
- Say how you tested it: which app (Windows, browser, phone), which platform site, whether the hour was on.
- Screenshots for anything visible, with no account signed in.

## Reporting bugs

Open an issue with what you did, what you expected and what happened. For the Windows app, `startup.log` in the app's data folder (`%APPDATA%\daily-scroll-desktop`) often has the reason it did not start; remove anything personal before pasting it. Security problems go to [SECURITY.md](SECURITY.md) instead.
