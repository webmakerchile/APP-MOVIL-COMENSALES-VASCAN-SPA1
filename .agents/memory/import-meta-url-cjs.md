---
name: import.meta.url en código compartido cloud/tótem
description: Por qué import.meta.url a nivel de módulo revienta el boot del bundle CJS del tótem, y el patrón seguro para carga perezosa de módulos CJS como archiver.
---

# import.meta.url rompe el boot del tótem en bundle CJS

## La regla

NUNCA usar `import.meta.url` a nivel de módulo (fuera de funciones) en archivos que se compilan con `--format=cjs` (el bundle del tótem Windows).

## Por qué

esbuild con `--format=cjs` reemplaza `import.meta` por `{}`. Si a nivel de módulo hay:

```ts
const archiver = createRequire(import.meta.url)("archiver");
```

Se ejecuta `createRequire(undefined)("archiver")` al cargar el módulo, lanzando `ERR_INVALID_ARG_VALUE` antes de que el proceso pueda hacer nada útil.

El tótem compila `totem/runtime.ts` (que importa `server/routes.ts` y `server/sync-cloud.ts`) con `--format=cjs`. Cualquier `import.meta.url` a nivel de módulo en esos archivos mata el boot.

## El patrón seguro — carga perezosa

```ts
import { createRequire as _cr } from "module";
import type archiverType from "archiver";
import * as path from "path";

function loadArchiver(): typeof archiverType {
  const base =
    (typeof import.meta !== "undefined" && import.meta.url) ||
    (typeof __filename !== "undefined" ? __filename : null) ||
    path.resolve(process.cwd(), "package.json");
  return _cr(base as string)("archiver");
}
```

- `typeof import.meta !== "undefined"` → false en CJS (esbuild lo reemplaza por `{}`... pero la guarda funciona)
- Fallback a `__filename` → disponible en CJS nativamente
- Último fallback a `path.resolve(...)` → siempre funciona

La función solo se llama DENTRO de los handlers de endpoint (que en modo tótem devuelven 404 antes de llegar a este código).

## Cómo verificar

```bash
npx esbuild totem/runtime.ts --platform=node --bundle --format=cjs \
  --external:better-sqlite3 --external:fsevents --outfile=/tmp/runtime-test.js
node -e "require('/tmp/runtime-test.js')"
```

El único error esperado es `Cannot find module 'better-sqlite3'` (es --external). Cualquier `ERR_INVALID_ARG_VALUE` o crash anterior indica que hay `import.meta.url` a nivel de módulo.
