@echo off
REM ============================================================
REM  BuenaMezcla Tótem - Modo NUBE (no requiere servicio local)
REM ============================================================
REM  Abre Chrome en modo kiosko apuntando a la app en la nube.
REM  Requiere internet permanente. Para modo OFFLINE usar el
REM  instalador BuenaMezclaTotem-Setup.exe.
REM ============================================================

set "URL=https://vascan.replit.app/kiosk"
set "PROFILE=%LOCALAPPDATA%\BuenaMezclaTotem\ChromeProfile"
mkdir "%PROFILE%" >nul 2>&1

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME%" (
  start "" "%CHROME%" --kiosk --no-first-run --noerrdialogs ^
    --disable-translate --disable-features=TranslateUI ^
    --disable-pinch --overscroll-history-navigation=0 ^
    --user-data-dir="%PROFILE%" "%URL%"
  exit /b 0
)

REM Fallback: Edge
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run
  exit /b 0
)

echo ERROR: No se encontro Chrome ni Edge instalado.
pause
exit /b 1
