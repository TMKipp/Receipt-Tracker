# API Endpoints

All endpoints are defined in [openapi.yaml](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/docs/openapi.yaml) and assumed to live under `/api/v1`.

## Health

- `GET /health`

## Auth

- `POST /auth/session/exchange`
- `GET /auth/me`

## Uploads

- `POST /uploads/receipts/presign`

## Receipts

- `POST /receipts`
- `GET /receipts`
- `GET /receipts/{receiptId}`
- `PATCH /receipts/{receiptId}`
- `POST /receipts/{receiptId}/upload-complete`
- `GET /receipts/{receiptId}/processing-status`
- `POST /receipts/{receiptId}/approve`
- `POST /receipts/{receiptId}/retry-processing`
- `POST /receipts/{receiptId}/sync`
- `GET /receipts/{receiptId}/sync-jobs`

`GET /receipts/{receiptId}/sync-jobs` includes support-safe diagnostics such as `provider_request_id`, `attachment_status`, and `attachment_error` so support can investigate QuickBooks expense posts and receipt-image attachment without exposing raw provider payloads.

## Categories and Vendors

- `GET /categories`
- `GET /vendors`

## Integrations

- `POST /integrations/quickbooks/connect-url`
- `POST /integrations/quickbooks/callback`
- `GET /integrations/quickbooks/status`
- `POST /integrations/microsoft/connect-url`
- `POST /integrations/microsoft/callback`
- `GET /integrations/microsoft/status`
- `GET /integrations/microsoft/workbooks`
- `GET /integrations/microsoft/workbook-tables`
- `GET /integrations/health`
- `POST /integrations/sync-jobs/run`
- `POST /integrations/worker/run`

QuickBooks sync uses the sync job idempotency key as the Intuit `requestid` and attempts to attach the first source receipt image to the created Purchase. Expense creation remains the primary accounting record; attachment outcome is recorded separately as `attached`, `skipped`, or `failed`.

`GET /integrations/microsoft/workbook-tables` returns each table with column compatibility metadata:

- `columns`: Graph-visible table headers.
- `supported_columns`: headers the receipt sync can populate.
- `missing_recommended_columns`: recommended groups still missing, such as Vendor, Date, Total, or Category.
- `sync_ready`: whether the table is a strong candidate for live append.

`PUT /billing/excel-workbook` now rejects tables with zero supported receipt columns so users do not pin a destination that later fails every Excel sync.

## Reporting

- `GET /reports/monthly-spend`

## Design Notes

- Receipt creation is split from file upload so mobile clients can upload directly to object storage.
- Approval is explicit because sync should operate on user-approved values, not raw OCR guesses.
- Sync is target-based so one receipt can sync to QuickBooks, Excel, both, or neither.
- Connect callbacks are modeled as POST handlers so mobile or web clients can exchange provider codes through the backend without exposing secrets client-side.
