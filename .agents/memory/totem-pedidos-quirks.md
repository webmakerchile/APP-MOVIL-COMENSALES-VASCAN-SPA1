---
name: Tótem / pedidos índice y db:push
description: Trampas no obvias del índice único de pedidos y de drizzle-kit push en este repo
---

## Vales de visita y el índice único de pedidos
Los vales de visita se guardan con `userId = actor.id` (el staff que los emite), no un usuario por visitante. Por eso un mismo interlocutor emite MUCHAS visitas el mismo día sobre la misma minuta.

**Regla:** el índice único parcial `uniq_pedidos_user_minuta_active` sobre `pedidos(user_id, minuta_id)` DEBE excluir `tipo = 'visita'` (`WHERE deleted_at IS NULL AND tipo <> 'visita'`). Si no, la 2ª visita (o una visita después de que el staff sacó su propio vale) revienta con duplicate key → el tótem muestra "Algo salió mal".

**Why:** la dedup de unicidad solo aplica a selecciones/no_asiste de comensales (1 por minuta). Las visitas son la excepción legítima.

## drizzle-kit push borra la tabla `session`
`npm run db:push` quiere ELIMINAR la tabla `session` (la crea connect-pg-simple en runtime, no está en el schema Drizzle) → data loss + prompt interactivo que cuelga.

**How to apply:** para cambios puntuales de índice/columna, aplicar SQL crudo con `psql "$DATABASE_URL"` (DROP/CREATE) en vez de `db:push`. Nunca aceptar el drop de `session`.
