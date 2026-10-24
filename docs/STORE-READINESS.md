# Can Daily Scroll go on Google Play and the Apple App Store?

Assessment date: 24 October 2026. This is a read-only review of the phone app (`App.tsx`, `NativeFeed.tsx`, `native-platforms.mjs`, `app.json`) and the shared service (`server.mjs`) against the current store rules. No app code was changed.

## Verdict in one paragraph

**Not yet, on either store.** The phone app is a thin shell: a hidden WebView that talks to the Node service, plus a second WebView that loads the real mobile websites of YouTube, Instagram, TikTok, Facebook, Twitch and Snapchat with a timer on top. Both stores have rules aimed squarely at that shape ("repackaged website", "webview of a website without permission"), and the sign-in story inside those WebViews is broken by policy, not by a bug. On top of that, the service only runs on a laptop, there is no privacy policy, no account deletion, no icons, no EAS build setup, and the app has never been run on a real phone. None of this is fatal. The screen-time allowance is a real, defensible feature, and the plan below gets to a submitted build on each store in roughly six to ten weeks of focused work, with Google Play realistically first.

## How the phone app works today (what reviewers will see)

- The first screen asks for a "service address" and will only connect to a Daily Scroll service you run yourself. There is no hosted service.
- Once connected, the app shows the service's web page inside a WebView (the six-app picker, rooms, saved posts).
- Tapping a platform opens a second, full-screen WebView on that platform's mobile website. Daily Scroll adds a top bar: All apps, hostname, timer, Pause. Navigation is restricted to that platform's domain plus its login domains.
- The service tracks the daily hour. In the default testing mode the limit is switched off and only elapsed time is shown.
- Optional provider connections (YouTube, Twitch and others via OAuth) open in the system browser and create or sign into a Daily Scroll profile. The service keeps encrypted refresh tokens on disk.
- There is also a username and password sign-up route, and anonymous "guest" profiles are created automatically.
- Nothing has been verified on a physical iPhone or Android phone. Earlier notes say only the Expo Go development manifests loaded.

## Blockers, ranked by severity

Severity: **Critical** blocks submission or means near-certain rejection. **High** will be raised by review or is required paperwork. **Medium** needs work but has a clear path.

### 1. Critical: the app is a WebView wrapper around other companies' websites

- **Apple, Guideline 4.2 Minimum Functionality:** "Your app should include features, content, and UI that elevate it beyond a repackaged website. If your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store." Guideline 4.2.2 adds that apps "shouldn't primarily be ... web clippings, content aggregators, or a collection of links."
- **Google Play, Spam policy, "Webviews and Affiliate Spam":** "We don't allow apps whose primary purpose is to drive affiliate traffic to a website or provide a webview of a website without permission from the website owner or administrator."
- **Why it bites here:** the Daily Scroll UI itself is a web page in a WebView, and the thing people spend their hour in is a WebView of Instagram, TikTok and so on. You do not have permission from those companies. A reviewer who opens the app sees Instagram's site in a frame with a timer. That is the textbook rejection case for both rules.
- **What fixes it:** make Daily Scroll itself the app. Build the picker, timer, schedule, rooms and saved posts as native React Native screens rather than loading the service's web page. Then the platform WebView is one feature of a screen-time app, not the app. Describe it that way in the listing and the review notes (see Positioning below). Expect Apple to still ask; have the answer ready.

### 2. Critical: there is no hosted service, and the app refuses to work without one

- **Apple 4.2 and Google Play minimum and broken functionality:** an app that shows a "Connect to service" screen and cannot do anything out of the box will be rejected as non-functional. Reviewers will not run your Node service.
- **Today:** the service listens on localhost, stores everything in `data/store.json`, and the app only connects to an address you type in. `EXPO_PUBLIC_SERVICE_URL` exists but points at nothing.
- **What fixes it:** deploy the service to a small always-on host with HTTPS (a 5 to 12 USD per month VPS, Fly.io, Render or Railway all work; there is already a `Dockerfile`). Replace the JSON file with durable storage or at least a persistent volume with backups. Set `PUBLIC_ORIGIN`, `COOKIE_SECURE=1` and `TOKEN_ENCRYPTION_KEY`. Bake the HTTPS address into the build so the setup screen disappears. Run in limited mode (`service:limited`), not testing mode, for anything a reviewer touches.

