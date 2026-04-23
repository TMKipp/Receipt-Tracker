@echo off
set PORT=%1
if "%PORT%"=="" set PORT=3031
set LOGFILE=%~dp0..\web\preview-dev-%PORT%.log
cd /d "%~dp0\..\web"
set NPM_CMD=%ProgramFiles%\nodejs\npm.cmd
if exist "%NPM_CMD%" (
  call "%NPM_CMD%" run dev -- --hostname 127.0.0.1 --port %PORT% >> "%LOGFILE%" 2>&1
) else (
  call npm run dev -- --hostname 127.0.0.1 --port %PORT% >> "%LOGFILE%" 2>&1
)
