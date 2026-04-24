param(
  [switch]$Once,
  [int]$PollSeconds = 5,
  [int]$ProcessingLimit = 25,
  [int]$SyncLimit = 25
)

$ErrorActionPreference = "Stop"
$BackendDir = Resolve-Path (Join-Path $PSScriptRoot "..\backend")

Push-Location $BackendDir
try {
  $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
  if (-not $PythonCommand) {
    $PythonCommand = Get-Command py -ErrorAction SilentlyContinue
  }

  if (-not $PythonCommand) {
    throw "Python was not found on PATH. Install Python 3.12+ or activate the backend virtual environment before running the worker."
  }

  $argsList = @(
    "--poll-seconds",
    "$PollSeconds",
    "--processing-limit",
    "$ProcessingLimit",
    "--sync-limit",
    "$SyncLimit"
  )

  if ($Once) {
    $argsList += "--once"
  }

  if ($PythonCommand.Name -eq "py.exe" -or $PythonCommand.Name -eq "py") {
    & $PythonCommand.Source -3 -m app.worker @argsList
  }
  else {
    & $PythonCommand.Source -m app.worker @argsList
  }
}
finally {
  Pop-Location
}
