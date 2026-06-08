---
name: Forced password change before enrollment
description: Where/why the "cambiar clave antes de inscribirse" rule is enforced across canales
---

# Cambio de clave forzado antes de inscribirse

La regla: un usuario con `passwordChangeRequired=true` (clave por defecto) debe
cambiar su clave antes de poder inscribirse. El **super admin** (`SUPER_ADMIN_RUT`)
queda exento.

**Why:** el comensal se inscribe primero en el celular con la clave por defecto
y solo después pasa al tótem. El forcing debe ocurrir en el primer contacto real
(celular), no solo en el tótem.

**How to apply:**
- Frontend (móvil + tótem) hace el redirect a la pantalla de cambio de clave —
  es solo UX y se puede saltar con un cliente manipulado.
- La defensa REAL es server-side: los endpoints de inscripción
  (`/api/pedidos`, `/api/pedidos/semanal`) devuelven 403 si el actor de sesión
  tiene el flag activo (excepto super admin). Si agregas un nuevo endpoint de
  inscripción, replica este check ahí también.
