# Commercial MVP Snapshot

This workspace now reflects the commercial MVP plan in code form:

- `backend/`
  FastAPI system of record with commercial auth, billing, processing, support, and sync primitives.
- `mobile/`
  Expo React Native app focused on onboarding, capture queue, inbox, reports, and billing.
- `web/`
  Next.js companion web app focused on review, integrations, reports, pricing, and billing.

## Implemented backend capabilities

- Supabase JWT verification hooks with development fallback
- RevenueCat entitlement ingestion
- Excel workbook binding
- receipt upload completion and processing-status polling
- duplicate-aware OCR normalization with Textract and OpenAI provider hooks plus deterministic fallback
- sync job detail retrieval and stale-sync invalidation after edits
- QuickBooks OAuth token exchange, account import, and expense sync
- Microsoft OAuth token exchange, workbook validation, and Excel row append sync

## Product surfaces implemented

- owner-operator launch landing page
- desktop receipt review lane
- monthly reports view
- billing and integration settings surfaces
- mobile onboarding
- mobile inbox, capture queue, reports, settings, billing, and receipt detail screens

## Still required before public launch

1. Background workers and retry infrastructure beyond inline development execution
2. Mobile camera/image upload wiring against the live backend
3. QuickBooks receipt attachment upload support and richer Excel setup UX
4. Analytics, crash monitoring, and CI
5. End-to-end validation on real devices and subscription sandboxes
