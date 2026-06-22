---
name: Producción vs Dev son BD distintas
description: La BD del workspace NO es la de producción; cómo consultar prod y qué modelo de inscripción asumir al diagnosticar incidentes.
---

# Producción y desarrollo usan bases de datos SEPARADAS

El workspace (executeSql por defecto / DATABASE_URL local) apunta a una BD de
**prueba** (casinos "Test UUID Final", "X", comensales sin casino, sin "Union
Quimica"). La BD **real** del cliente vive en producción (vascan.replit.app).

**Cómo consultar producción (solo lectura, réplica):**
`executeSql({ sqlQuery, environment: "production" })`. Solo SELECT. Puede tener
lag de replicación de segundos/minutos para escrituras muy recientes.

**Para descartar "volví a una versión anterior":** descargar el bundle desplegado
(`curl https://<app>/assets/index-*.js`) y `rg` por strings conocidos del código
actual (ej. `auto-totem`, `minutas-disponibles`, `change-password`). El header
`last-modified` del asset indica cuándo se publicó. El build de deploy en `.replit`
SÍ reconstruye la PWA (`vite build --config pwa/vite.config.ts`), así que prod
siempre refleja el código fuente al momento de publicar.

# Modelo de inscripción (clave para diagnósticos del tótem)

**Why:** los síntomas "no están inscritos / algunos emiten y otros no" casi siempre
son DATOS, no bugs de código.

- La inscripción semanal (móvil/PWA Home, `POST /api/pedidos`) **exige periodo
  activo y vigente**. La ventana típicamente cierra ANTES de la semana de servicio
  (ej: inscripción 15–20 jun para servicio 22–26 jun). Cerrada la ventana, nadie
  más puede inscribirse → 403 "Fuera del horario de inscripción".
- El **tótem** (`POST /api/pedidos/auto-totem`) NO exige periodo: auto-crea opción 1
  para el menú de HOY. Es la vía para el no-inscrito durante el servicio.
- `passwordChangeRequired=true` NO bloquea el login: redirige a "Crea tu clave".
  El usuario lo percibe como "la contraseña no funciona". Clave por defecto =
  primeros 4 dígitos del RUT.

**How to apply:** ante un incidente, consultar en PROD: minutas activas por casino
para HOY, periodos vigentes por casino, comensales con password_change_required, y
RUTs duplicados. Reproducir el flujo del tótem con curl (login → GET /api/minutas/:casino
→ GET /api/pedidos/:user) sin escribir.
