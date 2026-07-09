---
name: Casinos nunca se hard-delete
description: Por qué el borrado de casinos debe ser siempre soft-delete (tombstone), nunca DELETE físico.
---

Los casinos tienen múltiples tablas con FK sin `onDelete: cascade` apuntando a `casinos.id`: `minutas`, `periodos`, `users`, `totems`. Un hard-delete real (`db.delete()`) falla con violación de FK apenas el casino tenga cualquier historial en alguna de esas tablas — no solo minutas/usuarios.

**Por qué:** el endpoint de borrado calculaba "hasHistory" mirando solo minutas y usuarios, así que decidía hacer hard-delete cuando el casino no tenía esas dos cosas pero sí tenía periodos o tótems asociados, y la operación fallaba con 500.

**Cómo aplicar:** el endpoint `DELETE /api/casinos/:id` siempre hace soft-delete (tombstone vía `storage.deleteCasino`), sin rama de hard-delete. El endpoint `has-history` es solo informativo (para el toast) y debe considerar minutas, usuarios, periodos y tótems.
