---
name: Tótem installer production domain
description: Which domain is the real BuenaMezcla cloud URL, and why several installer scripts still had a stale one.
---
El dominio de producción real del cloud BuenaMezcla es `https://app.buenamezcla.cl` (es el default en `totem/register.ts`, `totem/sync-worker.ts` y en `windows/installer.iss`/`windows/README.md`).

Varios scripts de instalación/actualización más viejos (`update-totem.ps1`, `scripts/install.ps1`, `public/totem/install.ps1`) todavía tienen `https://vascan.replit.app` hardcodeado como placeholder — es un remanente de un dominio anterior que nunca se actualizó, no una fuente de verdad alternativa.

**Por qué importa:** si se toca cualquier instalador/actualizador del tótem y aparece `vascan.replit.app`, es casi seguro un bug a corregir a `app.buenamezcla.cl`, no una decisión intencional.

**Cómo aplicar:** al tocar cualquier script de instalación del tótem, verificar `$serverUrl`/`$Cloud`/`CLOUD_URL` contra `app.buenamezcla.cl`. `scripts/install.ps1`, `public/totem/install.ps1` y `update-totem.ps1` todavía no se corrigieron (fuera de alcance de la tarea que generó esta nota) — quedó una tarea de seguimiento propuesta para limpiarlos.
