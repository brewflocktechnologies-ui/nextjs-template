@echo off
rem Stops the Byteflock frontend started by startfe.bat (or pnpm stack and the Storybooks).
rem 1. Closes the "Byteflock ..." console windows and their process trees (classic consoles; in
rem    Windows Terminal the servers open as tabs, which step 2 handles).
rem 2. Ends every process listening on the local ports (3000, 3005, 4300, 4400, 4401, 4600, 4700);
rem    their pnpm and Nx parents then exit and the windows or tabs close.
rem 3. Restores apps/admin-dashboard/next-env.d.ts, which next dev rewrites.
setlocal
cd /d "%~dp0"

echo Closing the Byteflock windows ...
taskkill /FI "WINDOWTITLE eq Byteflock*" /T /F >nul 2>nul

echo Freeing the local ports ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 3000,3005,4300,4400,4401,4600,4700 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Write-Host ('  stopping process ' + $_); Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

git checkout -- apps/admin-dashboard/next-env.d.ts >nul 2>nul

powershell -NoProfile -ExecutionPolicy Bypass -Command "$left = Get-NetTCPConnection -LocalPort 3000,3005,4300,4400,4401,4600,4700 -State Listen -ErrorAction SilentlyContinue; if ($left) { Write-Host 'Still listening:'; $left | Format-Table LocalPort,OwningProcess; exit 1 } else { Write-Host 'Stopped. All ports are free.' }"
set result=%errorlevel%

echo Local publishes and drafts are not undone here; run "pnpm.cmd stack:reset" before committing.
endlocal & exit /b %result%
