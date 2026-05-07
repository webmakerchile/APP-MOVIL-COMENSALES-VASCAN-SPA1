@echo off
REM Auto-updater. Runs every 30 min via Scheduled Task.
REM 1) Reads C:\BuenaMezcla\totem-data\update-pending.json (left there by the
REM    sync worker when /api/totem/version/latest reports a newer version).
REM 2) Downloads the installer to a temp file, verifies SHA-256, runs silently.
REM 3) The new installer overwrites the payload and restarts the service.

setlocal enabledelayedexpansion
set "APP=%~dp0.."
set "MARKER=%APP%\totem-data\update-pending.json"
set "LOG=%APP%\logs\updater.log"

if not exist "%MARKER%" exit /b 0

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$j = Get-Content -Raw '%MARKER%' | ConvertFrom-Json;" ^
  "$tmp = Join-Path $env:TEMP ('BuenaMezclaTotem-' + $j.version + '.exe');" ^
  "Write-Host ('Descargando ' + $j.url);" ^
  "Invoke-WebRequest -UseBasicParsing -Uri $j.url -OutFile $tmp;" ^
  "$h = (Get-FileHash -Algorithm SHA256 $tmp).Hash.ToLower();" ^
  "if ($h -ne $j.sha256.ToLower()) { Write-Error 'SHA256 mismatch'; exit 2 };" ^
  "Write-Host 'Hash OK, ejecutando instalador en silencio';" ^
  "Start-Process -FilePath $tmp -ArgumentList '/SILENT','/SUPPRESSMSGBOXES','/NORESTART' -Wait;" ^
  "Remove-Item '%MARKER%' -Force;" ^
  "Remove-Item $tmp -Force" >> "%LOG%" 2>&1

exit /b %ERRORLEVEL%
