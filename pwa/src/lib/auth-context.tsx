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
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (rut: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

  async function login(rut: string, password: string) {
    const res = await apiRequest("POST", "/api/auth/login", { rut, password });
    const data = await res.json();
    if (data.user.role !== "comensal" && data.user.role !== "interlocutor" && data.user.role !== "admin" && data.user.role !== "encargado_casino") {
      throw new Error("Rol no autorizado");
    }
    setUser(data.user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
  }

  async function logout() {
    try {
      await apiRequest("POST", "/api/auth/logout");
    } catch {}
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
