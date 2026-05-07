@echo off
REM Args: %1=cloudUrl  %2=bootstrapToken  %3=casinoId  %4=totemName  %5=version
REM Idempotent: skips registration if the totem is already registered.
REM This makes the script safe to run from /SILENT updater installs.
setlocal
set "APP=%~dp0.."
set "NODE=%APP%\node\node.exe"
set "DB=%APP%\totem-data\totem.db"
set "DB_MODE=totem"
set "TOTEM_DB_PATH=%DB%"

REM Already registered? Skip.
if exist "%DB%" (
  for /f %%R in ('"%NODE%" -e "try{const d=require('better-sqlite3')(process.env.TOTEM_DB_PATH);const r=d.prepare('SELECT value FROM totem_config WHERE key=?').get('totem_id');process.stdout.write(r&&r.value?'REGISTERED':'NEW')}catch(e){process.stdout.write('NEW')}"') do set "STATE=%%R"
  if /I "%STATE%"=="REGISTERED" (
    echo [register] Totem ya registrado. Skip. >> "%APP%\logs\register.log"
    exit /b 0
  )
)

REM Empty args means we're running from /SILENT updater — also skip.
if "%~2"=="" (
  echo [register] Sin token, asumiendo update silencioso. Skip. >> "%APP%\logs\register.log"
  exit /b 0
)

"%NODE%" "%APP%\totem\register.js" --cloud "%~1" --token "%~2" --casino "%~3" --nombre "%~4" --version "%~5" >> "%APP%\logs\register.log" 2>&1
exit /b %ERRORLEVEL%
