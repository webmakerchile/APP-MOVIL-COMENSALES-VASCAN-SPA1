import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from "react";
import { apiRequest } from "./api";

export interface AuthUser {
  id: string;
  rut: string;
  nombre: string;
  apellido: string;
  role: string;
  casinoId: string | null;
  activo: boolean;
  passwordChangeRequired?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (rut: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// El super admin nunca es forzado a cambiar su clave.
export const SUPER_ADMIN_RUT = "21212011-1";

// Un comensal/staff con la clave por defecto debe cambiarla antes de poder
// inscribirse. El super admin queda exento.
export function requiresPasswordChange(u: AuthUser | null | undefined): boolean {
  return !!u && !!u.passwordChangeRequired && u.rut !== SUPER_ADMIN_RUT;
}

const STORAGE_KEY = "vascan_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const res = await fetch("/api/auth/me?_t=" + Date.now(), {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      } else if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } finally {
      setIsLoading(false);
    }
  }

  async function login(rut: string, password: string): Promise<AuthUser> {
    const res = await apiRequest("POST", "/api/auth/login", { rut, password });
    const data = await res.json();
    if (data.user.role !== "comensal" && data.user.role !== "interlocutor" && data.user.role !== "admin" && data.user.role !== "encargado_casino") {
      throw new Error("Rol no autorizado");
    }
    setUser(data.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
    return data.user as AuthUser;
  }

  // Cambio de clave forzado en primer ingreso: el backend NO exige la clave
  // actual cuando passwordChangeRequired=true. Al terminar, limpiamos el flag
  // en memoria + localStorage para que el guard deje pasar al home.
  async function changePassword(newPassword: string) {
    await apiRequest("POST", "/api/auth/change-password", { newPassword });
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, passwordChangeRequired: false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  async function logout() {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  const value = useMemo(
    () => ({ user, isLoading, login, logout, changePassword }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