### 3. Critical: signing into the platforms inside the WebView is blocked by the platforms

- **Google:** since 2021 Google's OAuth and account sign-in refuse embedded WebViews with the `disallowed_useragent` error (Google's announcement is linked under Sources). The app already shows a note on the YouTube tab that Google sign-in is unavailable. The desktop app worked around this by presenting itself as Chrome; doing that in a phone store build is user-agent spoofing that Google can detect and that reviewers can read as circumvention.
- **Meta, TikTok, Snap:** their mobile sites push hard towards "Open in app", rate-limit or captcha embedded browsers, and may refuse login. This has not been tested on a phone at all.
- **Apple 5.2.3:** "Streaming of audio/video content may also violate Terms of Use, so be sure to check before your app accesses those services. Authorization must be provided upon request." YouTube's Terms allow access "as made available to you" and through the embeddable player; displaying the service any other way needs "prior written permission from YouTube". Apple can ask you to prove you have permission, and you cannot.
- **What fixes it:** stop promising signed-in feeds inside the WebView. Position the WebView as "browse the public mobile site with a timer", open any login link in the system browser (`expo-web-browser`), and lean on the official-API connections (YouTube subscriptions, Twitch follows) for personalised content. Be ready to drop TikTok or Snapchat from the first release if they will not load for a reviewer.

### 4. High: no privacy policy, no App Privacy answers, no Data safety form

- **Apple 5.1.1(i):** "All apps must include a link to their privacy policy in the App Store Connect metadata field and within the app in an easily accessible manner." It must say what is collected, how it is used, and how to request deletion. The Privacy Policy URL is a required field in App Store Connect, and the App Privacy "nutrition label" questionnaire must be completed.
- **Google Play Data safety:** every published app, including closed testing, must complete the Data safety form and "provide a link to their privacy policy", even if it collects nothing.
- **What you actually collect** (write this down honestly): a random device identifier and session cookie, time zone, chosen hour, minutes used per day, saved post links, room membership, optional username and salted password, optional provider identity and encrypted refresh tokens, and the platform cookies the WebView keeps on the device. No analytics or ads SDKs today.
- **What fixes it:** a one-page policy hosted at the service's HTTPS address, a Privacy link in the app, and matching answers in both consoles.

### 5. High: accounts exist but cannot be deleted

- **Apple 5.1.1(v):** "If your app supports account creation, you must also offer account deletion within the app." Apple's FAQ says this also covers automatically created "guest" accounts.
- **Google Play User Data policy:** apps that let users create an account must offer in-app deletion and a web link to request deletion, and declare both in Data safety.
- **Today:** `/api/register` creates username accounts, `/api/guest` creates anonymous profiles, and OAuth creates provider-linked profiles. There is `/api/logout` but no delete route. Deletion must also wipe the token vault entry for that user.

### 6. High: social login creates the primary account, which triggers Sign in with Apple

- **Apple 4.8 Login Services:** apps using "a third-party or social login service (such as Facebook Login, Google Sign-In ...) to set up or authenticate the user's primary account with the app must also offer as an equivalent option another login service" that limits data to name and email and lets users hide their email. In practice that means Sign in with Apple.
- **Today:** connecting YouTube, Twitch, Facebook, Instagram, TikTok or Snapchat through OAuth creates or signs into the Daily Scroll profile (the identities map in `server.mjs`). That is "setting up the primary account".
- **Apple 5.1.1(v) also says:** "An app may not store credentials or tokens to social networks off of the device and may only use such credentials or tokens to directly connect to the social network from the app itself while the app is in use." The service stores encrypted refresh tokens on the server so it can refresh feeds. Apple can read that as a violation.
- **What fixes it (cheapest):** keep the anonymous device profile as the primary account, treat provider connections purely as "connect a feed", never as sign-in, and either move token use on-device or be prepared to argue the server-side refresh. If you keep provider sign-in as a way to log in, add Sign in with Apple.

### 7. High: nothing has been run on a real phone

