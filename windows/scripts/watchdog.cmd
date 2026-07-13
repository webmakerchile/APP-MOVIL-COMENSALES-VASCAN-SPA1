@echo off
REM BuenaMezcla Totem — Watchdog
REM Verifica cada 5 minutos (via tarea programada) si el servidor local
REM responde en el puerto 5000. Si no responde en 3 intentos, lo reinicia.
REM Se instala como tarea SYSTEM /SC MINUTE /MO 5 por install.ps1.

set "INSTALLDIR=%~dp0.."
set "LOGDIR=%INSTALLDIR%\logs"
set "LOG=%LOGDIR%\watchdog.log"
if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1

set /a FAILS=0

:CHECK
powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',5000);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 exit /b 0

set /a FAILS+=1
if %FAILS% LSS 3 (
    timeout /t 10 /nobreak >nul
    goto CHECK
)

echo [%date% %time%] Servidor no responde tras 3 intentos. Reiniciando BuenaMezclaTotem... >> "%LOG%"
schtasks /Run /TN "BuenaMezclaTotem" >> "%LOG%" 2>&1
timeout /t 15 /nobreak >nul

powershell -NoProfile -Command "try{$c=New-Object Net.Sockets.TcpClient;$c.Connect('127.0.0.1',5000);$c.Close();exit 0}catch{exit 1}" >nul 2>&1
if not errorlevel 1 (
    echo [%date% %time%] Servidor reiniciado correctamente. >> "%LOG%"
) else (
    echo [%date% %time%] ADVERTENCIA: Servidor sigue sin responder tras reinicio. >> "%LOG%"
)
