# Backend

This is a FastAPI-oriented starter backend for the receipt tracker.

## What is included

- FastAPI app entry point
- route modules for auth, billing, uploads, receipts, integrations, reports, and support
- Supabase JWT verification hooks plus local development auth fallback
- RevenueCat entitlement webhook handling and workbook binding endpoints
- receipt processing-status, sync-job visibility, inline sync execution, and summary endpoints
- SQLAlchemy 2.0 model set for the production schema
- raw Postgres DDL in `app/db/schema.sql`
- provider-backed services for Textract, OpenAI normalization, QuickBooks OAuth + expense sync, Microsoft Graph OAuth + Excel row append, and local/S3 upload storage

## Local run notes

1. Create a Postgres database named `receipt_tracker`.
2. Copy `.env.example` from the starter root into the backend working directory or export equivalent environment variables.
3. Install the package dependencies from `pyproject.toml`.
4. Run the app with `uvicorn app.main:app --reload`.

The backend will auto-create tables on startup when `APP_AUTO_CREATE_SCHEMA=true`.

## Local development shortcuts

- Every request can use `X-Demo-User-Email` and `X-Demo-User-Name` headers to switch the active local user when `DEV_AUTH_ENABLED=true`.
- `POST /api/v1/uploads/receipts/presign` uses local mock uploads by default and switches to S3 presigned uploads when `STORAGE_PROVIDER=s3`.
- `POST /api/v1/receipts/{receipt_id}/upload-complete` reads the uploaded file, runs Textract when enabled, then uses OpenAI structured normalization when enabled, and falls back to deterministic heuristics in local mode.
- `POST /api/v1/integrations/quickbooks/connect-url` and `POST /api/v1/integrations/microsoft/connect-url` now persist OAuth state and return real provider authorization URLs.
- `POST /api/v1/integrations/quickbooks/callback` exchanges an auth code for real Intuit tokens, imports QuickBooks expense accounts into categories, and prepares expense sync.
- `POST /api/v1/integrations/microsoft/callback` exchanges a Microsoft auth code for real Graph tokens.
- `POST /api/v1/receipts/{receipt_id}/sync` executes sync inline by default when `SYNC_RUN_INLINE=true`, so approved receipts can push straight to QuickBooks and Excel without a separate worker during development.
- `python -m app.worker --once` processes uploaded receipts and due sync jobs once; omit `--once` to run the worker loop continuously.
- `POST /api/v1/integrations/worker/run` runs a user-scoped worker cycle for local recovery and support workflows.

## Credential-dependent paths

- Browser-based S3 uploads also require bucket CORS that allows `PUT` from your web/mobile origins.
- Textract requires `TEXTRACT_ENABLED=true` plus working AWS credentials and `AWS_REGION`.
- OpenAI normalization requires `OPENAI_ENABLED=true` and `OPENAI_API_KEY`.
- QuickBooks requires `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, and a redirect URI registered with Intuit.
- Excel sync requires `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, a valid Microsoft redirect URI, and a bound workbook/table.

## Remaining hardening work

1. Wire the worker process into production hosting with `SYNC_RUN_INLINE=false` for long-running environments.
2. Add support for QuickBooks receipt attachment upload and Excel table-template creation/validation UX.
3. Add tests for duplicate detection, auto-approval eligibility, OAuth state validation, billing webhooks, and sync invalidation after edits.
4. Add observability around OCR failures, token refresh failures, and sync retry exhaustion.