- Expected problems a reviewer will hit before you do: autoplay and inline video behaviour, the WebView losing the page when the app is backgrounded, Android Back, the hidden service WebView being killed under memory pressure, cookie persistence across launches, and the five-second lease pulse failing on flaky mobile data (which pauses browsing with "Connection lost").
- Both stores reject apps that crash or show blank screens on first launch. Apple reviews on current iPhones and iPads (`supportsTablet` is true, so iPad layout is in scope).

### 8. Medium: no build pipeline, signing or store assets

- No `eas.json`, no `assets/` folder, no icon, splash screen, adaptive icon, or screenshots. `app.json` has bundle identifiers but nothing else.
- Apple needs an Apple Developer Program membership, a distribution certificate and provisioning profile, and a build uploaded from macOS or a cloud Mac. Expo's EAS Build runs iOS builds on Expo's Macs, so you do not need to own one; EAS can also create and manage the Apple certificates when you sign in to your Apple account.
- Google Play requires new apps to target Android 16 (API level 36) from 31 August 2026. Confirm the installed Expo SDK's default `targetSdkVersion` is 36 before the first build; if not, set it with `expo-build-properties`.
- Store listing needs: short and full descriptions, 1024x1024 icon, feature graphic (Play), phone and tablet screenshots, content rating questionnaire (Play), age rating (Apple), category, support URL and contact email.

### 9. Medium: Google Play's closed-testing gate for new personal accounts

- New personal developer accounts must run a closed test with "a minimum of 12 testers who have been opted in continuously for at least 14 days" before they can apply for production access, and Google then reviews the application, typically within a week. Plan at least three weeks between the first Android build and public availability.
- New personal accounts also verify identity (government ID and card in your legal name) and confirm an Android device via the Play Console app. Google's broader Android developer verification is rolling out to Play and sideloaded apps through 2026 and 2027; registering through Play Console covers it.

### 10. Medium: product claims that cannot be kept

- README and history notes are honest that the app cannot reproduce personal For You, Home or Spotlight feeds, and that Instagram's API connection is for professional accounts only. The store listing must not imply "your Instagram inside Daily Scroll". Google Play's metadata policy prohibits misleading descriptions; Apple 2.3 requires accurate metadata.
- Using other companies' names and logos in your icon or screenshots invites Apple 5.2.1 (third-party trademarks) complaints. Name the platforms in text; do not use their logos as your branding.

## Plan from today to a submitted build

Order matters: paperwork and hosting unblock everything else, and the app rework is the long pole.

### Week 1: accounts, hosting, paperwork

1. Enrol in the Apple Developer Program as an individual (Apple Account with two-factor on, legal name, 99 USD per year). Approval can take a few days.
2. Register a Google Play developer account (25 USD one-time, government ID, Android device confirmation). Install the Play Console app on a phone.
3. Deploy the service with HTTPS using the existing `Dockerfile` on a small host. Set `PUBLIC_ORIGIN`, `COOKIE_SECURE=1`, `TOKEN_ENCRYPTION_KEY`, run without `--testing`, and put `data/` on a persistent volume with a nightly backup.
4. Write and host the privacy policy and a short terms page at that origin. Add a support email.
5. Decide the first-release platform list. Recommended: keep all six as public browsing with a timer, then drop any that will not load for a signed-out reviewer after the phone test in week 2.

### Weeks 2 to 3: make it work on real phones

6. Create `eas.json` (`eas build:configure`), add `assets/` with icon, adaptive icon and splash, and set `EXPO_PUBLIC_SERVICE_URL` to the hosted origin so the setup screen never appears in store builds.
7. Build a development build for one Android phone and one iPhone (the EAS free tier covers 30 builds a month). Test every platform signed out: load, scroll, play video, pause, All apps, Back, background and return, airplane mode, hour expiry in limited mode.
8. Test provider connections through the system browser on both phones with the `dailyscroll://oauth` scheme. Record what works; update the README to match.

### Weeks 3 to 6: policy fixes in the app and service

