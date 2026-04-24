# Mobile App

This is the dedicated Expo React Native app for the commercial MVP.

## Included flows

- onboarding and first-sync guidance
- tabbed inbox, capture queue, reports, and settings
- receipt review detail screen
- billing screen for trial and subscription messaging
- camera and library receipt capture with crop/compression settings
- backend upload, extraction, approval, and connected sync handoff from the capture screen
- offline capture queue states for queued, uploading, processing, review, approved, synced, and failed receipts

## Product focus

- mobile is the primary workflow for capture, queue visibility, and field review
- the app is designed for owner-operators who need dependable states more than decorative dashboards
- the dedicated web app handles longer-form review, exports, and integration setup

## Local run

1. Install dependencies in `receipt-tracker-starter/mobile`.
2. Run `npm run start`.
3. Open with an Expo client or simulator.

## iOS and Android path

This app is designed to ship to both iOS and Android through Expo + EAS.

- iOS bundle identifier: `com.ledgerlens.app`
- Android package: `com.ledgerlens.app`
- EAS build profiles are defined in [eas.json](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/mobile/eas.json)
- environment variables for production wiring are listed in [mobile/.env.example](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/mobile/.env.example)

## Before store submission

1. Install mobile dependencies and run the Expo app on a real iPhone and Android device.
2. Wire Supabase auth, RevenueCat, persistent offline queue storage, and production API credentials.
3. Add production app icons, splash assets, and store screenshots.
4. Create the Apple App Store and Google Play listings, privacy disclosures, and subscription metadata.
5. Build with EAS and validate sandbox purchases plus camera/upload flows on devices.
