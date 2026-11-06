# Daily Scroll

**One hour of social media a day. Then it closes.**

Daily Scroll puts YouTube, Instagram, TikTok, Facebook, Twitch and Snapchat in one window with one shared hour a day. Pick a platform, browse its real website inside the app, signed in as yourself, and when the hour is used up the app closes the site and opens again tomorrow at the time you chose. **Pause** stops the clock. **All apps** takes you back to the picker.

It is not a blocker. Nothing stops you opening Instagram somewhere else. It is a place to do your scrolling where it is counted.

This repository holds the **installers**. Download the latest from the [Releases](../../releases/latest) page. The source code is at [jamesbobdev-gif/DailyScroll](https://github.com/jamesbobdev-gif/DailyScroll).

---

## Install

**Windows**
1. Download `Daily-Scroll-Setup-<version>.exe` from the [latest release](../../releases/latest).
2. Run it. Windows shows an "unrecognized app" warning because the installer is not code-signed yet: click **More info**, then **Run anyway**.
3. Daily Scroll opens with the hour on. Choose an app on the left; the countdown is at the top; **Pause** stops it; **All apps** goes back to the picker. **My hour** in the browser app, or the sidebar in the Windows app, sets when your hour starts.

**Android phone**: download `Daily-Scroll-Android-<version>.apk` on the phone and open it (the phone asks once to allow installs from your browser). The phone app needs the Daily Scroll service running on a computer on the same Wi-Fi; the source repository's [phone installation guide](https://github.com/jamesbobdev-gif/DailyScroll/blob/main/docs/PHONE-INSTALLATION.md) has the steps. Not every release has a phone build.

**Updates** happen on their own. An installed Windows copy checks here every few hours, downloads a new version quietly, and shows **Restart to update** in the sidebar; if you never press it, the update installs the next time you quit.

---

## Where your data lives

Everything stays on the computer. Your sign-ins to the platforms live in the app's own browser profile, separate from Chrome, and are never read or copied. The hour, your saved posts and your rooms are in one JSON file in the app's data folder (`%APPDATA%\daily-scroll-desktop`). There is no account and no telemetry. The source repository's [SECURITY.md](https://github.com/jamesbobdev-gif/DailyScroll/blob/main/SECURITY.md) has the details.

## What's in a release

| File | What it is |
|---|---|
| `Daily-Scroll-Setup-<version>.exe` | The Windows installer. |
| `Daily-Scroll-Android-<version>.apk` | The Android phone app, when there is one for this version. |
| `latest.yml` | What installed copies read to find out a new version exists. |
| `*.blockmap` | Lets an update download only the parts that changed. |
| `SHA256SUMS-windows.txt` | The SHA-256 of the installer. See below. |

## Verify your download

The installer is not code-signed yet (that needs a certificate; until there is one Windows warns about an unknown publisher), so the check is the checksum. Every release has a `SHA256SUMS-windows.txt` next to the installer, written by the machine that built it. Compare your download's SHA-256 with the line for it:

- **Windows** (PowerShell or Command Prompt): `certutil -hashfile Daily-Scroll-Setup-<version>.exe SHA256`
- **Android**: on a computer, the same command on the `.apk`, against the APK's checksum file when one is attached.

If the two differ, do not run the file: delete it, download again from this page, and open an issue if it still differs.

## If something does not work

- **The app does not start**: `startup.log` in `%APPDATA%\daily-scroll-desktop` usually names the cause. Open an issue in the source repository with the relevant lines, with anything personal removed.
- **A site refuses to sign in**: some platforms block sign-in inside an embedded browser. Browsing signed out works everywhere.
- **Anything else**: report it in the source repository's [Issues](https://github.com/jamesbobdev-gif/DailyScroll/issues), and security problems privately as its SECURITY.md says.

## Source code

The code lives at [jamesbobdev-gif/DailyScroll](https://github.com/jamesbobdev-gif/DailyScroll), under the MIT license.
