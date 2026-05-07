@echo off
REM BuenaMezcla Tótem — auto-updater con rollback verificado.
REM
REM Flujo:
REM   1. Lee marcador update-pending.json (lo deja sync-worker tras /version/latest).
REM   2. Descarga el .exe del nuevo installer y verifica su SHA-256.
REM   3. Hace backup de la instalación actual a app-backup\.
REM   4. Ejecuta el installer en /SILENT (register.cmd es idempotente, no re-pide datos).
REM   5. Reinicia el servicio y espera 60s a que vuelva a responder /api/auth/me.
REM   6. Si NO responde: restaura el backup y reinicia el servicio anterior. Loguea fallo.
REM
setlocal enabledelayedexpansion
set "APP=%~dp0.."
set "MARKER=%APP%\totem-data\update-pending.json"
set "LOGDIR=%APP%\logs"
set "LOG=%LOGDIR%\updater.log"
set "BACKUP=%APP%\..\app-backup"
set "PORT=5000"
REM Always invoke NSSM via absolute path; PATH may not include it under
REM the scheduled-task service account.
set "NSSM=%APP%\nssm\nssm.exe"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

if not exist "%MARKER%" (
  echo [%date% %time%] No hay update pendiente. >> "%LOG%"
  exit /b 0
)

echo [%date% %time%] Update pendiente detectado. >> "%LOG%"

REM Extraer url y sha del marcador
for /f "delims=" %%R in ('""%APP%\node\node.exe" -e "const m=require('%MARKER:\=\\%');process.stdout.write(m.url+'|'+m.sha256+'|'+m.version)"') do set "META=%%R"
for /f "tokens=1,2,3 delims=|" %%A in ("%META%") do (
  set "URL=%%A"
  set "SHA=%%B"
  set "VER=%%C"
)

if "%URL%"=="" (
  echo [%date% %time%] Marker corrupto. Abort. >> "%LOG%"
  del "%MARKER%"
  exit /b 1
)

set "INSTALLER=%TEMP%\buenamezcla-totem-%VER%.exe"
echo [%date% %time%] Descargando %URL% >> "%LOG%"
powershell -NoProfile -Command "try{ Invoke-WebRequest -Uri '%URL%' -OutFile '%INSTALLER%' -UseBasicParsing } catch { exit 2 }"
if errorlevel 1 (
  echo [%date% %time%] Descarga fallo. >> "%LOG%"
  exit /b 2
)

REM Verificar SHA-256
for /f "tokens=*" %%H in ('powershell -NoProfile -Command "(Get-FileHash '%INSTALLER%' -Algorithm SHA256).Hash.ToLower()"') do set "GOT=%%H"
if /I not "%GOT%"=="%SHA%" (
  echo [%date% %time%] SHA mismatch. esperado=%SHA% obtuve=%GOT%. Abort. >> "%LOG%"
  del "%INSTALLER%"
  exit /b 3
)
echo [%date% %time%] SHA OK. Backup actual… >> "%LOG%"

REM Backup completo (solo bin + pwa, NO totem-data ni logs para preservar SQLite y bitácoras)
if exist "%BACKUP%" rmdir /s /q "%BACKUP%"
mkdir "%BACKUP%"
xcopy "%APP%\node" "%BACKUP%\node\" /e /i /q /y >nul
xcopy "%APP%\server" "%BACKUP%\server\" /e /i /q /y >nul
xcopy "%APP%\pwa" "%BACKUP%\pwa\" /e /i /q /y >nul
xcopy "%APP%\totem" "%BACKUP%\totem\" /e /i /q /y >nul
copy "%APP%\version.txt" "%BACKUP%\version.txt" >nul 2>&1

echo [%date% %time%] Detener servicio… >> "%LOG%"
"%NSSM%" stop BuenaMezclaTotem >> "%LOG%" 2>&1

echo [%date% %time%] Instalando %VER%… >> "%LOG%"
"%INSTALLER%" /SILENT /SUPPRESSMSGBOXES /NORESTART >> "%LOG%" 2>&1
set "INSTALL_RC=%ERRORLEVEL%"

echo [%date% %time%] Reiniciar servicio… >> "%LOG%"
"%NSSM%" start BuenaMezclaTotem >> "%LOG%" 2>&1

REM Esperar hasta 60s a que el server responda
set /a TRIES=0
:WAIT_HEALTH
set /a TRIES+=1
timeout /t 3 /nobreak >nul
REM Healthcheck: el server está sano si responde con 200 (raíz) o 401 (auth/me
REM sin sesión). Sólo consideramos fallo cuando ni siquiera el socket TCP
REM responde dentro del timeout.
powershell -NoProfile -Command "try{Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/api/auth/me' -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0}catch{ if($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -ge 200){exit 0} else {exit 1} }" >nul 2>&1
if not errorlevel 1 (
  echo [%date% %time%] Update %VER% OK. >> "%LOG%"
  del "%MARKER%"
  del "%INSTALLER%"
  rmdir /s /q "%BACKUP%"
  exit /b 0
)
if %TRIES% LSS 20 goto WAIT_HEALTH

REM === ROLLBACK ===
echo [%date% %time%] Healthcheck FALLO tras update %VER%. ROLLBACK. >> "%LOG%"
"%NSSM%" stop BuenaMezclaTotem >> "%LOG%" 2>&1
xcopy "%BACKUP%\node" "%APP%\node\" /e /i /q /y >nul
xcopy "%BACKUP%\server" "%APP%\server\" /e /i /q /y >nul
xcopy "%BACKUP%\pwa" "%APP%\pwa\" /e /i /q /y >nul
xcopy "%BACKUP%\totem" "%APP%\totem\" /e /i /q /y >nul
copy "%BACKUP%\version.txt" "%APP%\version.txt" >nul 2>&1
"%NSSM%" start BuenaMezclaTotem >> "%LOG%" 2>&1
del "%MARKER%"
del "%INSTALLER%"
rmdir /s /q "%BACKUP%"
echo [%date% %time%] Rollback completado. Versión previa restaurada. >> "%LOG%"
exit /b 9
