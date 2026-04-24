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

## Reporting

- `GET /reports/monthly-spend`

## Design Notes

- Receipt creation is split from file upload so mobile clients can upload directly to object storage.
- Approval is explicit because sync should operate on user-approved values, not raw OCR guesses.
- Sync is target-based so one receipt can sync to QuickBooks, Excel, both, or neither.
- Connect callbacks are modeled as POST handlers so mobile or web clients can exchange provider codes through the backend without exposing secrets client-side.
