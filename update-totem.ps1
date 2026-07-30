# =============================================================================
# UPDATE-TOTEM.PS1  —  Actualización automática del Tótem BuenaMezcla
# =============================================================================
# Descarga los archivos compilados desde el servidor en la nube y reinicia
# el servicio. NO requiere npm install ni rebuild en este PC.
# Preserva la base de datos (totem-data\) y la configuración (.env).
#
# USO:
#   .\update-totem.ps1          (se auto-eleva a Administrador si es necesario)
#
# CLAVE: se toma de la variable de entorno TOTEM_UPDATE_KEY. Para dejarla fija
#   en este PC (una sola vez, como Administrador):
#     setx TOTEM_UPDATE_KEY "valor-real" /M
#   Alternativa: guardarla en C:\BuenaMezcla\update-key.txt
#   Si no encuentra ninguna de las dos, el script la pide por pantalla.
# =============================================================================

# ─── CONFIGURACIÓN (la clave NO va aqui, ver encabezado) ─────────────────────
$serverUrl  = "https://vascan.replit.app"   # URL de producción (sin / final)
$updateKey  = $env:TOTEM_UPDATE_KEY         # NO escribir la clave aqui: se toma del PC o se pide al correr
$installDir = "C:\BuenaMezcla"             # Carpeta de instalación del tótem
# ──────────────────────────────────────────────────────────────────────────────

# ─── Verificar / elevar permisos de Administrador ────────────────────────────
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Se requieren permisos de Administrador. Elevando..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$zipFile    = "$env:TEMP\totem-update.zip"
$extractDir = "$env:TEMP\totem-update-ext"

