import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth-context";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Historial from "./pages/Historial";
import Kiosk from "./pages/Kiosk";
import InstallPrompt from "./components/InstallPrompt";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function LoadingScreen() {
  return (
    <div className="h-full flex items-center justify-center bg-vascan-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-vascan-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-white/40 text-sm">Cargando...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <InstallPrompt />
      <Routes>
        {/* Kiosk: vista táctil dedicada para el tótem físico. No usa el
            AuthProvider global porque mantiene su propio ciclo (login →
            selección → vale → auto-logout) optimizado para uso compartido. */}
        <Route path="/kiosk" element={<Kiosk />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/historial"
          element={
            <ProtectedRoute>
              <Historial />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
