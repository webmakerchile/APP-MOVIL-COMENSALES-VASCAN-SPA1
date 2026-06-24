---
name: RUT canonicalization & tolerant lookup
description: Por qué los RUT se guardan canónicos y getUserByRut es tolerante; regla ante duplicados.
---

# RUT canónico + búsqueda tolerante

Los comensales se cargan masivamente desde Excel y llegan con el RUT mal
formateado: con puntos, sin guion, o con dígito verificador `k` en minúscula.
Si se guarda crudo y el login compara por string exacto, esos usuarios no
pueden iniciar sesión ni inscribirse (síntoma reportado: "los con K no se
pueden inscribir").

**Regla:** el backend escribe SIEMPRE el RUT en forma canónica `12345678-K`
(sin puntos, con guion, DV en mayúscula) en create/update, y `getUserByRut`
es tolerante al formato de entrada y del dato almacenado (3 pasos: canónico
exacto → crudo exacto → fallback que compara dígitos+DV ignorando formato).

**Why:** datos legados ya están guardados en formatos inconsistentes; el
fallback los auto-sana sin migrar la BD.

**How to apply:**
- No reintroducir comparaciones de RUT por igualdad de string cruda en rutas
  de auth/inscripción; usar siempre `getUserByRut`.
- El fallback NO debe elegir "el primero" si hay >1 match canónico: lanza error
  explícito de RUT ambiguo. Autenticar contra una cuenta al azar sería un
  agujero de identidad. El login lo captura y responde 500 genérico; el detalle
  queda en logs para que un admin sanee el duplicado.
- No hay índice único sobre RUT normalizado en la BD; si en el futuro aparecen
  duplicados canónicos, sanearlos antes de añadir esa restricción.

**404 en "Cambio de clave" del tótem (reset-password-by-rut) para un comensal
que SÍ existe = RUT mal cargado, no falta de usuario ni bug de código.** El
buscador tolera formato pero no puede emparejar dígitos distintos: si el RUT
guardado tiene un dígito cambiado respecto al de la cédula, la persona escribe
su RUT real y recibe 404. No es "usuario no existe" (error que cometí antes):
el usuario existe bajo un RUT con typo de la carga masiva. Fix = corregir el
dato (RUT real de la cédula), no tocar el lookup. Confirmar el RUT con el
cliente antes de escribir; no adivinar (dos RUT que difieren un dígito pueden
tener ambos DV válidos, p.ej. 29283727-5 vs 29283227-3).
