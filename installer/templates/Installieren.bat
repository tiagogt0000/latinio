@echo off
setlocal
title Latinio - Update installieren
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Installieren.ps1"
set "update_result=%errorlevel%"
echo.
if not "%update_result%"=="0" echo Das Update wurde nicht erfolgreich abgeschlossen.
pause
exit /b %update_result%
