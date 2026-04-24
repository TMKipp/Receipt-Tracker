# Security Audit Notes

This file captures package-audit status for launch planning. It is intentionally separate from marketing copy because audit findings need boring, explicit treatment before beta and public release.

## Current Status

- Web companion: `npm audit --omit=dev` reports `0` vulnerabilities after the `postcss` override in `web/package.json`.
- Mobile app: upgraded to Expo `55`, React Native `0.83.6`, and Expo Doctor-compatible module versions. `npx expo-doctor` passes all checks. `npm audit --omit=dev` still reports `9` moderate findings through Expo CLI/config/prebuild tooling and the `xcode -> uuid` transitive path.
- Backend: Python dependency audit could not be executed in this local environment because Python is not installed/available here.

## Mobile Audit Decision

Do not apply npm's suggested automatic fix for the remaining Expo findings. The suggested fix downgrades Expo to an old major version, which would be worse for app-store readiness and native compatibility.

Current mitigation:

- No high or critical npm advisories are present in the checked mobile tree.
- The remaining findings are in Expo configuration/prebuild tooling rather than receipt capture, OCR, QuickBooks sync, Excel sync, or entitlement logic.
- `uuid` is pulled by `xcode@3.0.1`; forcing `uuid@14` is unsafe because it changes module format and can break Expo prebuild tooling.

Launch requirement:

- Re-run mobile audit in CI and before TestFlight / Play internal testing.
- Track Expo upstream releases for patched `@expo/config`, `@expo/config-plugins`, and `xcode` dependency updates.
- Treat unresolved moderate build-tool advisories as a documented beta risk acceptance, not a silent pass.
