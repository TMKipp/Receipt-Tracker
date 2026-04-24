$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $workspaceRoot ".env"

if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $workspaceRoot ".env.example") $envFile
  Write-Host "Created .env from .env.example"
}

Push-Location $workspaceRoot

try {
  docker compose up --build -d postgres redis backend worker
  Write-Host ""
  Write-Host "Receipt Tracker backend and worker stack is starting."
  Write-Host "Backend API: http://localhost:8000/api/v1"
  Write-Host "Worker: receipt-tracker-worker"
  Write-Host "Health check: http://localhost:8000/api/v1/health"
  Write-Host "Next step: start the web app from receipt-tracker-starter/web and open /receipts."
} finally {
  Pop-Location
}
