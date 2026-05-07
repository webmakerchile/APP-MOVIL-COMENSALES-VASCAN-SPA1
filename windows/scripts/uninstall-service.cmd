@echo off
setlocal
set "APP=%~dp0.."
set "NSSM=%APP%\nssm\nssm.exe"
"%NSSM%" stop BuenaMezclaTotem >nul 2>&1
"%NSSM%" remove BuenaMezclaTotem confirm >nul 2>&1
exit /b 0
