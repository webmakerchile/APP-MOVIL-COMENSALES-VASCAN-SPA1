---
name: Tótem no-inscrito y normalización de claves (marcha blanca)
description: Por qué el "algo salió mal" del no-inscrito NO es bug del tótem y cómo se normalizan las claves por casino.
---

# "Algo salió mal" del comensal no inscrito

El endpoint `/api/pedidos/auto-totem` es correcto y cubre TODAS las ramas
(verificado por reproducción end-to-end en dev): sin pedido → crea Opción 1 e
imprime; pedido válido no impreso → marca impreso; ya impreso → `already_printed`;
`no_asiste` previo → lo convierte a Opción 1 con QR. No hay bug en esa ruta.

**Por qué igual aparece "Algo salió mal":** "Algo salió mal" es la pantalla
genérica de error del tótem (`step === "error"`); debajo muestra `errMsg`. Las
causas reales en producción son de DATOS, no de código:
- **Login falla** porque la clave del comensal NO es el default de 4 dígitos del
  RUT (mismo síntoma que "los 4 dígitos no me reconoce"). Un backfill antiguo
  dejó claves inconsistentes. El comensal nunca llega a auto-totem.
- **No hay minuta del día** cargada para ese casino → "No hay menú disponible para
  hoy" bajo la pantalla "Algo salió mal" (operativo, no código).

**How to apply:** antes de tocar `auto-totem` por un reporte de "no emite vale",
descartar primero el estado de claves y la carga de minuta del día. La corrección
de raíz es normalizar las claves, no cambiar la ruta de emisión.

# Normalización de claves por casino

`POST /api/casinos/:id/reset-claves-comensales` (requireAdminOnly, botón
"Preparar marcha blanca" en el panel Casinos): restablece la clave de TODOS los
comensales activos del casino (base `casinoId` + relación `usuario_casinos`) a los
4 primeros dígitos de su RUT y marca `passwordChangeRequired=true`. Idempotente,
omite al super admin y RUTs con <4 dígitos. **Reemplaza** claves personalizadas →
acción explícita del admin, con diálogo de confirmación.

**Why:** producción ≠ dev (BD distintas) y la réplica de solo lectura no permite
escribir; por eso la normalización va por endpoint admin disparado por el usuario,
no por un backfill en el arranque (`backfillRutPasswords` quedó desactivado a
propósito porque limpiaba `passwordChangeRequired` y anulaba el cambio forzado).
El forzado de cambio ya existía (Kiosk redirige a `change_pwd` si
`passwordChangeRequired`; defensa server-side en POST /api/pedidos); el problema
era que en prod casi nadie tenía el flag en true.
