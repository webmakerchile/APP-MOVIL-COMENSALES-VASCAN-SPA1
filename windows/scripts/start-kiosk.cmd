@echo off
REM Launches Chrome (or Edge as fallback) in kiosk mode pointing at the local totem server.
REM Waits for the local server to come up first.

set "URL=http://127.0.0.1:5000/kiosk"
set "PROFILE=%LOCALAPPDATA%\BuenaMezclaTotem\ChromeProfile"
mkdir "%PROFILE%" >nul 2>&1

REM Wait up to 60 seconds for the local server
set /a tries=0
:waitloop
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%URL%/api/auth/me').StatusCode | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL%==0 goto launch
set /a tries+=1
if %tries% GEQ 30 goto launch
timeout /t 2 /nobreak >nul
goto waitloop

:launch
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --kiosk --no-first-run --noerrdialogs --disable-translate --disable-features=TranslateUI --disable-pinch --overscroll-history-navigation=0 --user-data-dir="%PROFILE%" "%URL%"
  exit /b 0
)
REM Fallback: Edge
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" start "" "%EDGE%" --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run
exit /b 0
