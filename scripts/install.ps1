# ==============================================================
#  BuenaMezcla Totem - Instalador OFFLINE (one-shot)
# ==============================================================
#  USO (PowerShell como Administrador):
#    Set-ExecutionPolicy -Scope Process Bypass -Force
#    iwr https://vascan.replit.app/totem/install.ps1 -UseBasicParsing | iex
# ==============================================================

param(
  [string] $Cloud      = "https://vascan.replit.app",
  [string] $Token      = "",
  [string] $Nombre     = "",
  [string] $InstallDir = "C:\BuenaMezcla"
)

function Step($m) { Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }
function Fail($m) {
  Write-Host ""
  Write-Host "ERROR: $m" -ForegroundColor Red
  Write-Host ""
  Write-Host "Presiona Enter para cerrar..."
  Read-Host | Out-Null
  exit 1
}

# ── Verificar Administrador ──
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Fail "Abre PowerShell como Administrador (click derecho > Ejecutar como administrador)."
}

# ── Detectar instalacion previa ──
# Si ya existe totem.db con un totem_id registrado, esto es una ACTUALIZACION:
# saltamos el pedido de token y el paso de registro (preservamos totem_id/secret).
$existingDb = "$InstallDir\totem-data\totem.db"
$IsUpdate = $false
if (Test-Path $existingDb) {
  # Heuristica: si la DB existe y pesa > 4KB asumimos que ya fue inicializada y registrada.
  # El paso de registro lee totem_id desde totem_config; si ya esta, no necesitamos token nuevo.
  $dbSize = (Get-Item $existingDb).Length
  if ($dbSize -gt 4096) {
    $IsUpdate = $true
    Write-Host ""
    Write-Host "Instalacion previa detectada en $InstallDir." -ForegroundColor Green
    Write-Host "Modo: ACTUALIZACION (se preserva totem_id, totem_secret y pedidos locales)." -ForegroundColor Green
    Write-Host ""
  }
}

# ── Pedir datos (solo si es instalacion nueva) ──
if (-not $IsUpdate) {
  if (-not $Token) {
    $Token = Read-Host "Token (del panel admin > Totems > + Instalar nuevo totem)"
  }
  if (-not $Token) { Fail "Token requerido para instalacion nueva." }

  if (-not $Nombre) {
    $def = "Totem-$($env:COMPUTERNAME)"
    $r = Read-Host "Nombre del totem (Enter = $def)"
    if ($r) { $Nombre = $r } else { $Nombre = $def }
  }
}

Step "1/8 Preparando carpetas (limpieza de instalacion previa si existe)"
# Detener tareas/procesos previos que pudieran tener archivos abiertos
schtasks /End    /TN "BuenaMezclaTotem"      2>$null | Out-Null
schtasks /End    /TN "BuenaMezclaTotemKiosk" 2>$null | Out-Null
schtasks /Delete /TN "BuenaMezclaTotem"      /F 2>$null | Out-Null
schtasks /Delete /TN "BuenaMezclaTotemKiosk" /F 2>$null | Out-Null

# Matar cualquier node.exe corriendo desde C:\BuenaMezcla (deja libre el .node de SQLite)
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($InstallDir, [System.StringComparison]::OrdinalIgnoreCase) } |
  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Seconds 2

New-Item -ItemType Directory -Force -Path $InstallDir              | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\totem-data" | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\logs"       | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\scripts"    | Out-Null

# Borrar artefactos de instalacion previa que tar no puede sobrescribir.
# OJO: NO borramos totem-data (DB local con pedidos pendientes) ni logs ni node\.
foreach ($d in @("node_modules", "totem", "shared", "public", "pwa")) {
  $p = Join-Path $InstallDir $d
  if (Test-Path $p) {
    Write-Host "  limpiando $p ..."
    Remove-Item -Recurse -Force -LiteralPath $p -ErrorAction SilentlyContinue
  }
}
foreach ($f in @("package.json", "package-lock.json")) {
  $p = Join-Path $InstallDir $f
  if (Test-Path $p) { Remove-Item -Force -LiteralPath $p -ErrorAction SilentlyContinue }
}

# ── Bajar y extraer bundle ──
Step "2/8 Descargando bundle (~500KB)"
$bundleTmp = "$env:TEMP\totem-bundle.tar.gz"
try {
  Invoke-WebRequest -Uri "$Cloud/totem/totem-bundle.tar.gz" -OutFile $bundleTmp -UseBasicParsing
} catch {
  Fail "No se pudo descargar el bundle. Verifica la conexion a internet. Detalle: $_"
}
Write-Host "Extrayendo..."
tar -xzf $bundleTmp -C $InstallDir 2>&1
if ($LASTEXITCODE -ne 0) { Fail "Error extrayendo bundle. Si el problema persiste, cierra cualquier ventana de Chrome del totem y vuelve a ejecutar el instalador." }
Remove-Item $bundleTmp -Force

# ── Node.js portable ──
Step "3/8 Verificando Node.js"
$nodeExe = "$InstallDir\node\node.exe"
if (-not (Test-Path $nodeExe)) {
  Write-Host "Descargando Node.js 20 portable (~30MB, solo la primera vez)..."
  $nodeTmp  = "$env:TEMP\node-portable.zip"
  $nodeDir  = "$env:TEMP\node-extract"
  try {
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip" -OutFile $nodeTmp -UseBasicParsing
  } catch {
    Fail "No se pudo descargar Node.js. Detalle: $_"
  }
  Remove-Item -Recurse -Force $nodeDir -ErrorAction SilentlyContinue
  Expand-Archive -Path $nodeTmp -DestinationPath $nodeDir -Force
  $extracted = Get-ChildItem $nodeDir -Directory | Select-Object -First 1
  Move-Item $extracted.FullName "$InstallDir\node"
  Remove-Item $nodeTmp -Force
  Remove-Item $nodeDir  -Recurse -Force -ErrorAction SilentlyContinue
}
$nodeVer = & $nodeExe --version 2>&1
Write-Host "Node listo: $nodeVer"

