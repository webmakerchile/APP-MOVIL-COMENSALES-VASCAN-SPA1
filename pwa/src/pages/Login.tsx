import React, { useState } from "react";
import { Eye, EyeOff, User, Lock, AlertCircle } from "lucide-react";
import { useAuth, requiresPasswordChange } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";

function formatRut(value: string): string {
  let cleaned = value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (cleaned.length > 9) cleaned = cleaned.slice(0, 9);
  if (cleaned.length <= 1) return cleaned;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  let formatted = "";
  const reversed = body.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    if (i > 0 && i % 3 === 0) formatted = "." + formatted;
    formatted = reversed[i] + formatted;
  }
  return formatted + "-" + dv;
}

function cleanRut(rut: string): string {
  return rut.replace(/\./g, "");
}

export default function Login() {
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function handleRutChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRut(formatRut(e.target.value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rut.trim() || !password.trim()) {
      setError("Ingrese RUT y contraseña");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const u = await login(cleanRut(rut.trim()), password);
      // Primer ingreso con clave por defecto → forzar cambio antes del home.
      navigate(requiresPasswordChange(u) ? "/cambiar-clave" : "/", { replace: true });
    } catch {
      setError("RUT o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-vascan-bg px-6 overflow-y-auto py-8">
      <div className="w-full max-w-sm slide-up">

        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-vascan-gold/15 border border-vascan-gold/30 flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl font-bold text-vascan-gold">V</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Bienvenido</h1>
          <p className="text-white/50 text-sm mt-1.5 leading-relaxed">
            Ingresa con tu RUT para acceder<br />al sistema de comensales
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* RUT */}
          <div className="space-y-1.5">
            <label className="text-white/60 text-xs font-medium uppercase tracking-wide pl-1">
              RUT
            </label>
            <div className="flex items-center bg-white/8 border border-white/10 rounded-xl focus-within:border-vascan-gold/50 transition-colors">
              <div className="pl-4">
                <User className="w-5 h-5 text-white/30" />
              </div>
              <input
                type="text"
                value={rut}
                onChange={handleRutChange}
                placeholder="Ej: 12.345.678-9"
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="username"
                className="flex-1 bg-transparent text-white placeholder-white/25 text-base py-4 px-3 outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-white/60 text-xs font-medium uppercase tracking-wide pl-1">
              Contraseña
            </label>
            <div className="flex items-center bg-white/8 border border-white/10 rounded-xl focus-within:border-vascan-gold/50 transition-colors">
              <div className="pl-4">
                <Lock className="w-5 h-5 text-white/30" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
                className="flex-1 bg-transparent text-white placeholder-white/25 text-base py-4 px-3 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="pr-4 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-vascan-gold hover:bg-vascan-goldDark active:scale-[0.98] disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition-all duration-150 mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Ingresando...</span>
              </>
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-white/25 text-xs">Vascan SPA</p>
          <p className="text-vascan-gold/60 text-xs mt-0.5 font-medium">Sistema de Comensales</p>
        </div>
      </div>
    </div>
  );
}
