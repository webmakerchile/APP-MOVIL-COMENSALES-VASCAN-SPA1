# Builds the payload directory consumed by Inno Setup.
# Run from the windows\ folder:   powershell -ExecutionPolicy Bypass -File .\build-payload.ps1
#
# Output:
#   windows\payload\
#     server\        compiled backend bundle (esbuild)
#     totem\         compiled totem runtime + register CLI
#     shared\        SQLite DDL bootstrap script
#     pwa\dist\      compiled PWA (served as fallback offline UI for the totem)
#     public\        static assets
#     package.json   runtime manifest with prod deps
#     node_modules\  installed prod deps (better-sqlite3 + drizzle + pg-noop deps)
#
# Then compile the .iss file with `iscc installer.iss` to get
# BuenaMezclaTotem-Setup.exe.

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."
$payload = "$PSScriptRoot\payload"

Remove-Item -Recurse -Force $payload -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $payload | Out-Null

Push-Location $root

Write-Host "== Bundling backend with esbuild =="
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=cjs --outfile="$payload\server\index.js"

Write-Host "== Bundling totem runtime =="
npx esbuild totem/runtime.ts --platform=node --packages=external --bundle --format=cjs --outfile="$payload\totem\runtime.js"
npx esbuild totem/register.ts --platform=node --packages=external --bundle --format=cjs --outfile="$payload\totem\register.js"
npx esbuild totem/sync-worker.ts --platform=node --packages=external --bundle --format=cjs --outfile="$payload\totem\sync-worker.js"

Write-Host "== Copying SQLite DDL =="
New-Item -ItemType Directory -Force -Path "$payload\shared" | Out-Null
Copy-Item shared\schema-sqlite.sql "$payload\shared\schema-sqlite.sql"

Write-Host "== Building PWA (offline UI for the totem) =="
npx vite build --config pwa/vite.config.ts --outDir "$payload\pwa\dist" --emptyOutDir

Write-Host "== Copying public/ assets =="
Copy-Item -Recurse public "$payload\public"

Write-Host "== Copying scripts/ =="
New-Item -ItemType Directory -Force -Path "$payload\scripts" | Out-Null
Copy-Item "$PSScriptRoot\scripts\*" "$payload\scripts\" -Recurse

Write-Host "== Writing minimal package.json =="
@'
{
  "name": "buenamezcla-totem",
  "version": "1.0.0",
  "private": true,
  "main": "totem/runtime.js",
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "drizzle-orm": "^0.36.0",
    "express": "^4.21.0",
    "express-session": "^1.18.0",
    "connect-pg-simple": "^10.0.0",
    "bcryptjs": "^2.4.3",
    "multer": "^1.4.5-lts.1",
    "xlsx": "^0.18.5",
    "exceljs": "^4.4.0"
  }
}
'@ | Set-Content "$payload\package.json"

Push-Location $payload
Write-Host "== Installing production deps =="
npm install --omit=dev --no-audit --no-fund
Pop-Location

Pop-Location

Write-Host "== Done. Run: iscc $PSScriptRoot\installer.iss =="
