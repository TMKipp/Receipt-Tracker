# Provider Sandbox Runbook

Use this runbook to prove launch-grade sync reliability and processing performance with real QuickBooks + Excel sandbox connections.

## 1) Required Environment

Set these values in `.env` (or deployment secrets) before running the benchmark:

- `QBO_CLIENT_ID`
- `QBO_CLIENT_SECRET`
- `QBO_REDIRECT_URI`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`
- `MS_REDIRECT_URI`
- `REVENUECAT_WEBHOOK_AUTHORIZATION`
- `REVENUECAT_ENTITLEMENT_KEY`

Optional, but recommended for OCR realism:

- `TEXTRACT_ENABLED=true`
- `AWS_REGION`
- `OPENAI_ENABLED=true`
- `OPENAI_API_KEY`

## 2) Connect Integrations as a Demo User

1. Start backend + worker and web app.
2. Sign in (or run with demo headers in local mode).
3. Connect QuickBooks in sandbox mode.
4. Connect Microsoft and pin a workbook/table for Excel append.
5. Verify integration health:

```powershell
curl -H "X-Demo-User-Email: demo@example.com" -H "X-Demo-User-Name: Demo User" http://localhost:8000/api/v1/integrations/health
```

`sync_ready_targets` should include `quickbooks` and `excel`.

## 3) Run the Provider Benchmark

Use real receipt files when possible:

```powershell
node .\scripts\provider-sandbox-benchmark.mjs --files "C:\receipts\r1.jpg,C:\receipts\r2.jpg" --iterations 2 --strict
```

Quick local smoke with the fixture file:

```powershell
node .\scripts\provider-sandbox-benchmark.mjs --files ".\scripts\fixtures\provider-smoke-receipt.txt" --sync-targets quickbooks,excel --strict
```

## 4) Launch Thresholds (8/10 Gate)

- QuickBooks success rate >= `0.98`
- Excel success rate >= `0.97`
- Median processing time <= `8` seconds

Override thresholds if needed:

```powershell
node .\scripts\provider-sandbox-benchmark.mjs --files "C:\receipts\r1.jpg" --min-qb-success 0.95 --min-excel-success 0.95 --max-processing-median-seconds 10
```

## 5) Interpreting Output

The benchmark prints JSON with:

- `scorecard.processing` (`median_seconds`, `p95_seconds`)
- `scorecard.targets.quickbooks.success_rate`
- `scorecard.targets.excel.success_rate`
- Per-run `results` including `provider_request_id`, `attachment_status`, and sync errors
- `threshold_failures` (empty means pass)

## 6) CI / GitHub Actions

Use the manual workflow:

- Workflow: `Provider Sandbox Benchmark`
- Inputs:
  - `backend_url`
  - `demo_email`
  - `demo_name`
  - `sync_targets`
  - `strict`

This workflow uses the repo fixture by default and is best for deployed staging backends reachable from GitHub runners.