# ─── Clave de actualizacion (nunca se guarda en el repositorio) ──────────────
# Orden: variable de entorno -> archivo update-key.txt -> preguntar por pantalla.
if ([string]::IsNullOrWhiteSpace($updateKey)) {
    $keyFile = Join-Path $installDir "update-key.txt"
    if (Test-Path $keyFile) { $updateKey = (Get-Content $keyFile -Raw).Trim() }
}
if ([string]::IsNullOrWhiteSpace($updateKey)) {
    $updateKey = Read-Host "Clave de actualizacion (TOTEM_UPDATE_KEY)"
}
if ([string]::IsNullOrWhiteSpace($updateKey)) {
    Write-Host "Sin clave de actualizacion: no se puede descargar el paquete. Abortando." -ForegroundColor Red
    exit 1
}
# Escapado para la URL (por si la clave trae + & / u otros caracteres reservados)
$updateKeyUrl = [uri]::EscapeDataString($updateKey)

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
        -Uri "$serverUrl/api/totem/update-package?key=$updateKeyUrl" `
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

# Respaldo previo para poder revertir si el servicio no levanta (ver paso 4)
$bakDir = "$installDir\_backup-update"
$nmBak  = "$bakDir\node_modules"
Remove-Item $bakDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $bakDir | Out-Null
if (Test-Path "$installDir\node_modules") {
    Copy-Item "$installDir\node_modules" $nmBak -Recurse -Force -ErrorAction SilentlyContinue
}
foreach ($f in @("runtime.js", "sync-worker.js", "register.js")) {
    if (Test-Path "$installDir\totem\$f") {
        Copy-Item "$installDir\totem\$f" "$bakDir\$f" -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "   Respaldo previo en $bakDir" -ForegroundColor DarkGray

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

# better-sqlite3 + TODAS sus dependencias transitivas.
# El ZIP del servidor ya trae el arbol completo (collectDeps en routes.ts).
# Copiar solo better-sqlite3/bindings/prebuild-install dejaba fuera
# file-uri-to-path, que bindings requiere en su linea 7, y el runtime moria
# con MODULE_NOT_FOUND dejando el totem sin conexion.
$nmSrc = "$extractDir\node_modules"
if (Test-Path $nmSrc) {
    New-Item -ItemType Directory -Force -Path "$installDir\node_modules" | Out-Null
    $paquetes = Get-ChildItem $nmSrc -Directory
    foreach ($pkg in $paquetes) {
        $destino = Join-Path "$installDir\node_modules" $pkg.Name
        Remove-Item $destino -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item $pkg.FullName $destino -Recurse -Force
    }
    Write-Host "   node_modules: $($paquetes.Count) paquetes actualizados" -ForegroundColor Green
    Write-Host "   ($($paquetes.Name -join ', '))" -ForegroundColor DarkGray

    # El binario nativo debe ser PE de Windows (empieza con 'MZ'). Si el
    # servidor no logro bajar el prebuild win32-x64, el ZIP trae el .node de
    # Linux y el runtime no arranca; en ese caso se repone desde la nube.
    $bs3Node = "$installDir\node_modules\better-sqlite3\build\Release\better_sqlite3.node"
    if (Test-Path $bs3Node) {
        $firma = -join [char[]][System.IO.File]::ReadAllBytes($bs3Node)[0..1]
        if ($firma -ne "MZ") {
            Write-Host "   Binario SQLite NO es de Windows (firma: $firma). Reponiendo..." -ForegroundColor Yellow
            try {
                Invoke-WebRequest -Uri "$serverUrl/totem/bs3-win.node" -OutFile $bs3Node -UseBasicParsing
                Write-Host "   Binario Windows repuesto desde la nube" -ForegroundColor Green
            } catch {
                Write-Host "   No se pudo reponer el binario: $_" -ForegroundColor Red
            }
        } else {
            Write-Host "   Binario SQLite verificado (Windows PE)" -ForegroundColor Green
        }
    }
} else {
    Write-Host "   Advertencia: el paquete no trae node_modules" -ForegroundColor Yellow
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
    Write-Host "   El servidor NO respondio en 40s." -ForegroundColor Red
    $errLog = "$installDir\logs\service.err.log"
    if (Test-Path $errLog) {
        Write-Host "   Ultimas lineas de service.err.log:" -ForegroundColor Yellow
        Get-Content $errLog -Tail 15 | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
    }
    if (Test-Path $nmBak) {
        Write-Host "   Revirtiendo al respaldo previo..." -ForegroundColor Yellow
        schtasks /End /TN "BuenaMezclaTotem" 2>$null | Out-Null
        Start-Sleep -Seconds 3
        Remove-Item "$installDir\node_modules" -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item $nmBak "$installDir\node_modules" -Recurse -Force
        foreach ($f in @("runtime.js", "sync-worker.js", "register.js")) {
            if (Test-Path "$bakDir\$f") { Copy-Item "$bakDir\$f" "$installDir\totem\$f" -Force }
        }
        schtasks /Run /TN "BuenaMezclaTotem" | Out-Null
        Start-Sleep -Seconds 10
        Write-Host "   Respaldo restaurado: el totem vuelve al codigo anterior." -ForegroundColor Yellow
        Write-Host "   Revisa el log de arriba y reintenta cuando este corregido." -ForegroundColor Yellow
    } else {
        Write-Host "   No hay respaldo disponible para revertir." -ForegroundColor Red
    }
}

# Registrar/actualizar tarea watchdog (reinicio automático si el proceso cae)
$watchdogScript = "$installDir\scripts\watchdog.cmd"
if (Test-Path "$extractDir\scripts\watchdog.cmd") {
    New-Item -ItemType Directory -Force -Path "$installDir\scripts" | Out-Null
    Copy-Item "$extractDir\scripts\watchdog.cmd" $watchdogScript -Force
    Write-Host "   watchdog.cmd actualizado" -ForegroundColor Green
}
if (Test-Path $watchdogScript) {
    schtasks /Create /TN "BuenaMezclaWatchdog" /TR "`"$watchdogScript`"" /SC MINUTE /MO 5 /RU "SYSTEM" /RL HIGHEST /F 2>$null | Out-Null
    Write-Host "   Tarea watchdog registrada (cada 5 min)" -ForegroundColor Green
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
