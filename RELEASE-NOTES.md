# Daily Scroll 1.0.0

Daily Scroll puts YouTube, Instagram, TikTok, Facebook, Twitch and Snapchat in one app with one hour a day to spend on them. Pick a platform, browse its official website inside the app, and use **All apps** to go back to the picker. When your hour is used up, it opens again tomorrow.

This is the first official release. Earlier 0.3.0 builds were previews.

## Downloads

- **Windows:** `Daily-Scroll-Setup-1.0.0.exe`. Run the installer and open Daily Scroll. It runs its own service, so it needs no setup. The installer is unsigned, so Windows may warn about an unrecognized publisher. Choose **More info → Run anyway**.
- **Android:** `Daily-Scroll-Android-1.0.0.apk`. Open it on an Android phone and allow installs from that source when asked. The APK is signed with this project's own key. It is not on Google Play.
- **iPhone:** not available yet. It needs an Apple Developer Program account and TestFlight setup.

Each download comes with a SHA-256 checksum file. It confirms the file arrived intact. It does not prove who published it.

## What's in 1.0.0

- One hour a day across all six platforms, with a countdown, **Pause** to stop the clock, and a clear "done for today" screen. The Windows app has the daily limit on.
- A sidebar with back, forward and **All apps**, which stays put on Windows.
- Website sign-ins that stay inside Daily Scroll, separate from Chrome.
- Saved posts and rooms you share with friends.
- Optional YouTube and Twitch connections for your own subscriptions and follows.
- Security fixes from the October 22 review:
  - Signing out of a guest account now unlinks its connected accounts from the device.
  - Sign-in cookies are marked Secure when the service runs over HTTPS.
  - All high-severity dependency advisories are fixed.

## Phone service setup

The Android app connects to a Daily Scroll service you run on a computer. In the source folder, run `npm ci`, then `npm run service:limited` to get the one-hour limit. `npm run service` turns the limit off for testing. Put the phone on the same trusted Wi-Fi and enter `http://YOUR_COMPUTER_WIFI_ADDRESS:8787` in the app. Keep the computer awake. The Windows app's own service doesn't serve phones.

[Phone installation](docs/PHONE-INSTALLATION.md) has the full steps. Don't expose this service to the public internet. [Hosting](docs/HOSTING.md) describes the HTTPS setup to use instead.

## Known limitations

- Some platforms block sign-in inside an embedded browser. Google sign-in in particular doesn't work in the YouTube view. Browsing while signed out works.
- Phone sign-in and playback have had only limited testing on physical devices.
- Daily Scroll doesn't block the platforms' own apps or other browsers.
- Rooms share which post is open. They don't sync playback position or play/pause.
- Five moderate dependency advisories remain. They are in the build tools (Expo, electron-builder), not in the app.

Daily Scroll is independent and isn't affiliated with any of the platforms it supports. When you report a bug, include your operating system, the platform and the steps to reproduce it. Remove private account details from screenshots and logs.
