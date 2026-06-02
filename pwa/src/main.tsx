import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./lib/auth-context";
import { queryClient } from "./lib/query-client";
import "./index.css";

// ── Auto-actualización del tótem ────────────────────────────────────────────
// El tótem es un kiosco: la pestaña queda abierta días/semanas y NUNCA se
// recarga sola. Antes, aunque publicáramos una versión nueva, el service worker
// se quedaba esperando y la página seguía corriendo el JS viejo en memoria — por
// eso "no se hacían los cambios" en pantalla. Ahora:
//   1) Revisamos si hay versión nueva al cargar, cada minuto, y al volver a foco.
//   2) Cuando el SW nuevo toma control (controllerchange), recargamos UNA vez
//      para cargar el bundle nuevo automáticamente, sin tocar el tótem.
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const checkForUpdate = () => {
          registration.update().catch(() => {});
        };
        checkForUpdate();
        // Chequeo periódico: sin esto el navegador podría tardar hasta 24h en
        // detectar una versión nueva en un kiosco que nunca navega.
        setInterval(checkForUpdate, 60 * 1000);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate();
        });
      })
      .catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
