---
name: Tótem print-time session
description: En el kiosko PWA la sesión del comensal se destruye justo antes de imprimir. Reglas para fetchear datos que el ticket impreso necesita.
---

**Regla:** todo lo que el ticket impreso del tótem necesita debe estar en estado React antes de `setStep("qr")`. El `useEffect` que dispara `window.print()` no puede fetchear nada que requiera autenticación.

**Why:** cada handler que transiciona a "qr" llama `apiRequest("POST", "/api/auth/logout")` inmediatamente después de `setStep("qr")` para que el siguiente comensal en la fila parta limpio. El useEffect de impresión corre después del re-render, ya sin cookie de sesión, entonces cualquier fetch a endpoints protegidos (incluyendo `requireAdmin`, que también bloquea a `comensal`) devuelve 401.

**How to apply:** si el ticket necesita data adicional (resumen del día, contadores, etc.), llamar al fetch en el handler antes del logout y guardar el resultado en estado. El useEffect lee del estado y no fetchea. Misma lógica aplica al endpoint `marcar-impreso`, que por eso se llama explícitamente antes del logout en `selectOption` y en el flujo de visita — si no, queda sin marcarse y el comensal puede reimprimir relogueándose.
