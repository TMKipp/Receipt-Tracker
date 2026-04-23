# Local Setup

This runbook gets the commercial MVP into a usable local state with the least moving parts.

## 1. Start the backend stack

From `receipt-tracker-starter/`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-stack.ps1
```

What this starts:

- Postgres on `localhost:5432`
- Redis on `localhost:6379`
- FastAPI backend on `http://localhost:8000/api/v1`

If `.env` does not exist yet, the script creates it from `.env.example`.

## 2. Start the web companion

From `receipt-tracker-starter/web`:

```powershell
copy .env.local.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000/receipts](http://localhost:3000/receipts) and use the **Live capture lane** at the top of the page.

## 3. Run a smoke test without the UI

From `receipt-tracker-starter/`:

```powershell
node .\scripts\smoke-receipt-flow.mjs --file "C:\path\to\receipt.jpg"
```

Optional approval + sync:

```powershell
node .\scripts\smoke-receipt-flow.mjs --file "C:\path\to\receipt.jpg" --approve --sync-targets quickbooks,excel
```

## 4. Enable real providers

- Set `TEXTRACT_ENABLED=true` and provide working AWS credentials for Textract.
- Set `OPENAI_ENABLED=true` and `OPENAI_API_KEY` for structured normalization.
- Set QuickBooks and Microsoft OAuth credentials in `.env`.
- For browser S3 uploads, also configure bucket CORS for `PUT` from your local web origin.

## 5. Stop the stack

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-local-stack.ps1
```
