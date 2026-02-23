@echo off
setlocal
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'next dev' -and $_.CommandLine -match 'web' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
call "%~dp0run_app.bat"
endlocal
