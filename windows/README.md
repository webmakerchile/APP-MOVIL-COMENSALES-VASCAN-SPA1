# BuenaMezcla Tótem — Empaquetado Windows

Esta carpeta contiene todo lo necesario para construir el instalador
`BuenaMezclaTotem-Setup.exe` que se despliega en cada PC kiosk.

## Arquitectura del tótem

Cada tótem es un PC Windows que corre, **completamente sin necesidad de
internet**, una copia local del backend de BuenaMezcla con SQLite. Cuando hay
internet, sincroniza con el cloud:

```
┌───────────────────────────────────────┐         Internet
│  PC tótem (Windows)                   │          ▲
│                                       │          │
│  ┌─────────────────────────────────┐  │   ┌──────┴──────┐
│  │ Servicio NSSM                   │  │   │  Cloud API  │
│  │  └─ node totem/runtime.js       │  │   │  (Express)  │
│  │      ├─ Express :5000           │  │   │  + Postgres │
│  │      ├─ better-sqlite3 (WAL)    │◀─┼───┤             │
│  │      └─ sync-worker (pull/push) │  │   └─────────────┘
│  └─────────────────────────────────┘  │
│                                       │
│  Chrome --kiosk → http://127.0.0.1:5000
└───────────────────────────────────────┘
```

- **Cloud → Tótem (pull, cada 30 s):** casinos, familias, usuarios, minutas y
  periodos del casino propio. Cloud-wins.
- **Tótem → Cloud (push, cada 15 s):** pedidos generados localmente, vía
  outbox transaccional. Reintenta para siempre.
- **Heartbeat (cada 60 s):** estado, IP pública/local, versión y nº de
  pedidos pendientes — visible en el panel admin → "Tótems".
- **Auto-update (cada 30 min):** consulta `/api/totem/version/latest`, baja el
  instalador, verifica SHA-256, corre `BuenaMezclaTotem-Setup.exe /SILENT` y
  reinicia el servicio.

## Build (en Windows con Node + Inno Setup instalados)

```powershell
# 1. Compilar el payload (server + totem runtime + PWA + node_modules prod)
cd windows
powershell -ExecutionPolicy Bypass -File .\build-payload.ps1

# 2. Bajar dependencias vendored (una sola vez)
#    - Node 20 portable → vendor\node\node.exe
#    - NSSM 2.24+       → vendor\nssm\nssm.exe
#    Estructuras esperadas en vendor\node\ y vendor\nssm\.

# 3. Compilar el instalador
&"C:\Program Files (x86)\Inno Setup 6\iscc.exe" installer.iss
# → BuenaMezclaTotem-Setup.exe en la raíz de windows\
```

## Despliegue en un PC nuevo

1. **En el panel admin** → Tótems → "+ Instalar nuevo tótem". Copiá el
   token (válido hasta el próximo reinicio del backend cloud).
2. **En el PC del comedor** ejecutá `BuenaMezclaTotem-Setup.exe` como
   administrador. El wizard pide:
   - URL del cloud (ej. `https://app.buenamezcla.cl`)
   - Token de instalación
   - UUID del casino (visible en el listado de Casinos)
   - Nombre del tótem (ej. `Tótem Comedor 1`)
3. El instalador:
   - Copia todo a `C:\BuenaMezcla\`
   - Llama a `POST /api/totem/register` con el token y guarda el
     `totemId` + `secret` en `totem-data\totem.db` (tabla `totem_config`)
   - Instala el servicio Windows `BuenaMezclaTotem` (NSSM)
   - Programa `BuenaMezclaTotemUpdater` (cada 30 min) y
     `BuenaMezclaTotemKiosk` (al iniciar sesión)
   - Lanza Chrome en `--kiosk http://127.0.0.1:5000`

A partir de ese momento el tótem opera **aunque se caiga internet por
días**. Toda la operación queda en SQLite y se sincroniza apenas vuelve
la conexión.

## Estructura de carpetas en el PC

```
C:\BuenaMezcla\
├── server\          backend bundle
├── totem\           runtime + sync worker + register CLI
├── shared\          schema-sqlite.sql (idempotente)
├── pwa\dist\        UI offline servida en /
├── public\          assets estáticos
├── node\            Node.js portable
├── nssm\            nssm.exe
├── scripts\         register.cmd, install-service.cmd, start-kiosk.cmd, updater.cmd
├── totem-data\      ★ PERSISTENTE — SQLite + secrets + update-pending.json
└── logs\            servicio + updater + register
```

`totem-data\` **no se borra** al desinstalar para no perder pedidos
sin sincronizar.

## Resiliencia y diagnóstico

- **Caída total de internet**: el tótem sigue operando. Los pedidos se
  acumulan en `sync_outbox` y se drenan apenas vuelve la conexión.
- **Reinicio inesperado**: NSSM relanza el servicio (5 s delay).
- **Logs**:
  - `C:\BuenaMezcla\logs\service.out.log` — stdout del runtime
  - `C:\BuenaMezcla\logs\service.err.log` — errores
  - `C:\BuenaMezcla\logs\updater.log` — auto-update
  - `C:\BuenaMezcla\logs\register.log` — registro inicial
- **Forzar pull/push**: reiniciar el servicio
  ```cmd
  net stop BuenaMezclaTotem & net start BuenaMezclaTotem
  ```
- **Ver pedidos pendientes**:
  ```cmd
  C:\BuenaMezcla\node\node.exe -e "const db=require('better-sqlite3')('C:/BuenaMezcla/totem-data/totem.db'); console.log(db.prepare('SELECT COUNT(*) c FROM sync_outbox WHERE acked=0').get())"
  ```

## Publicación de una nueva versión

1. En la PC de build: subir el número de versión, correr `build-payload.ps1`
   y compilar el `.exe` nuevo.
2. Subir el `.exe` a un bucket público (S3 / Cloudflare R2).
3. Calcular el SHA-256: `Get-FileHash BuenaMezclaTotem-Setup.exe -Algorithm SHA256`.
4. En el panel admin → Tótems → "Nueva versión":
   - Versión: `1.1.0`
   - URL: enlace público
   - SHA-256: el calculado
   - Notas, obligatoria, publicada
5. Cada tótem detectará la nueva versión en su próximo
   `checkUpdate` (≤30 min) y se actualizará solo durante la próxima
   ventana del scheduled task.
