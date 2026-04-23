$ErrorActionPreference = "Stop"

$workspaceRoot = Split-Path -Parent $PSScriptRoot

Push-Location $workspaceRoot

try {
  docker compose down
} finally {
  Pop-Location
}
