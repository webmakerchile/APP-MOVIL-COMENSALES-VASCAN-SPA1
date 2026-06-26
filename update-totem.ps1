# =============================================================================
# UPDATE-TOTEM.PS1 — Actualización automática del Tótem BuenaMezcla
# =============================================================================
# Descarga los archivos compilados desde el servidor en la nube y reinicia.
# NO requiere npm install ni rebuild en este PC.
#
# USO:
#   .\update-totem.ps1
#
# PRIMERA VEZ: edita las 3 variables de la sección CONFIGURACIÓN.
# =============================================================================

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
$serverUrl  = "https://TU-APP.replit.app"          # URL de producción (sin / final)
$updateKey  = "TU-CLAVE-SECRETA"                   # Valor de TOTEM_UPDATE_KEY en Replit Secrets
$projectDir = "C:\BuenaMezclaTotem"                # Carpeta raíz del proyecto en este PC
# ──────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$zipFile = "$env:TEMP\totem-update.zip"
$extractDir = "$env:TEMP\totem-update-extracted"

Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  ACTUALIZACION TOTEM BUENAMEZCLA" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# 1. Detener Chrome y el servidor Node
Write-Host "[1/5] Deteniendo Chrome y servidor..." -ForegroundColor Yellow
Stop-Process -Name "chrome" -ErrorAction SilentlyContinue
Stop-Process -Name "node"   -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# 2. Descargar el paquete de actualización
Write-Host "[2/5] Descargando actualizacion desde $serverUrl ..." -ForegroundColor Yellow
try {
    Invoke-WebRequest `
        -Uri "$serverUrl/api/totem/update-package?key=$updateKey" `
        -OutFile $zipFile `
        -UseBasicParsing
    Write-Host "      Descarga OK ($([Math]::Round((Get-Item $zipFile).Length / 1MB, 2)) MB)" -ForegroundColor Green
} catch {
    Write-Host "ERROR al descargar: $_" -ForegroundColor Red
    Write-Host "Verifica que la URL y la clave sean correctas." -ForegroundColor Red
    exit 1
}

# 3. Extraer y reemplazar archivos compilados
Write-Host "[3/5] Instalando archivos nuevos..." -ForegroundColor Yellow
Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -Path $zipFile -DestinationPath $extractDir -Force

# Reemplazar pwa/dist y server_dist
Remove-Item "$projectDir\pwa\dist"   -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$projectDir\server_dist" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$extractDir\pwa\dist"    "$projectDir\pwa\dist"    -Recurse -Force
Copy-Item "$extractDir\server_dist" "$projectDir\server_dist" -Recurse -Force

Write-Host "      Archivos reemplazados OK" -ForegroundColor Green

# 4. Iniciar el servidor
Write-Host "[4/5] Iniciando servidor..." -ForegroundColor Yellow
Start-Process "node" -ArgumentList "$projectDir\server_dist\index.js" -WindowStyle Hidden
Start-Sleep -Seconds 5

# Verificar que el servidor responde
try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:5000/api/auth/me" -UseBasicParsing -ErrorAction Stop
    Write-Host "      Servidor OK" -ForegroundColor Green
} catch {
    # 401 es respuesta válida (no autenticado), el servidor está corriendo
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "      Servidor OK" -ForegroundColor Green
    } else {
        Write-Host "      Advertencia: servidor tardando en responder, esperando..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

# 5. Abrir Chrome en modo kiosk
Write-Host "[5/5] Abriendo totem..." -ForegroundColor Yellow
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
    --kiosk --kiosk-printing --no-first-run --noerrdialogs `
    --disable-translate --disable-pinch `
    --user-data-dir="$env:LOCALAPPDATA\BuenaMezclaTotem\ChromeProfile" `
    "http://127.0.0.1:5000/kiosk"

# Limpieza
Remove-Item $zipFile    -Force -ErrorAction SilentlyContinue
Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Totem actualizado correctamente." -ForegroundColor Green
Write-Host ""