9. Add account deletion: a Delete my data button in the app, a service route that removes the user, device, sessions, identities and vault entries, and a web page at the same origin for the Play "web link" requirement.
10. Separate "connect a feed" from "sign in". Keep the anonymous device profile as the account. Either stop keeping provider tokens server-side or document the justification, and add Sign in with Apple if any social login still creates the account.
11. Rebuild the shell screens natively: picker, timer and schedule, rooms, saved posts, settings with Privacy and Delete links. Keep the service as the API. This is the work that moves the app from "repackaged website" to "screen-time app with a managed browser".
12. Make the managed browser defensible: no user-agent spoofing, login links open in the system browser, a visible "You are browsing youtube.com" label, and an Exit control at all times (already present).
13. Fill in the App Privacy answers in App Store Connect and the Data safety form in Play Console to match the policy.

### Weeks 6 to 8: Google Play first

14. Upload an internal build, then a closed test with at least 12 testers for 14 days (friends, a Reddit or Discord call for testers, or a paid testing service). Collect crash reports.
15. Complete content rating, target audience (13+ or 18+, not children), ads declaration (none), and the store listing.
16. Apply for production access, then publish.

### Weeks 7 to 10: Apple

17. Upload a TestFlight build through EAS Submit and test on at least one iPhone and one iPad, or set `supportsTablet` to false.
18. Fill App Store Connect: privacy policy URL, App Privacy, age rating, screenshots per device size, review notes.
19. In the review notes, explain in two sentences what the app is (a daily screen-time allowance with a managed in-app browser), that no third-party content is downloaded or re-hosted, that login opens in Safari, and that the app works with no account. Offer a demo video. If rejected under 4.2 or 5.2.3, request an App Review consultation rather than resubmitting unchanged.

## Costs

| Item | Cost |
| --- | --- |
| Apple Developer Program | 99 USD per year |
| Google Play developer account | 25 USD one-time |
| Hosting for the service with HTTPS | roughly 5 to 12 USD per month for a small VPS or PaaS; persistent storage and backups a few dollars more |
| Domain name | roughly 10 to 15 USD per year |
| Expo EAS Build | free tier (30 builds per month, store submission included); Starter plan 19 USD per month if builds run out |
| Paid closed-test testers (optional) | 20 to 60 USD if you cannot find 12 volunteers |
| Mac | not required; EAS builds iOS in the cloud |

Rough first-year total without paid testers: about 200 to 300 USD.

## Positioning recommendation

Lead with the allowance, not the platforms. The honest and policy-safe pitch is: **"One hour a day of social media. Daily Scroll gives you a daily allowance, a fixed hour, and a managed browser that closes when time is up. Scroll with friends in a room, save what you want to come back to."**

- Name the platforms in a feature bullet ("Works with the mobile sites of YouTube, Instagram, TikTok, Facebook, Twitch and Snapchat"), never in the title, subtitle, icon or keywords.
- Do not say "your Instagram feed inside Daily Scroll" or show screenshots of other companies' content filling the screen. Show the picker, the timer, the pause screen and the room.
- Say plainly in the description that sign-in happens on the platform's own site and that some platforms may ask you to use their app. Under-promising here is what gets a 4.2 or 5.2.3 rejection overturned.
- Category: Lifestyle or Productivity, not Social Networking.

## What this assessment did not do

No code was changed and no build was attempted. Policy quotations were taken from Apple's App Store Review Guidelines, Google Play's Spam, Data safety, account deletion and target API pages, Google's developer verification page, Apple's enrolment page and Expo's EAS documentation as published on 24 October 2026. Store policies change several times a year; re-read 4.2, 4.8, 5.1.1 and the Play Spam policy before each submission.

## Sources

- Apple App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple, Offering account deletion in your app: https://developer.apple.com/support/offering-account-deletion-in-your-app
- Apple, Manage app privacy (Privacy Policy URL required): https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Apple Developer Program enrolment and fee: https://developer.apple.com/programs/enroll/
- Google Play Spam policy, Webviews and Affiliate Spam: https://support.google.com/googleplay/android-developer/answer/9899034
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play closed-testing requirement for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play registration fee and verification: https://support.google.com/googleplay/android-developer/answer/6112435
- Google Play target API level: https://developer.android.com/google/play/requirements/target-sdk
- Android developer verification: https://developer.android.com/developer-verification
- Google OAuth in embedded WebViews: https://developers.googleblog.com/en/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/
- YouTube Terms of Service: https://www.youtube.com/static?template=terms
- Expo EAS Build setup and pricing: https://docs.expo.dev/build/setup/ and https://expo.dev/pricing
