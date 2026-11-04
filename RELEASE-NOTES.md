# Daily Scroll 0.3.0 — Windows and Android preview

Daily Scroll brings YouTube, Instagram, TikTok, Facebook, Twitch, and Snapchat into one app. Choose a platform, browse its official website inside the app, and use **All apps** to return to the picker.

This is an experimental prerelease. Platform sign-in, physical-phone playback, and security work remain incomplete. Testing mode is enabled: the timer measures active browsing, and daily schedules and time limits are disabled.

## Downloads

- **Windows:** `Daily-Scroll-Setup-0.3.0.exe` — run the installer and open Daily Scroll. It starts its own internal service. The executable is unsigned and Windows may display an unrecognized-publisher warning.
- **Android:** `Daily-Scroll-Android-preview.apk` — open it on an Android phone and allow installation from the download source when prompted. The APK is signed with this project's preview key. It is not a Google Play release.
- **iPhone:** not available yet. Apple signing and TestFlight distribution require an Apple Developer Program account and setup in App Store Connect. No installable iPhone build or TestFlight link is included.

Checksum files accompany the Windows and Android downloads. These confirm file integrity, not publisher identity or comprehensive security review.

## Phone service setup

The Android app needs a separately running Daily Scroll service. From the source folder on your computer, run `npm ci`, then `npm run service`. Connect the phone to the same trusted Wi-Fi and enter `http://YOUR_COMPUTER_WIFI_ADDRESS:8787` in the app. Keep the computer awake. The Windows app's internal service is separate and does not provide this phone connection.

See [phone installation](docs/PHONE-INSTALLATION.md) for setup and the prepared iPhone build path. Do not expose the development service to the public internet.

## Features

- Six official websites inside the app's browsing view.
- Persistent Windows sidebar and navigation controls.
- Elapsed browsing timer and a visible return to the app picker.
- Local website sessions separate from Chrome.
- Site-controlled audio.
- Android layout fixes and support for local development-service connections.

## Known limitations

Some platforms reject embedded-browser sign-in. Earlier Windows walkthroughs observed YouTube Shorts, Instagram browsing, Twitch discovery, and Snapchat Spotlight; comprehensive signed-in acceptance testing remains incomplete. Phone installation, sign-in, and playback still need physical-device testing. This release does not block browsing in other apps. Rooms synchronize post selection, not playback position or play/pause.

An October 22 security review identified connected-account recovery after sign-out, insecure defaults for public service hosting, and dependency advisories. These have not been verified as resolved. This preview is for development evaluation and is not ready for general use or public service hosting.

Daily Scroll is independent and is not affiliated with the supported platforms. In bug reports, include the operating system, selected platform, and reproduction steps. Remove private account information from screenshots and logs.
