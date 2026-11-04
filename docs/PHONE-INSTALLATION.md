# Phone installation

## Android preview

Download `Daily-Scroll-Android-preview.apk` from the GitHub release on your Android phone. Open it and allow installation from your browser when Android asks. This is a signed preview APK, not a Google Play release. Physical-phone sign-in and playback have not been verified.

The phone app needs the shared Daily Scroll service. On your computer, install the source dependencies and run `npm run service`. Keep the computer awake and connect the phone to the same trusted Wi-Fi. In the phone app enter `http://YOUR_COMPUTER_WIFI_ADDRESS:8787`. `localhost` on a phone refers to that phone, not the computer. The Windows app's internal service is separate and is not a phone backend.

The phone build permits plain HTTP for local development. Do not expose this development service to the internet. A hosted service needs HTTPS and the outstanding security fixes before public use.

## iPhone

An iPhone build is not available yet. The project includes Expo build profiles in `eas.json` so an owner can set up Apple signing and build it.

For TestFlight distribution, use an Apple Developer Program account, an App Store Connect app record for `app.thedailyscroll.mobile`, and an Expo account with access to the project. From an authenticated Expo CLI session:

```sh
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

Complete the signing and App Store Connect prompts yourself. Never put Apple passwords, signing certificates, or provisioning profiles in the source repository. After Apple processes the upload, configure testers and any required beta review in TestFlight, then share its invitation link. There is no TestFlight invitation yet.

For a small set of registered iPhones, Expo's `preview` profile uses internal distribution and needs registered device IDs and a matching Apple provisioning profile. A simulator build is not installable on an iPhone.

Apple distribution: https://developer.apple.com/testflight/

Expo internal distribution: https://docs.expo.dev/build/internal-distribution/
