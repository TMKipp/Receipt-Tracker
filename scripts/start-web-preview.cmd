@echo off
set PORT=%1
if "%PORT%"=="" set PORT=3022
set LOGFILE=%~dp0..\web\preview-%PORT%.log
cd /d "%~dp0\..\web"
set NPM_CMD=%ProgramFiles%\nodejs\npm.cmd
if exist "%NPM_CMD%" (
  call "%NPM_CMD%" run start -- --hostname 127.0.0.1 --port %PORT% >> "%LOGFILE%" 2>&1
) else (
  call npm run start -- --hostname 127.0.0.1 --port %PORT% >> "%LOGFILE%" 2>&1
)
