# ==============================================================
#  BuenaMezcla Tótem — Instalador OFFLINE (PowerShell)
# ==============================================================
#  Instala el tótem en C:\BuenaMezcla con:
#    - Node.js portable (descarga si no lo encuentra)
#    - Servidor Express + SQLite local
#    - Sync worker hacia la nube (cuando hay internet)
#    - Tarea programada para arrancar al inicio del PC
#    - Chrome en modo kiosko al iniciar sesión
#
#  USO (en PowerShell como Administrador):
#    Set-ExecutionPolicy -Scope Process Bypass
#    .\install.ps1 -Cloud https://vascan.replit.app `
#                  -Casino <UUID-CASINO> `
#                  -Token <BOOTSTRAP-TOKEN> `
#                  -Nombre "Totem Comedor 1"
# ==============================================================

param(
  [Parameter(Mandatory=$true)] [string] $Cloud,
  [Parameter(Mandatory=$true)] [string] $Casino,
  [Parameter(Mandatory=$true)] [string] $Token,
  [string] $Nombre = "Totem-$($env:COMPUTERNAME)",
  [string] $InstallDir = "C:\BuenaMezcla"
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

# Verifica admin
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "ERROR: Debes correr este script como Administrador." -ForegroundColor Red
  exit 1
}

Write-Step "1/7 Preparando carpetas en $InstallDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\totem-data" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\logs"       | Out-Null

# ── Copia los archivos del bundle (todo lo que está junto al script) ──
$src = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Split-Path -Parent $src   # subir de scripts\ al root del bundle
Write-Host "Copiando bundle desde $src ..."
Copy-Item -Recurse -Force "$src\server"  "$InstallDir\"
Copy-Item -Recurse -Force "$src\totem"   "$InstallDir\"
Copy-Item -Recurse -Force "$src\shared"  "$InstallDir\"
Copy-Item -Recurse -Force "$src\pwa"     "$InstallDir\"
Copy-Item -Recurse -Force "$src\public"  "$InstallDir\"
Copy-Item        -Force  "$src\package.json" "$InstallDir\"
Copy-Item -Recurse -Force "$src\scripts" "$InstallDir\"

# ── Node.js portable ──
Write-Step "2/7 Verificando Node.js"
$nodeExe = "$InstallDir\node\node.exe"
if (-not (Test-Path $nodeExe)) {
  Write-Host "Descargando Node.js 20 portable (~30MB)..."
  $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"
  $tmp = "$env:TEMP\node-portable.zip"
  Invoke-WebRequest -Uri $nodeUrl -OutFile $tmp -UseBasicParsing
  Expand-Archive -Path $tmp -DestinationPath "$env:TEMP\node-extract" -Force
  $extracted = Get-ChildItem "$env:TEMP\node-extract" -Directory | Select-Object -First 1
  Move-Item $extracted.FullName "$InstallDir\node"
  Remove-Item $tmp -Force
  Remove-Item "$env:TEMP\node-extract" -Recurse -Force
}
$nodeVer = & $nodeExe --version
Write-Host "Node listo: $nodeVer"

# ── npm install (baja better-sqlite3 prebuild para Windows) ──
Write-Step "3/7 Instalando dependencias nativas (puede tardar 2-3 min)"
Push-Location $InstallDir
$npmCmd = "$InstallDir\node\npm.cmd"
& $npmCmd install --omit=dev --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  Write-Host "ERROR: npm install falló." -ForegroundColor Red
  exit 2
}
Pop-Location

# ── Registro contra la nube ──
Write-Step "4/7 Registrando este tótem en la nube ($Cloud)"
$env:DB_MODE = "totem"
$env:TOTEM_DB_PATH = "$InstallDir\totem-data\totem.db"
$env:CLOUD_URL = $Cloud
$registerLog = "$InstallDir\logs\register.log"
& $nodeExe "$InstallDir\totem\register.js" `
  --nombre $Nombre --casino $Casino --token $Token --cloud $Cloud `
  *>&1 | Tee-Object -FilePath $registerLog
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Registro falló. Revisa $registerLog" -ForegroundColor Red
  exit 3
}

# ── Script de arranque del servicio ──
Write-Step "5/7 Creando script de arranque"
$serviceCmd = "$InstallDir\scripts\run-totem.cmd"
@"
@echo off
set DB_MODE=totem
set TOTEM_DB_PATH=$InstallDir\totem-data\totem.db
set CLOUD_URL=$Cloud
set PORT=5000
set NODE_ENV=production
"$InstallDir\node\node.exe" "$InstallDir\totem\runtime.js" >> "$InstallDir\logs\service.out.log" 2>> "$InstallDir\logs\service.err.log"
"@ | Set-Content -Encoding ASCII $serviceCmd

# ── Tarea programada: servicio al arranque del PC ──
Write-Step "6/7 Registrando tarea programada del servicio"
schtasks /Delete /TN "BuenaMezclaTotem" /F 2>$null | Out-Null
schtasks /Create /TN "BuenaMezclaTotem" /TR "`"$serviceCmd`"" /SC ONSTART /RU "SYSTEM" /RL HIGHEST /F | Out-Null

# ── Chrome kiosko al iniciar sesión ──
Write-Step "7/7 Configurando Chrome en modo kiosko"
$kioskCmd = "$InstallDir\scripts\start-kiosk.cmd"
@"
@echo off
set "URL=http://127.0.0.1:5000/kiosk"
set "PROFILE=%LOCALAPPDATA%\BuenaMezclaTotem\ChromeProfile"
mkdir "%PROFILE%" >nul 2>&1
set /a tries=0
:waitloop
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:5000/api/auth/me').StatusCode | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %ERRORLEVEL%==0 goto launch
set /a tries+=1
if %tries% GEQ 30 goto launch
timeout /t 2 /nobreak >nul
goto waitloop
:launch
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --kiosk --no-first-run --noerrdialogs --disable-translate --disable-pinch --user-data-dir="%PROFILE%" "%URL%"
) else (
  set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  if exist "%EDGE%" start "" "%EDGE%" --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run
)
"@ | Set-Content -Encoding ASCII $kioskCmd

schtasks /Delete /TN "BuenaMezclaTotemKiosk" /F 2>$null | Out-Null
schtasks /Create /TN "BuenaMezclaTotemKiosk" /TR "`"$kioskCmd`"" /SC ONLOGON /RL HIGHEST /F | Out-Null

# Lanza ahora ambos
Write-Step "Iniciando servicio y kiosko"
schtasks /Run /TN "BuenaMezclaTotem" | Out-Null
Start-Sleep -Seconds 8
Start-Process -FilePath $kioskCmd

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " INSTALACION COMPLETADA"                          -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host " - Tótem:    $Nombre"
Write-Host " - Carpeta:  $InstallDir"
Write-Host " - Datos:    $InstallDir\totem-data\totem.db (PERSISTENTE)"
Write-Host " - Logs:     $InstallDir\logs\"
Write-Host " - URL:      http://127.0.0.1:5000/kiosk"
Write-Host ""
Write-Host " El servicio arrancara solo al encender el PC."
Write-Host " Chrome kiosko se abrira al iniciar sesion."
Write-Host ""
