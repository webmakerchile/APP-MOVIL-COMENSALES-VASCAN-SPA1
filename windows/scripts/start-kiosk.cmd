@echo off
REM Launches Chrome (or Edge as fallback) in kiosk mode pointing at the local totem server.
REM Waits for the local server to come up first.
REM NOTA: copia de referencia. La que corre en los totems la genera
REM public/totem/install.ps1 (bloque $kioskCmd). Mantener ambas en sync.

set "URL=http://127.0.0.1:5000/kiosk"
set "PROFILE=%LOCALAPPDATA%\BuenaMezclaTotem\ChromeProfile"
mkdir "%PROFILE%" >nul 2>&1

REM Wait up to 60 seconds for the local server (TCP 127.0.0.1:5000)
set /a tries=0
:waitloop
powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',5000);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
if %ERRORLEVEL%==0 goto launch
set /a tries+=1
if %tries% GEQ 30 goto launch
timeout /t 2 /nobreak >nul
goto waitloop

:launch
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" goto runchrome
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" goto runedge
echo [kiosk] No se encontro Chrome ni Edge
exit /b 1
:runchrome
start "" "%CHROME%" --kiosk --kiosk-printing --no-first-run --noerrdialogs --disable-translate --disable-features=TranslateUI --disable-pinch --overscroll-history-navigation=0 --user-data-dir="%PROFILE%" "%URL%"
exit /b 0
:runedge
start "" "%EDGE%" --kiosk --kiosk-printing --no-first-run --user-data-dir="%PROFILE%" --edge-kiosk-type=fullscreen "%URL%"
exit /b 0
