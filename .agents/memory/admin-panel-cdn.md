---
name: Admin panel runs on in-browser Babel from CDN
description: El panel /admin transpila JSX en el navegador con CDNs sin pin; riesgo de romperse "de un día para otro".
---

# Panel /admin: React + Babel en el navegador vía CDN

`web/src/admin.html` es un único HTML estático (servido tal cual, sin build)
que carga React 18 UMD, ReactDOM 18 UMD, `@babel/standalone` y Tailwind desde
CDN, y transpila TODO el JSX en el navegador dentro de un
`<script type="text/babel" data-type="module">`.

**Incidente:** la pantalla quedó en negro sin tocar el archivo. Causa: el CDN
servía `@babel/standalone` como "latest" sin versión fija; al publicarse Babel 8
(que cambia el runtime de JSX a *automático*), el código transpilado emitía
`import { jsx } from "react/jsx-runtime"`, que el navegador no puede resolver sin
bundler → la app React nunca montó.

**Regla:** mantener `@babel/standalone` PINNEADO a una versión 7.x (runtime
clásico = `React.createElement`, que usa el global UMD `React`). No volver a
referenciar el CDN sin versión.

**Why:** sin pin, cualquier release mayor del CDN puede romper producción de un
día para otro, y el panel no tiene build/CI que lo detecte.

**How to apply:**
- Si /admin vuelve a quedar en negro, revisar PRIMERO la consola del navegador:
  un `Failed to resolve module specifier "react/jsx-runtime"` confirma este caso.
- Las demás dependencias CDN (Tailwind, fuentes) tienen el mismo riesgo latente;
  si fallan igual, considerar pinnearlas o migrar el panel a un build real.
