# Architecture

## Core Services

- `mobile`: Expo app for capture, upload, review, search, and sync status
- `web`: optional Next.js dashboard for accountants or desktop-heavy users
- `backend`: FastAPI API, receipt-processing orchestration, provider integrations
- `postgres`: system of record for users, receipts, mappings, sync jobs, and audit trails
- `object-storage`: original receipt images and derived previews
- `redis`: background job queue and retry scheduling

## Receipt Lifecycle

1. Client asks for a presigned upload target.
2. Client uploads image directly to object storage.
3. Client creates a receipt record with the uploaded object key.
4. Backend enqueues OCR processing.
5. OCR provider returns raw fields and text.
6. LLM normalizer converts raw OCR into strict JSON and suggests a category from the user-approved category list.
7. Receipt lands in `review_required`.
8. User edits and approves.
9. Backend creates idempotent sync jobs for QuickBooks and, when enabled, Excel.

## Integration Design

### QuickBooks

- Store one connection per user per realm.
- Import vendors and expense accounts on connect.
- Create or update vendors before pushing expense data.
- Persist outbound payloads and response payloads in `sync_jobs`.
- Upload receipt files with the Attachable workflow after the transaction object exists.

### Microsoft Graph / Excel

- Treat workbook sync as a separate target from CSV export.
- Pin a workbook id, worksheet id, and table id in user settings.
- Append rows with the Graph workbook rows add endpoint.
- Run retries with backoff because Excel workbook APIs can return transient gateway errors.
- Keep Excel sync delegated-user only unless you intentionally re-architect around an owned service account.

## Security Model

- Encrypt OAuth tokens before database persistence.
- Use short-lived upload URLs for object storage.
- Keep role and ownership checks on every receipt query.
- Log every edit, approval, and sync attempt.
- Separate raw OCR, model output, and approved fields for later dispute or audit review.

## Suggested Phase Gates

- `Phase 1`: auth, capture, upload, receipt list, basic OCR
- `Phase 2`: normalized extraction, confidence scoring, review flow
- `Phase 3`: QuickBooks sync, vendor/account import, error queue
- `Phase 4`: CSV export, reports, dashboards, Excel sync

