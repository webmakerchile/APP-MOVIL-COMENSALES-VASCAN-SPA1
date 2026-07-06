---
name: Filtro por casino en listado de Usuarios (admin)
description: El filtro por casino del panel admin aplica igual a TODOS los roles (ya no solo a comensales); ver por qué cambió y cómo verificarlo.
---

# Filtro por casino en el listado de Usuarios (panel admin)

Decisión vigente (post task #29): el filtro `?casinoId=` de `GET /api/usuarios`
(`server/routes.ts`) se aplica **por igual a todos los roles** —
admin/interlocutor/encargado_casino/comensal— comparando `u.casinoId` (casino
base) y el arreglo de casinos extra (`usuario_casinos`, vía
`storage.getUserCasinoIds`). El frontend (`web/src/admin.html`, UsuariosView)
ya no filtra client-side por casino: solo pasa `?casinoId=` al backend y
filtra localmente por texto de búsqueda.

**Why:** antes el filtro se saltaba para roles de gestión (para que
interlocutor/encargado sin casino asignado no "desaparecieran"), pero eso
causaba el bug contrario: seleccionar un casino mostraba staff de OTROS
casinos o sin casino. Se decidió que es más correcto filtrar a todos por
igual y, si un interlocutor/encargado queda fuera del listado al filtrar,
es una señal real de que le falta asignación de casino (dato a corregir, no
a esconder con un filtro laxo).

**How to apply / verificar:** si se reporta que el filtro por casino muestra
staff que no debería, primero confirmar con una query SQL (casino_id +
`usuario_casinos` del usuario en cuestión) si realmente tiene ese casino
asignado (multi-casino vía tabla intermedia) antes de asumir que el filtro
está roto — históricamente el filtro ya funcionaba bien y el reporte era de
datos (asignación real) o de una screenshot tomada ANTES del deploy del fix.
Verificar con curl local (login admin + `GET /api/usuarios?casinoId=<id>`)
reproduce exactamente el comportamiento de producción.

La carga masiva (`/api/usuarios/upload`) solo asigna `casino_id` por
coincidencia exacta de nombre y NO crea filas en `usuario_casinos`; tenerlo
presente si un usuario cargado por Excel queda sin casino.

Nota aparte: el nombre de casino mostrado en la tabla (`casinos.find(c => c.id
=== u.casinoId)`) y el propio dropdown de filtro deben resolverse contra
`/api/casinos/all` (incluye inactivos), no `/api/casinos` (solo activos) —
si no, un usuario con casino asignado pero desactivado se ve con casino "—"
aunque sí tenga `casinoId` seteado, lo cual confunde el diagnóstico.
