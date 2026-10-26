@echo off
REM Quick deploy for Mersal Tickets on Windows - one click.
REM Usage: deploy.bat            (uses C:\mersal-tickets)
REM        deploy.bat D:\path    (custom deploy folder)
REM Safe to re-run: restarts ONLY the pm2 process "mersal-tickets" - never kills other Node apps.
setlocal
cd /d "%~dp0"
set "DEPLOY_DIR=%~1"
if "%DEPLOY_DIR%"=="" set "DEPLOY_DIR=C:\mersal-tickets"

where node >nul 2>&1 || (echo [X] Node.js is not installed. Install Node.js 22 from https://nodejs.org & pause & exit /b 1)
where pm2 >nul 2>&1 || (echo Installing pm2... & call npm install -g pm2 || (pause & exit /b 1))

if not exist "%DEPLOY_DIR%" mkdir "%DEPLOY_DIR%"
if not exist "%DEPLOY_DIR%\.env" (
  if exist ".env.production" (
    copy /y ".env.production" "%DEPLOY_DIR%\.env" >nul
    echo Copied .env.production to %DEPLOY_DIR%\.env
  ) else (
    copy /y ".env.example" "%DEPLOY_DIR%\.env" >nul
    echo [X] Created %DEPLOY_DIR%\.env from the template. Edit DATABASE_URL and AUTH_SECRET, then run this again.
    notepad "%DEPLOY_DIR%\.env"
    pause & exit /b 1
  )
)

echo Installing packages...
call npm ci --no-audit --no-fund || (pause & exit /b 1)
node scripts\deploy.mjs || (pause & exit /b 1)

echo.
echo Done. Open: http://localhost:3005
echo Auto-start on reboot (one time): npm install -g pm2-windows-startup ^&^& pm2-startup install
pause
