# =============================================================================
# UPDATE-TOTEM.PS1  —  Actualización automática del Tótem BuenaMezcla
# =============================================================================
# Descarga los archivos compilados desde el servidor en la nube y reinicia
# el servicio. NO requiere npm install ni rebuild en este PC.
# Preserva la base de datos (totem-data\) y la configuración (.env).
#
# USO:
#   .\update-totem.ps1
#
# Ejecutar como Administrador si schtasks requiere permisos elevados.
# =============================================================================

# ─── CONFIGURACIÓN (edita estas 3 variables) ──────────────────────────────────
$serverUrl  = "https://app.buenamezcla.cl"  # URL de producción (sin / final)
$updateKey  = "TU-CLAVE-SECRETA"            # Valor de TOTEM_UPDATE_KEY (o SESSION_SECRET) en Replit Secrets
$installDir = "C:\BuenaMezcla"             # Carpeta de instalación del tótem
# ──────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$zipFile    = "$env:TEMP\totem-update.zip"
$extractDir = "$env:TEMP\totem-update-ext"

Write-Host ""
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  ACTUALIZACION TOTEM BUENAMEZCLA" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Detener servicio y Chrome
Write-Host "[1/5] Deteniendo servicio y Chrome..." -ForegroundColor Yellow
schtasks /End /TN "BuenaMezclaTotemKiosk" 2>$null | Out-Null
schtasks /End /TN "BuenaMezclaTotem"      2>$null | Out-Null
Stop-Process -Name "chrome" -ErrorAction SilentlyContinue
Stop-Process -Name "msedge" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 5
Write-Host "   OK" -ForegroundColor Green

# 2. Descargar paquete de actualización
Write-Host "[2/5] Descargando actualizacion desde $serverUrl ..." -ForegroundColor Yellow
try {
    Invoke-WebRequest `
        -Uri "$serverUrl/api/totem/update-package?key=$updateKey" `
        -OutFile $zipFile `
        -UseBasicParsing
    $sizeMB = [Math]::Round((Get-Item $zipFile).Length / 1MB, 2)
    Write-Host "   Descargado: $sizeMB MB" -ForegroundColor Green
} catch {
    Write-Host "ERROR al descargar: $_" -ForegroundColor Red
    Write-Host "Verifica que la URL ($serverUrl) y la clave sean correctas." -ForegroundColor Red
    exit 1
}

# 3. Extraer y reemplazar archivos (sin tocar totem-data ni node)
Write-Host "[3/5] Instalando archivos nuevos..." -ForegroundColor Yellow
Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

# pwa\dist — interfaz del tótem
if (Test-Path "$extractDir\pwa\dist") {
    Remove-Item "$installDir\pwa\dist" -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path "$installDir\pwa" | Out-Null
    Copy-Item "$extractDir\pwa\dist" "$installDir\pwa\dist" -Recurse -Force
    Write-Host "   pwa\dist actualizado" -ForegroundColor Green
}

# totem\runtime.js — servidor + runtime (bundle autocontenido)
if (Test-Path "$extractDir\totem\runtime.js") {
    New-Item -ItemType Directory -Force -Path "$installDir\totem" | Out-Null
    Copy-Item "$extractDir\totem\runtime.js"     "$installDir\totem\runtime.js"     -Force
    Write-Host "   totem\runtime.js actualizado" -ForegroundColor Green
}
if (Test-Path "$extractDir\totem\sync-worker.js") {
    Copy-Item "$extractDir\totem\sync-worker.js" "$installDir\totem\sync-worker.js" -Force
    Write-Host "   totem\sync-worker.js actualizado" -ForegroundColor Green
}
if (Test-Path "$extractDir\totem\register.js") {
    Copy-Item "$extractDir\totem\register.js"    "$installDir\totem\register.js"    -Force
    Write-Host "   totem\register.js actualizado" -ForegroundColor Green
}

# better-sqlite3 paquete completo + binario Windows (Node 20)
if (Test-Path "$extractDir\node_modules\better-sqlite3") {
    Remove-Item "$installDir\node_modules\better-sqlite3" -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path "$installDir\node_modules" | Out-Null
    Copy-Item "$extractDir\node_modules\better-sqlite3" "$installDir\node_modules\better-sqlite3" -Recurse -Force
    Write-Host "   better-sqlite3 paquete + binario Windows actualizado" -ForegroundColor Green
}
if (Test-Path "$extractDir\node_modules\bindings") {
    Copy-Item "$extractDir\node_modules\bindings" "$installDir\node_modules\bindings" -Recurse -Force
    Write-Host "   bindings actualizado" -ForegroundColor Green
}
if (Test-Path "$extractDir\node_modules\prebuild-install") {
    Copy-Item "$extractDir\node_modules\prebuild-install" "$installDir\node_modules\prebuild-install" -Recurse -Force
    Write-Host "   prebuild-install actualizado" -ForegroundColor Green
}

# 4. Reiniciar servicio Node
Write-Host "[4/5] Iniciando servicio..." -ForegroundColor Yellow
schtasks /Run /TN "BuenaMezclaTotem" | Out-Null
Write-Host "   Esperando que el servidor responda..." -ForegroundColor Yellow

$tries = 0
$ok = $false
while ($tries -lt 20 -and -not $ok) {
    Start-Sleep -Seconds 2
    $tries++
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:5000/api/auth/me" `
                               -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        $ok = $true
    } catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 401) {
            $ok = $true   # 401 = servidor corriendo (solo no autenticado)
        }
    }
}

if ($ok) {
    Write-Host "   Servidor OK (listo en $($tries * 2)s)" -ForegroundColor Green
} else {
    Write-Host "   Advertencia: servidor tardando, abriendo tótem igual..." -ForegroundColor Yellow
}

# 5. Abrir Chrome en modo kiosk
Write-Host "[5/5] Abriendo totem..." -ForegroundColor Yellow
$kioskCmd = "$installDir\scripts\start-kiosk.cmd"
if (Test-Path $kioskCmd) {
    Start-Process -FilePath $kioskCmd
} else {
    # Fallback directo si el script de kiosk no existe
    $chromeExe = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $chromeExe)) {
        $chromeExe = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    }
    if (Test-Path $chromeExe) {
        & $chromeExe --kiosk --kiosk-printing --no-first-run --noerrdialogs `
            --disable-translate --disable-pinch `
            --user-data-dir="$env:LOCALAPPDATA\BuenaMezclaTotem\ChromeProfile" `
            "http://127.0.0.1:5000/kiosk"
    } else {
        Write-Host "   Chrome no encontrado. Abre http://127.0.0.1:5000/kiosk manualmente." -ForegroundColor Yellow
    }
}

# Limpieza
Remove-Item $zipFile    -Force -ErrorAction SilentlyContinue
Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=================================================" -ForegroundColor Green
Write-Host "  TOTEM ACTUALIZADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""
