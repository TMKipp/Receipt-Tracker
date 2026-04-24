# Product 10/10 Readiness Plan

This plan raises the app from a strong MVP toward a commercial-grade product that can survive paid users, provider failures, app-store review, and real field conditions. A 10/10 score means the category is not only implemented, but proven with tests, monitoring, support recovery, and beta evidence.

## Scorecard Targets

| Category | Current | 10/10 Definition | Proof Gate |
| --- | ---: | --- | --- |
| Product clarity | 8.0 | Every screen maps to capture, review, approve, sync, recover, or account setup with no dead-end flows. | First-time user completes signup to first synced receipt in under 5 minutes without docs. |
| UX/UI | 7.5 | The app always shows the next best action, trust reason, failure recovery, and safe approval gate. | 10-user usability test has 90% task completion and no critical confusion. |
| Mobile capture | 6.0 | Native camera, library import, crop/retake, offline queue, resume, retry, and reinstall recovery work on iOS and Android. | Device QA passes on 3 recent iPhones and 3 Android devices with airplane-mode scenarios. |
| OCR/intelligence | 5.5 | Receipts, screenshots, utility bills, faded paper, and PDFs normalize into clear final payloads with explainable confidence. | 100-document test set reaches at least 95% correct vendor/date/total and at least 90% correct category. |
| Review and auto-approval | 6.5 | Manual review is fast, auto-approval is conservative, and every automated action explains why it happened. | Auto-approve never fires outside policy in regression tests and beta corrections stay under 2%. |
| QuickBooks sync | 5.5 | Approved receipts create idempotent expenses with mapped accounts, vendors, attachments, retries, and re-auth recovery. | Sandbox and beta sync success is at least 98% with no duplicate expenses. |
| Excel sync | 6.5 | Users can connect existing workbooks, select or create tables, validate columns, append rows, retry, and export CSV fallback. | Existing-workbook setup succeeds in under 2 minutes and append success is at least 97%. |
| Backend reliability | 7.0 | API, workers, retries, stale job reconciliation, idempotency, and data versioning are production-ready. | Receipts finish processing after worker downtime with no duplicate sync jobs. |
| Security/privacy | 5.5 | Supabase JWTs, encrypted tokens, audit logs, retention controls, least-privilege scopes, and deletion/export flows are complete. | Internal security checklist passes with no critical token, auth, or data-retention gaps. |
| Billing/commercial | 5.0 | RevenueCat trial, paywall, restore purchase, renewal, cancellation, entitlement webhook, and grace-period states are robust. | iOS and Android sandbox subscriptions pass purchase, restore, renewal, cancellation, and expired-trial gates. |
| Testing/QA | 3.5 | Backend, web, mobile, provider sandbox, visual, and smoke tests block bad releases. | CI must pass web build, backend tests, mobile typecheck, and golden-loop smoke before merge. |
| Observability/support | 4.5 | Sentry, analytics, sync logs, provider errors, support diagnostics, and customer-safe messages make failures actionable. | Support can diagnose a failed sync from receipt ID and job ID without asking the user for screenshots. |
| App-store/GTM | 4.0 | Store assets, privacy labels, support URLs, onboarding emails, beta cohort, pricing, and launch analytics are ready. | TestFlight and Play Console internal testing pass with crash-free beta above 99%. |

## Execution Path to 10/10

### 1. Perfect the Golden Loop

The app must make the happy path and recovery path equally obvious.

- Add approval gates that show core fields, math reconciliation, duplicate status, and sync readiness before approval.
- Keep sample fixtures for retail receipts, utility bills, screenshots, PDFs, faded receipts, and multi-page bills.
- Add a golden-loop smoke test: upload, process, approve, sync request, sync job retrieval, CSV fallback.
- Add visual QA snapshots for the capture, review, sync failure, and offline states.

Exit gate: five document types can move through the loop with obvious next actions and no hidden sync behavior.

### 2. Make Real Device Capture Bulletproof

This is a mobile product first, so the device flow must lead the product.

- Finish camera crop/retake and library import polish.
- Persist queue records and local file copies across app restart, logout/login, and network loss.
- Add background retry when connectivity returns.
- Add camera permission copy, storage failure copy, and accessible labels for every capture action.

Exit gate: offline capture survives restart and syncs after reconnect on iOS and Android.

### 3. Expand Receipt Intelligence

The model needs a broader test bench than store receipts.

- Build a redacted receipt corpus covering retail, restaurants, utilities, fuel, invoices, screenshots, PDFs, poor lighting, and crumpled/faded receipts.
- Score vendor, date, total, tax, category, payment method, and line items separately.
- Add deterministic category fallback rules for common merchants and utility statements.
- Keep every output constrained to user categories and QuickBooks mapped accounts.

Exit gate: 100-document corpus reaches launch accuracy targets and failures route to review with helpful reasons.

### 4. Harden Sync as Accounting Infrastructure

QuickBooks and Excel are the commercial promise, so sync cannot feel magical or fragile.

- Add QuickBooks attachment upload where supported.
- Add existing Excel workbook search, table picker, column validation, and table creation fallback.
- Store idempotency keys, request payloads, response payloads, attempt counts, and safe error messages.
- Add token refresh, re-auth prompts, retry/backoff, and stale job reconciliation.

Current progress: Excel table search now exposes supported column metadata, flags missing recommended columns before binding, and blocks tables with zero supported receipt columns. QuickBooks sync now reuses the sync-job idempotency key as the Intuit request ID, attempts to attach the source receipt image to the created Purchase, and exposes support-safe request and attachment diagnostics. Mobile now runs on an Expo Doctor-clean Expo 55 / React Native 0.83 stack with a self-healing offline queue and TypeScript validation. The remaining 10/10 work is table creation fallback, provider sandbox proof, and beta reliability measurement.

Exit gate: beta sync reliability hits 98% QuickBooks and 97% Excel with no duplicate accounting records.

### 5. Finish Commercial Operations

Paid users need trust, support, and account controls.

- Complete RevenueCat entitlement enforcement across mobile, web, and backend.
- Add Sentry and analytics events for signup, first receipt, first approval, first QuickBooks sync, first Excel sync, paywall, conversion, and sync failure.
- Add support diagnostics with receipt ID, sync job ID, integration target, app version, and safe provider error.
- Add privacy, retention, export, delete-account, and app-store disclosure copy.

Exit gate: a beta user can subscribe, restore purchase, get help, and recover from sync failure without engineering intervention.

### 6. Release Machine

The product only becomes 10/10 when releases are boring.

- Add CI gates for web build, backend tests, mobile typecheck, lint, provider sandbox tests, and golden-loop smoke.
- Add release checklist for TestFlight, Play internal testing, provider credentials, RevenueCat products, and monitoring.
- Add staged beta cohort plan: 5 internal users, 20 owner-operators, then 100 public beta users.

Exit gate: public launch is blocked unless the release checklist and core metrics pass.

## Immediate Next Build Sprints

1. Golden-loop UX and approval gates.
2. Existing Excel workbook setup UX.
3. QuickBooks attachment and idempotency hardening.
4. Mobile offline retry automation.
5. OCR corpus and scoring harness.
6. RevenueCat restore and entitlement edge cases.
7. CI smoke tests, provider sandbox validation, and production audit review.
8. App-store beta package and support diagnostics.
