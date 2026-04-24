# Receipt Tracker Starter

This starter pack is now a commercial-MVP workspace for the receipt-tracking product:

- a FastAPI backend with commercial auth, billing, provider-backed processing, and provider-backed sync paths
- a production-oriented Postgres schema plus SQLAlchemy models in [backend/app/db/schema.sql](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/backend/app/db/schema.sql)
- a dedicated Expo mobile app and a dedicated Next.js companion web app
- the original API contract and architecture docs under [docs/openapi.yaml](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/docs/openapi.yaml) and [docs/ARCHITECTURE.md](/C:/Users/Terry/OneDrive/Documents/New%20project/receipt-tracker-starter/docs/ARCHITECTURE.md)

## Recommended MVP Scope

- Mobile-first receipt capture and review queue
- OCR normalization pipeline with human approval
- QuickBooks sync first
- CSV export immediately
- Microsoft Excel Graph sync after the QuickBooks path is stable

That sequencing keeps the hardest delegated-user workbook permissions and retry behavior out of the first launch while still leaving the Excel hooks in place.

## Project Layout

```text
receipt-tracker-starter/
  docs/
    API_ENDPOINTS.md
    ARCHITECTURE.md
    openapi.yaml
  backend/
    README.md
    pyproject.toml
    app/
      main.py
      core/config.py
      api/router.py
      api/routes/
      db/schema.sql
      models/
  mobile/
    README.md
  web/
    README.md
```

## Recommended Next Build Steps

1. Bring up the local backend stack with `scripts/start-local-stack.ps1`.
2. Configure AWS, OpenAI, Intuit, and Microsoft credentials in `.env`.
3. Add background workers for OCR, sync retries, and stale-job reconciliation.
4. Wire mobile capture to the real upload + receipt API path.
5. Run beta hardening: tests, analytics, crash reporting, and store/subscription validation.

## Quality Gates

- `node scripts/launch-readiness-check.mjs --ci --strict` validates contract files, core implementations, lockfiles, and CI-safe readiness checks.
- `cd web && npm run build` verifies the companion app production build.
- `cd mobile && npx tsc --noEmit && npx expo-doctor` verifies mobile types and Expo dependency health.
- `cd backend && pip install -e ".[dev]" && pytest tests` runs backend service logic tests.

GitHub Actions runs these quality gates in `.github/workflows/quality-gates.yml` on `push` and `pull_request`.

## What Is Implemented Now

- FastAPI app bootstrap with commercial user settings, Supabase-token verification hooks, RevenueCat webhook ingestion, workbook binding, support tickets, receipt processing status, and sync-job visibility
- local demo user resolution remains available for development while Supabase JWT verification is wired for production environments
- DB-backed receipt create, upload-complete, processing-status, update, approve, sync queue, sync execution, and sync-job detail endpoints
- real OAuth connect URL builders and callback exchanges for QuickBooks and Microsoft, with encrypted token storage and refresh hooks
- QuickBooks chart-of-accounts import into receipt categories plus QuickBooks expense creation for approved receipts
- Excel workbook validation and row append through Microsoft Graph for approved receipts
- Textract-backed OCR plus OpenAI structured normalization when those providers are configured, with deterministic local fallback when they are not
- dedicated Next.js web companion with launch, receipts, reports, billing, and integration surfaces
- dedicated Expo mobile app with onboarding, inbox, capture queue, reports, billing, and settings flows
- Docker-based local backend runtime plus a Node smoke script for real receipt upload testing

## Notes That Matter Early

- Do not market the system as end-to-end encrypted if your backend, OCR provider, or LLM can read receipt contents.
- Keep categorization constrained to user-approved categories or imported QuickBooks accounts.
- Make sync idempotent with a persisted `idempotency_key` per outbound job.
- Store raw OCR, normalized model output, and final user-approved values separately for auditability.

## Useful References

- [Amazon Textract AnalyzeExpense](https://docs.aws.amazon.com/textract/latest/dg/analyzing-document-expense.html)
- [QuickBooks attachment workflow](https://developer.intuit.com/app/developer/qbo/docs/workflows/attach-images-and-notes)
- [Microsoft Graph Excel add rows](https://learn.microsoft.com/en-us/graph/api/tablerowcollection-add?view=graph-rest-1.0)
- [Microsoft Graph write patterns for Excel](https://learn.microsoft.com/en-us/graph/excel-write-to-workbook)
- [Local setup runbook](./docs/LOCAL_SETUP.md)
- [Provider sandbox runbook](./docs/PROVIDER_SANDBOX_RUNBOOK.md)
- [Mobile release checklist](./docs/MOBILE_RELEASE_CHECKLIST.md)
- [Device QA matrix](./docs/DEVICE_QA_MATRIX.md)
