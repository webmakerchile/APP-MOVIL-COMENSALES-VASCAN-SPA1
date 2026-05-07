@echo off
REM Installs the BuenaMezclaTotem service via NSSM and starts it.
setlocal
set "APP=%~dp0.."
set "NSSM=%APP%\nssm\nssm.exe"
set "NODE=%APP%\node\node.exe"
set "SVC=BuenaMezclaTotem"

"%NSSM%" stop "%SVC%" >nul 2>&1
"%NSSM%" remove "%SVC%" confirm >nul 2>&1

"%NSSM%" install "%SVC%" "%NODE%" "%APP%\totem\runtime.js"
"%NSSM%" set "%SVC%" AppDirectory "%APP%"
"%NSSM%" set "%SVC%" DisplayName "BuenaMezcla Totem"
"%NSSM%" set "%SVC%" Description "Servidor local del tótem BuenaMezcla con sync a la nube"
"%NSSM%" set "%SVC%" Start SERVICE_AUTO_START
"%NSSM%" set "%SVC%" AppStdout "%APP%\logs\service.out.log"
"%NSSM%" set "%SVC%" AppStderr "%APP%\logs\service.err.log"
"%NSSM%" set "%SVC%" AppRotateFiles 1
"%NSSM%" set "%SVC%" AppRotateBytes 5000000
"%NSSM%" set "%SVC%" AppEnvironmentExtra ^
  "DB_MODE=totem" ^
  "TOTEM_DB_PATH=%APP%\totem-data\totem.db" ^
  "PORT=5000" ^
  "NODE_ENV=production"
"%NSSM%" set "%SVC%" AppExit Default Restart
"%NSSM%" set "%SVC%" AppRestartDelay 5000

"%NSSM%" start "%SVC%"
exit /b 0
