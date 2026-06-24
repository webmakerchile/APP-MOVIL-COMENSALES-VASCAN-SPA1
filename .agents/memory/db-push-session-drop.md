---
name: db:push quiere borrar la tabla session
description: Por qué npm run db:push amenaza con DATA LOSS sobre session y cómo agregar columnas sin riesgo.
---

`npm run db:push` (drizzle-kit) propone **borrar la tabla `session`** (DATA LOSS, ~23 items) porque esa tabla la crea `connect-pg-simple` en runtime y **no está declarada en `shared/schema.ts`**. Drizzle, al no verla en el schema, la considera "sobrante" y quiere eliminarla.

**Regla:** nunca confirmar ese prompt. Para cambios aditivos simples (agregar una columna nullable), aplicar el cambio con **SQL directo** en vez de `db:push`:

```
psql "$DATABASE_URL" -c "ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS gestion_estado text;"
```

Mantener igualmente la columna declarada en `shared/schema.ts` para que el ORM la conozca; el ALTER sólo evita el push destructivo.

**Why:** el push interactivo amenaza con tirar la sesión de todos los usuarios logueados; SQL directo es no-destructivo y quirúrgico.

**How to apply:** ante cualquier columna nueva, preferir ALTER TABLE ... ADD COLUMN IF NOT EXISTS. Sólo usar `db:push` si se acepta el riesgo o si previamente se incorpora `session` al schema para que drizzle deje de querer borrarla.
