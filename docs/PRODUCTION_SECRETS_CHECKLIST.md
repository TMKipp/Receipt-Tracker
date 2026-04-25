# Production Secrets and Verification Checklist

Use this checklist to move from local/staging confidence to launch-grade production confidence.

## 1) Populate Production Environment Variables

Use [.env.production.example](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/.env.production.example) as the source of truth.

Critical launch keys:

- `APP_ENV`
- `APP_SECRET_KEY`
- `POSTGRES_DSN`
- `REDIS_URL`
- `DEV_AUTH_ENABLED`
- `APP_AUTO_CREATE_SCHEMA`
- `SYNC_RUN_INLINE`
- `STORAGE_PROVIDER`
- `S3_BUCKET`
- `QBO_CLIENT_ID`
- `QBO_CLIENT_SECRET`
- `QBO_REDIRECT_URI`
- `QBO_BASE_URL`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`
- `MS_REDIRECT_URI`
- `SUPABASE_URL`
- `SUPABASE_JWKS_URL`
- `SUPABASE_JWT_ISSUER`
- `REVENUECAT_WEBHOOK_AUTHORIZATION`
- `REVENUECAT_ENTITLEMENT_KEY`
- `OPENAI_API_KEY` (if `OPENAI_ENABLED=true`)
- `AWS_REGION` (if `TEXTRACT_ENABLED=true`)

## 2) Enforce Production Policy Check

Run:

```powershell
node .\scripts\launch-readiness-check.mjs --production --strict
```

This enforces:

- production mode and strong app secret
- dev auth disabled
- inline sync disabled
- schema auto-create disabled
- non-local Postgres and Redis
- S3 storage in use
- non-local CORS origins
- QuickBooks production base URL (not sandbox)

## 3) Configure GitHub Secrets for Automated Verification

Set repository or environment secrets matching these names:

- `APP_SECRET_KEY`
- `POSTGRES_DSN`
- `REDIS_URL`
- `BACKEND_CORS_ORIGINS`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `QBO_CLIENT_ID`
- `QBO_CLIENT_SECRET`
- `QBO_REDIRECT_URI`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`
- `MS_REDIRECT_URI`
- `SUPABASE_URL`
- `SUPABASE_JWKS_URL`
- `SUPABASE_JWT_ISSUER`
- `REVENUECAT_WEBHOOK_AUTHORIZATION`
- `REVENUECAT_ENTITLEMENT_KEY`
- `OPENAI_API_KEY`
- `AWS_REGION`
- `RECEIPT_TRACKER_BEARER_TOKEN` (for authenticated benchmark workflow runs)

Then manually run workflow:

- `.github/workflows/production-secrets-verify.yml`

## 4) Verify Integrations and Performance

Run provider benchmark with strict thresholds:

```powershell
node .\scripts\provider-sandbox-benchmark.mjs --files "C:\receipts\r1.jpg,C:\receipts\r2.jpg" --iterations 2 --strict
```

Bearer-auth benchmark:

```powershell
node .\scripts\provider-sandbox-benchmark.mjs --files "C:\receipts\r1.jpg,C:\receipts\r2.jpg" --iterations 2 --auth-token "<ACCESS_TOKEN>" --strict
```

Thresholds:

- QuickBooks success >= `0.98`
- Excel success >= `0.97`
- Median processing <= `8s`

## 5) Complete Mobile Device QA Matrix

Track and close all pending items in:

- [docs/DEVICE_QA_MATRIX.md](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/docs/DEVICE_QA_MATRIX.md)

Required for 10/10 launch gate:

- no critical blocker in offline queue, review, QuickBooks sync, Excel sync
- >=95% matrix pass rate
