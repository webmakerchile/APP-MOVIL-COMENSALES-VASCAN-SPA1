---
name: Chile timezone for "today"
description: Why "today" must be computed in America/Santiago, not UTC, across this casino app
---

# "Hoy" debe calcularse en hora de Chile, no UTC

**Regla:** Cualquier noción de "hoy" (fecha del día para menú/minuta/resumen del
tótem) debe calcularse en `America/Santiago`, NO con `new Date().toISOString()`.

**Why:** Chile es UTC-4/-3. Después de ~20:00 hora Chile, `toISOString()` ya
devuelve la fecha del día siguiente. El tótem entonces consultaba minutas de
"mañana", no encontraba ninguna, y: (1) el "Resumen del día" salía en cero /
"no hay menú para hoy", y (2) `todayMinutas.length===0` deshabilitaba los
botones "Vale propio" y "Vale visita". Síntoma clásico de reporte de fin de día.

**How to apply:**
- Frontend tótem: helper `todayISO()` en `pwa/src/pages/Kiosk.tsx`.
- Backend: helper `todayChile()` en `server/routes.ts` (usar para todos los
  defaults de "hoy": dashboard stats, auto-totem checkFecha fallback,
  buscar/por-rut, resumen-dia, reporte diario manual).
- Ambos usan `Intl.DateTimeFormat("en-CA", {timeZone:"America/Santiago", ...})`
  con `formatToParts` para armar `YYYY-MM-DD` de forma determinista.
- El backend confía en la `fecha` que envía el cliente para varios flujos del
  tótem (auto-totem, resumen, reimpresión); por eso el fix del frontend es el
  que realmente importa, y los defaults del backend son defensa en profundidad.
- `server/cron.ts` quedó en UTC a propósito (corre 03:00/04:00 UTC para cubrir
  ambos offsets DST de Chile); no tocar sin reconsiderar su scheduling.
