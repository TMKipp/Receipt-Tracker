# Mobile Release Checklist

This checklist turns the Expo mobile app into a real iOS and Android release candidate.

## App configuration

- Confirm the identifiers in [mobile/app.json](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/mobile/app.json)
  - iOS bundle identifier: `com.ledgerlens.app`
  - Android package: `com.ledgerlens.app`
- Configure build profiles in [mobile/eas.json](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/mobile/eas.json)
- Fill mobile env values from [mobile/.env.example](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/mobile/.env.example)

## Product wiring

- Supabase sign-in works on real devices
- RevenueCat trial and restore purchases work on iOS and Android
- camera capture and photo-library upload work with permission prompts
- offline queue survives app restart and reconnect
- upload, OCR, review, approve, and sync work against the live backend

## Store readiness

- app icon, adaptive icon, splash screen, and screenshots are finalized
- privacy policy and data-use disclosures are ready
- subscription copy matches App Store and Play Store metadata
- support email and restore-access flow are visible inside the app

## Launch acceptance

- first receipt can be captured and synced from a real iPhone
- first receipt can be captured and synced from a real Android phone
- purchase sandbox passes on both platforms
- crash and error monitoring is enabled
- beta cohort can install internal builds and report feedback cleanly
