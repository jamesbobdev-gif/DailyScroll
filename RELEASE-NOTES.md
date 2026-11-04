# Daily Scroll 0.3.0 — experimental source preview

Daily Scroll brings six social platforms into one Windows app: YouTube, Instagram, TikTok, Facebook, Twitch, and Snapchat. Choose a platform, browse its official website inside the app, and return to the picker with **All apps**.

This is an experimental source-only prerelease. No Windows installer is attached. It is intended for developers evaluating the project; it is not ready for general use.

## What is included

- Official websites open inside the Daily Scroll window.
- A persistent sidebar provides platform selection and navigation.
- An elapsed timer tracks active browsing across platform switches and restarts.
- All apps closes the current platform and returns to the picker.
- Social sign-ins use a local browser profile separate from Chrome.
- Audio is controlled by each website's player.

Testing mode is enabled in this preview. Daily schedules and time limits are disabled.

## Windows installation

Once a release is published, download **Daily-Scroll-Setup-0.3.0.exe** from its Assets section, run the installer, and open Daily Scroll. Choose a platform and sign in on its official page if needed. The app starts its own local service; no separate browser extension is required.

The installer is unsigned. Windows may display an unrecognized-publisher warning. Verify the publisher and release source before deciding whether to install it.

## Current limitations

- Some platforms or account providers may reject embedded-browser sign-in. Compatibility with all six platforms and all account types is not established.
- Earlier Windows walkthroughs observed YouTube Shorts, Instagram browsing, Twitch discovery, and Snapchat Spotlight. Comprehensive signed-in acceptance testing remains incomplete.
- Android and iPhone code is available for development, but physical-device testing is incomplete and no app-store release is available.
- This app does not block social browsing in other apps or browsers.
- Room features synchronize post selection, not playback position or play/pause.
- Daily Scroll is an independent project and is not affiliated with the supported platforms.

## Before publication

The October 22 security review identified issues that have not been verified as resolved in this checkout: connected-account recovery after sign-out, insecure defaults for public service hosting, and dependency advisories. These must be addressed and retested before this preview is presented as ready for general use. The development service should not be exposed publicly.

The existing installer also needs a fresh build from the intended release commit, validation, and a published checksum before distribution. Do not attach an older installer while describing newer source changes.

## Feedback

When reporting a problem, include your Windows version, selected platform, steps to reproduce it, and expected behavior. Remove account names, private messages, cookies, tokens, and other personal information from screenshots or logs.
