---
name: Tótem PWA auto-updates
description: Por qué el tótem (kiosco PWA) no mostraba los cambios y cómo se fuerza la actualización
---

# El tótem no tomaba versiones nuevas (caché PWA / service worker)

**Síntoma:** Tras publicar cambios, el cliente reporta "no se hicieron los
cambios" / "sigue igual" en el tótem, aunque el deploy fue exitoso.

**Causa:** El tótem es un kiosco — la pestaña queda abierta días sin recargar.
Aunque el service worker nuevo se instale (con skipWaiting + clients.claim) y
tome control, la PÁGINA YA CARGADA sigue corriendo el bundle JS viejo en
memoria. No hay recarga, entonces el cambio nunca aparece. Bumpear CACHE_NAME y
reconstruir NO basta por sí solo.

**Solución (en `pwa/src/main.tsx`):**
- `controllerchange` → `window.location.reload()` (con guard `refreshing` para
  no entrar en loop). Recarga una vez cuando el SW nuevo toma control.
- `registration.update()` al cargar, cada 60s, y en `visibilitychange` → el
  navegador en un kiosco que nunca navega puede tardar hasta 24h en detectar
  un sw.js nuevo sin esto.
- El SW (`pwa/public/sw.js`) ya usa `self.skipWaiting()` en install y
  `self.clients.claim()` en activate; HTML va network-first y los assets con
  hash son immutable.

**Bootstrap (importante):** un tótem que corre una versión SIN esta lógica de
auto-update necesita UNA actualización manual para arrancar el mecanismo. Una
vez que corre la versión con auto-update, las futuras son automáticas.
Forzado manual confiable en el tótem: hard reload (Ctrl+Shift+R) o limpiar
datos del sitio en el navegador, luego recargar.

**Servido:** `server/index.ts` ya manda `no-store` para index.html / sw.js /
manifest, e `immutable` (max-age 1 año) para assets con hash. Eso está bien;
el problema era exclusivamente la falta de recarga en el kiosco.