# ── npm install solo better-sqlite3 (solo su JS wrapper, sin compilar) ──
Step "4/8 Instalando paquete SQLite (~10 segundos)"
$npmCmd = "$InstallDir\node\npm.cmd"
Push-Location $InstallDir
$npmOut = & $npmCmd install --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=warn 2>&1
$npmRc  = $LASTEXITCODE
Pop-Location
if ($npmRc -ne 0) {
  Write-Host ($npmOut | Out-String) -ForegroundColor Yellow
  Fail "npm install fallo (codigo $npmRc). Revisa la salida de arriba."
}
Write-Host "Paquete instalado."

# ── Prebuild nativo de better-sqlite3 para Windows ──
Step "4b/8 Bajando modulo nativo SQLite para Windows (~2MB)"
$bs3Dir = "$InstallDir\node_modules\better-sqlite3\build\Release"
New-Item -ItemType Directory -Force -Path $bs3Dir | Out-Null
try {
  Invoke-WebRequest -Uri "$Cloud/totem/bs3-win.node" -OutFile "$bs3Dir\better_sqlite3.node" -UseBasicParsing
  Write-Host "Modulo SQLite listo."
} catch {
  Fail "No se pudo bajar el modulo SQLite nativo. Detalle: $_"
}

# ── Registro contra la nube ──
$env:DB_MODE        = "totem"
$env:TOTEM_DB_PATH  = "$InstallDir\totem-data\totem.db"
$env:CLOUD_URL      = $Cloud
if ($IsUpdate) {
  Step "5/8 Saltando registro (actualizacion: se preserva totem_id existente)"
} else {
  Step "5/8 Registrando totem en la nube"
  $regLog = "$InstallDir\logs\register.log"
  Push-Location $InstallDir
  $regOut = & $nodeExe "$InstallDir\totem\register.js" --nombre $Nombre --token $Token --cloud $Cloud 2>&1
  $regRc  = $LASTEXITCODE
  Pop-Location
  $regOut | Tee-Object -FilePath $regLog | Write-Host
  if ($regRc -ne 0) {
    Fail "Registro fallo. El token puede estar expirado o ya fue usado. Genera uno nuevo en el panel admin."
  }
}

# ── Script arranque del servicio ──
Step "6/8 Creando scripts de arranque"
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

$kioskCmd = "$InstallDir\scripts\start-kiosk.cmd"
@"
@echo off
set "URL=http://127.0.0.1:5000/kiosk"
set "PROFILE=%LOCALAPPDATA%\BuenaMezclaTotem\ChromeProfile"
mkdir "%PROFILE%" >nul 2>&1
set /a tries=0
:waitloop
powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:5000/api/auth/me').StatusCode|Out-Null;exit 0}catch{exit 1}" >nul 2>&1
if %ERRORLEVEL%==0 goto launch
set /a tries+=1
if %tries% GEQ 30 goto launch
timeout /t 2 /nobreak >nul
goto waitloop
:launch
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%CHROME%" (
  start "" "%CHROME%" --kiosk --kiosk-printing --no-first-run --noerrdialogs --disable-translate --disable-pinch --user-data-dir="%PROFILE%" "%URL%"
) else (
  set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  if exist "%EDGE%" start "" "%EDGE%" --kiosk --kiosk-printing "%URL%" --edge-kiosk-type=fullscreen --no-first-run
)
"@ | Set-Content -Encoding ASCII $kioskCmd

# ── Tareas programadas ──
Step "7/8 Registrando tareas de inicio automatico"
schtasks /Delete /TN "BuenaMezclaTotem"      /F 2>$null | Out-Null
schtasks /Delete /TN "BuenaMezclaTotemKiosk" /F 2>$null | Out-Null
schtasks /Create /TN "BuenaMezclaTotem"      /TR "`"$serviceCmd`"" /SC ONSTART  /RU "SYSTEM" /RL HIGHEST /F | Out-Null
schtasks /Create /TN "BuenaMezclaTotemKiosk" /TR "`"$kioskCmd`""   /SC ONLOGON  /RL HIGHEST  /F | Out-Null

# ── Lanzar ahora ──
Step "8/8 Iniciando servicio"
schtasks /Run /TN "BuenaMezclaTotem" 2>&1 | Out-Null
Write-Host "Esperando que el servidor arranque..."
Start-Sleep -Seconds 12

$ok = $false
for ($i=0; $i -lt 10; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:5000/api/auth/me" -ErrorAction Stop
    $ok = $true; break
  } catch { Start-Sleep -Seconds 2 }
}

if ($ok) {
  Write-Host "Servidor OK. Abriendo kiosko..." -ForegroundColor Green
  Start-Process -FilePath $kioskCmd
} else {
  Write-Host "El servidor todavia no responde. Revisando log..." -ForegroundColor Yellow
  $errLog = "$InstallDir\logs\service.err.log"
  if (Test-Path $errLog) { Get-Content $errLog | Select-Object -Last 20 }
}

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host " INSTALACION COMPLETADA"                          -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host " Totem:   $Nombre"
Write-Host " Carpeta: $InstallDir"
Write-Host " URL:     http://127.0.0.1:5000/kiosk"
Write-Host " Logs:    $InstallDir\logs\"
Write-Host ""
Write-Host " Al reiniciar el PC el servicio arranca solo."
Write-Host " Chrome kiosko se abre al iniciar sesion."
Write-Host ""
Write-Host "Presiona Enter para cerrar este instalador."
Read-Host | Out-Null
