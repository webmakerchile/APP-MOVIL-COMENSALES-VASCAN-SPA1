---
name: Minuta inactiva bloquea impresión + reporte
description: Por qué una minuta de hoy en activo=false rompe el tótem y el reporte de quienes YA se inscribieron, y cómo se desacopló.
---

# Minuta de hoy desactivada → tótem no imprime ni aparece en reporte

Síntoma del cliente: "la gente ya se inscribió, el tótem dice 'No hay menú
disponible para hoy' y tampoco salen en el reporte". No faltan inscripciones:
existen los pedidos del día. El problema es que la minuta de ese día quedó
`activo=false` (se apagó/eliminó a mano en el panel DESPUÉS de inscribirse;
no hay proceso automático que las desactive — solo el soft-delete y los toggles
del admin).

**Regla:** imprimir el ticket de un pedido que YA existe NO debe depender de que
la minuta siga activa. El flag `activo` solo debe gobernar INSCRIBIR (crear un
pedido nuevo / convertir no_asiste), no CONSUMIR (imprimir lo ya inscrito).

**Why:** el `activo` se usa como "menú abierto para inscripción"; acoplarlo a la
impresión deja varadas a personas que se inscribieron cuando estaba abierto. El
mismo acoplamiento afecta el reporte de consolidación (filtra `&& m.activo`), por
eso tampoco aparecen — pero eso se resuelve reactivando la minuta en el panel
(no se tocó la semántica del reporte para no excluir minutas borradas a propósito).

**How to apply:**
- Tótem (Kiosk.tsx): separar minutas de hoy en TODAS (resolver/imprimir pedidos
  existentes, incl. inactivas) vs SOLO ACTIVAS (auto-crear). El bloqueo "sin
  menú" solo si no hay pedido del día Y no hay minuta activa.
- Backend `/api/pedidos/auto-totem`: el check `!minuta.activo → 403` va DESPUÉS
  de la rama de pedido válido existente; crear/convertir sigue exigiendo activa.
- Corrección operativa inmediata (no requiere deploy): reactivar la minuta del
  día en el panel (Minutas → "Ver desactivadas" → activar / "Activar Mes").
- Matiz vs nota previa "auto-totem NO tiene bug": era cierto para el caso
  no-inscrito (datos), pero SÍ había acoplamiento real que bloqueaba a los ya
  inscritos cuando la minuta se apagaba.
