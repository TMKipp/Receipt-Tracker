# Product Scorecard and 8/10 Readiness Plan

This scorecard tracks the receipt tracker against the categories that matter for a paid mobile-first accounting utility. Scores are intentionally launch-readiness scores, not effort scores.

## Current Position

| Category | Current | Target | What an 8/10 Means |
| --- | ---: | ---: | --- |
| Product clarity | 8.0 | 8.5 | The product is narrowly positioned for U.S. owner-operators and every screen supports capture, approve, sync, or recover. |
| UX/UI | 7.0 | 8.5 | A new user can complete the first receipt without documentation, and every next action is obvious. |
| Mobile readiness | 5.0 | 8.0 | Camera, library upload, offline queue, review, billing, and sync health work on real iOS and Android devices. |
| Receipt OCR/intelligence | 5.5 | 8.0 | Real receipts consistently extract vendor, date, total, tax, category, and line items with explainable confidence. |
| QuickBooks sync | 5.5 | 8.0 | Approved receipts create idempotent QuickBooks expenses with useful errors, retries, and attachment support. |
| Excel integration | 6.5 | 8.0 | Users can select an existing workbook/table, validate columns, append rows, and recover from workbook failures. |
| Backend architecture | 7.0 | 8.5 | The API is stable, async-ready, observable, and safe as the system of record. |
| Security/privacy | 5.5 | 8.0 | Supabase JWTs, encrypted provider tokens, retention controls, audit logs, and production secrets are hardened. |
| Reliability/recovery | 4.5 | 8.0 | OCR and sync jobs retry safely, stale jobs reconcile, and user-facing recovery messages are specific. |
| Testing/QA | 3.5 | 8.0 | Unit, integration, E2E, provider sandbox, and device QA cover the critical paid-user paths. |
| Billing/commercial | 5.0 | 8.0 | RevenueCat entitlements gate access correctly across install, trial, renewal, cancellation, and restore. |
| Observability/support | 4.5 | 8.0 | Sentry, analytics, sync logs, support diagnostics, and health dashboards make failures actionable. |
| App-store readiness | 4.0 | 8.0 | iOS and Android builds pass sandbox purchase, privacy, camera, upload, and crash-free beta checks. |

## Build Plan to Reach 8/10

### 1. Prove the Golden Receipt Loop

Goal: one real receipt can move from phone photo to OCR, review, approval, QuickBooks, and an existing Excel workbook.

- Wire the Expo camera and image-picker flows to the backend presign/create/upload-complete endpoints.
- Persist offline queue records on device with `queued offline`, `uploading`, `processing`, `review required`, `approved`, `synced`, and `failed` states.
- Keep the web capture screen as the companion validation lane for upload, extraction, approve-and-sync, and sync job proof.
- Add a smoke script that runs upload, processing polling, approval, sync request, and sync job retrieval.
- Current progress: mobile capture uses Expo camera/library selection, copies receipt images into app storage, persists queue records, and can call backend upload, extraction, approve, and connected sync endpoints. Offline queue retry runs on app resume, on interval, and manual retry.

Exit criteria: five real receipts complete the loop in a local or staging environment with visible receipt and sync states.

### 2. Make Integrations Production-Reliable

Goal: QuickBooks and Excel are boring in the best way.

- Finish QuickBooks attachment upload for receipt images where supported.
- Store provider request/response payloads with idempotency keys and support-safe error messages.
- Add token refresh workers and re-auth prompts for expired Microsoft and Intuit connections.
- Improve Excel setup with workbook search, table selection, column validation, and a fallback CSV export path.

Exit criteria: beta QuickBooks sync success is at least 98%, Excel append success is at least 97%, and every failure has a retry or re-auth path.

### 3. Workerize Processing and Sync

Goal: no long-running commercial work depends on one foreground request.

- Move OCR, normalization, sync, retry, and stale-job reconciliation into a real worker queue.
- Add exponential backoff, max attempts, dead-letter reporting, and scheduled reconciliation.
- Keep development inline execution as an opt-in local setting only.
- Current progress: the backend now has a worker entry point and local Docker service that process uploaded receipts and due sync jobs in one-shot or continuous mode. Production hosting still needs a durable queue/dead-letter layer before this category reaches 8/10.

Exit criteria: receipts can be uploaded while workers are temporarily offline and later complete without duplicate posts.

### 4. Harden Trust, Security, and Compliance

Goal: customer financial data is handled like customer financial data.

- Enforce Supabase JWT verification across mobile, web, and backend.
- Encrypt OAuth tokens and sensitive integration fields with production key rotation.
- Add audit events for edits, approvals, sync requests, token refreshes, and failed provider calls.
- Add retention settings, privacy copy, and export/delete account workflows.

Exit criteria: paid access, account isolation, provider tokens, and audit logs pass internal security review.

### 5. Build the Test and Release Machine

Goal: every release proves the important paths before users do.

- Add backend unit tests for normalization, duplicate detection, auto-approval, idempotency, sync invalidation, and token refresh.
- Add provider integration tests with QuickBooks and Microsoft sandbox credentials.
- Add mobile E2E/device QA for capture, offline queue, reconnect, review, paywall, restore purchase, and app reinstall.
- Add web E2E coverage for receipt search, export, integrations, billing, and failure recovery.
- Add CI for backend tests, web build, mobile type checks, linting, and smoke script execution.
- Current progress: backend service tests were added for receipt sync-state/idempotency logic, auto-approval policy evaluation, and billing auth/status helpers. CI quality gates now run web build, mobile type/dependency checks, backend pytest, and readiness checks on every push and pull request.

Exit criteria: the release checklist can block a build before beta users see broken core flows.

### 6. Launch Instrumentation and Support

Goal: the team can see where users get stuck and help them quickly.

- Track signup, first receipt, first approval, first QuickBooks sync, first Excel sync, trial conversion, failed sync, and churn-risk events.
- Add Sentry or equivalent crash/error monitoring across backend, web, and mobile.
- Add support ticket capture with receipt ID, sync job ID, provider target, and safe error context.
- Create onboarding emails, support macros, privacy disclosures, and app-store launch assets.

Exit criteria: beta feedback can be connected to product events, logs, and specific recovery instructions.

## Suggested Execution Order

1. Golden receipt loop and smoke validation.
2. Mobile camera/offline queue.
3. Provider sandbox reliability.
4. Worker queue and retry hardening.
5. Security, billing, and entitlement gates.
6. Test automation, observability, and beta release.
