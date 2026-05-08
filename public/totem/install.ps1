# ==============================================================
#  BuenaMezcla Tótem — Instalador OFFLINE (one-shot)
# ==============================================================
#  Descarga el bundle desde la nube, instala Node, registra el
#  tótem y deja todo arrancando solo.
#
#  USO (en PowerShell como Administrador):
#    Set-ExecutionPolicy -Scope Process Bypass
#    iwr https://vascan.replit.app/totem/install.ps1 -UseBasicParsing | iex
#
#  O bien, con parámetros directos (sin prompt):
#    & ([scriptblock]::Create((iwr https://vascan.replit.app/totem/install.ps1 -UseBasicParsing).Content)) `
#       -Casino "<UUID>" -Token "<BOOTSTRAP>" -Nombre "Totem Comedor 1"
# ==============================================================

param(
  [string] $Cloud      = "https://vascan.replit.app",
  [string] $Casino     = "",
  [string] $Token      = "",
  [string] $Nombre     = "",
  [string] $InstallDir = "C:\BuenaMezcla"
)

$ErrorActionPreference = "Stop"
function Step($m) { Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }

# ── Admin ──
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host "ERROR: Abre PowerShell como Administrador." -ForegroundColor Red
  exit 1
}

# ── Pedir datos faltantes ──
if (-not $Casino) { $Casino = Read-Host "UUID del casino" }
if (-not $Token)  { $Token  = Read-Host "Token de bootstrap (del panel admin)" }
if (-not $Nombre) {
  $def = "Totem-$($env:COMPUTERNAME)"
  $r = Read-Host "Nombre del totem [$def]"
  if ($r) { $Nombre = $r } else { $Nombre = $def }
}

Step "1/8 Preparando carpetas en $InstallDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\totem-data" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\logs"       | Out-Null

# ── Bajar y extraer bundle ──
Step "2/8 Descargando bundle desde $Cloud"
$bundleUrl = "$Cloud/totem/totem-bundle.tar.gz"
$bundleTmp = "$env:TEMP\totem-bundle.tar.gz"
Invoke-WebRequest -Uri $bundleUrl -OutFile $bundleTmp -UseBasicParsing
Write-Host "Extrayendo..."
tar -xzf $bundleTmp -C $InstallDir
Remove-Item $bundleTmp -Force

# ── Node.js portable ──
Step "3/8 Verificando Node.js"
$nodeExe = "$InstallDir\node\node.exe"
if (-not (Test-Path $nodeExe)) {
  Write-Host "Descargando Node.js 20 portable (~30MB)..."
  $nodeUrl = "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip"
  $tmp = "$env:TEMP\node-portable.zip"
  Invoke-WebRequest -Uri $nodeUrl -OutFile $tmp -UseBasicParsing
  $extractDir = "$env:TEMP\node-extract"
  Remove-Item -Recurse -Force $extractDir -ErrorAction SilentlyContinue
  Expand-Archive -Path $tmp -DestinationPath $extractDir -Force
  $extracted = Get-ChildItem $extractDir -Directory | Select-Object -First 1
  Move-Item $extracted.FullName "$InstallDir\node"
  Remove-Item $tmp -Force
  Remove-Item $extractDir -Recurse -Force
}
$nodeVer = & $nodeExe --version
Write-Host "Node listo: $nodeVer"

# ── npm install (better-sqlite3 con prebuild para Win) ──
Step "4/8 Instalando dependencias (puede tardar 2-4 minutos)"
Push-Location $InstallDir
$npmCmd = "$InstallDir\node\npm.cmd"
& $npmCmd install --omit=dev --no-audit --no-fund --loglevel=error
$rc = $LASTEXITCODE
Pop-Location
if ($rc -ne 0) {
  Write-Host "ERROR: npm install fallo." -ForegroundColor Red
  exit 2
}

# ── Registro contra la nube ──
Step "5/8 Registrando este totem en la nube"
$env:DB_MODE     = "totem"
$env:TOTEM_DB_PATH = "$InstallDir\totem-data\totem.db"
$env:CLOUD_URL   = $Cloud
$registerLog = "$InstallDir\logs\register.log"
Push-Location $InstallDir
& $nodeExe "$InstallDir\totem\register.js" `
    --nombre $Nombre --casino $Casino --token $Token --cloud $Cloud `
    *>&1 | Tee-Object -FilePath $registerLog
$rc = $LASTEXITCODE
Pop-Location
if ($rc -ne 0) {
  Write-Host "ERROR: Registro fallo. Revisa $registerLog" -ForegroundColor Red
  Get-Content $registerLog | Select-Object -Last 20
  exit 3
}

# ── Script de servicio ──
Step "6/8 Creando script de arranque"
$serviceCmd = "$InstallDir\scripts\run-totem.cmd"
@"
@echo off
set DB_MODE=totem
set TOTEM_DB_PATH=$InstallDir\totem-data\totem.db
set CLOUD_URL=$Cloud
set PORT=5000
set NODE_ENV=production
cd /d "$InstallDir"
"$InstallDir\node\node.exe" "$InstallDir\totem\runtime.js" >> "$InstallDir\logs\service.out.log" 2>> "$InstallDir\logs\service.err.log"
"@ | Set-Content -Encoding ASCII $serviceCmd

# ── Tarea: servicio al arrancar el PC ──
Step "7/8 Registrando tareas programadas"
schtasks /Delete /TN "BuenaMezclaTotem" /F 2>$null | Out-Null
schtasks /Create /TN "BuenaMezclaTotem" /TR "`"$serviceCmd`"" /SC ONSTART /RU "SYSTEM" /RL HIGHEST /F | Out-Null

# ── Chrome kiosko al iniciar sesión ──
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

# ── Lanzar ahora ──
Step "8/8 Iniciando servicio y abriendo kiosko"
schtasks /Run /TN "BuenaMezclaTotem" | Out-Null
Start-Sleep -Seconds 10
Start-Process -FilePath $kioskCmd

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host " INSTALACION COMPLETADA"                          -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host " Totem:    $Nombre"
Write-Host " Carpeta:  $InstallDir"
Write-Host " Datos:    $InstallDir\totem-data\totem.db (PERSISTENTE)"
Write-Host " Logs:     $InstallDir\logs\"
Write-Host " URL:      http://127.0.0.1:5000/kiosk"
Write-Host ""
Write-Host " El servicio arrancara solo al encender el PC."
Write-Host " Chrome kiosko se abrira al iniciar sesion."
Write-Host ""
Write-Host " Funciona SIN INTERNET. Sincroniza con la nube"
Write-Host " automaticamente cuando hay conexion."
Write-Host ""
