# Web App

This is the dedicated Next.js companion web app for the commercial MVP.

## Included routes

- `/`: marketing and launch overview
- `/receipts`: desktop review lane for search, verification, and sync context
- `/reports`: monthly spend and launch-metric reporting
- `/pricing`: trial and subscription framing
- `/billing`: entitlement and customer messaging workspace
- `/settings`: account defaults and support paths
- `/settings/integrations`: QuickBooks, Microsoft, and workbook binding health

## Design direction

- premium but restrained layout with strong typography and minimal chrome
- operational first: the receipt workspace favors trust decisions over dashboard cards
- the current root preview remains a visual reference, while this app is the shipping companion surface

## Local run

1. Install dependencies in `receipt-tracker-starter/web`.
2. Copy `.env.local.example` to `.env.local` if you want the live capture lane pre-pointed at a backend URL.
3. Run `npm run dev`.
4. Open the app on the default Next.js port.

## Live capture lane

The `/receipts` route now includes a live capture panel that can:

- request a presigned upload target from the backend
- upload a real receipt image
- create a receipt record
- run the OCR/normalization path
- show the extracted merchant, total, category, and decision summary
- load the backend inbox and review details for real receipts
- approve receipts and trigger QuickBooks or Excel sync requests
- retry failed processing runs and refresh the inbox state

For the simplest local path, start the backend stack from the starter root and keep `NEXT_PUBLIC_RECEIPT_API_BASE_URL=http://localhost:8000/api/v1`.
