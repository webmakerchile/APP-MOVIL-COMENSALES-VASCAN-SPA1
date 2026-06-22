---
name: Filtro por casino en listado de Usuarios (admin)
description: Por qué el filtro por casino del panel admin solo debe aplicarse a comensales.
---

# Filtro por casino en el listado de Usuarios (panel admin)

El filtro por casino del listado de Usuarios (`web/src/admin.html`, componente
Usuarios) debe aplicarse **solo a comensales**. Los roles de gestión (admin,
interlocutor, encargado_casino) se muestran siempre, tengan o no un casino
asignado.

**Why:** los comensales siempre tienen un casino base, pero los interlocutores/
encargados pueden quedar sin casino (creados por formulario sin elegir casino, o
cargados por Excel cuando el nombre del casino no coincide EXACTAMENTE — el match
de carga masiva es por nombre exacto). Si el filtro por casino se les aplica
igual que a un comensal, desaparecen del listado al seleccionar un casino
concreto y parece que "solo se muestran comensales" (incidencia reportada por el
cliente). Con "Todos los casinos" sí aparecían.

**How to apply:** en el `.filter()` del listado, saltarse la comparación de
casino cuando `u.role !== 'comensal'`. La carga masiva (`/api/usuarios/upload`)
solo asigna `casino_id` por coincidencia exacta de nombre y NO crea filas en
`usuario_casinos`; tenerlo presente si se vuelve a tocar la visibilidad de staff.
