@echo off
rem Starts the Byteflock frontend for local verification (localrunverify.md).
rem   startfe          dashboard, widget origin, playground and both Storybooks
rem   startfe stack    only the dashboard, widget origin and playground
rem Each server opens in its own window titled "Byteflock ...". Stop everything with stopfe.bat.
setlocal
cd /d "%~dp0"

where node >nul 2>nul || (echo Node.js 24 is required: https://nodejs.org & exit /b 1)
where pnpm.cmd >nul 2>nul || (echo pnpm is required: run "corepack enable" or install pnpm & exit /b 1)

if not exist node_modules (
  echo Installing dependencies ...
  call pnpm.cmd install --frozen-lockfile || exit /b 1
)

echo Starting the stack: dashboard 3000, widget origin 4400, playground 4300 ...
start "Byteflock stack" cmd /c pnpm.cmd stack

if /i not "%~1"=="stack" (
  echo Starting the ui-react Storybook on 4600 ...
  start "Byteflock ui-react Storybook" cmd /c pnpm.cmd nx run @byteflock/ui-react:storybook
  echo Starting the chat-widget Storybook on 4700 ...
  start "Byteflock chat-widget Storybook" cmd /c pnpm.cmd nx run @byteflock/chat-widget:storybook
)

echo Waiting for the servers ...
call pnpm.cmd stack:check --wait 180
if errorlevel 1 (
  echo The stack did not come up. Check the "Byteflock stack" window, then run stopfe.bat.
  exit /b 1
)

echo.
echo   Dashboard          http://localhost:3000   (pick a tenant at /dev/session)
echo   Widget playground  http://localhost:4300
echo   Widget origin      http://localhost:4400
if /i not "%~1"=="stack" (
  echo   ui-react Storybook    http://localhost:4600
  echo   chat-widget Storybook http://localhost:4700
)
echo.
echo Verification steps: localrunverify.md. Stop with stopfe.bat.
endlocal
