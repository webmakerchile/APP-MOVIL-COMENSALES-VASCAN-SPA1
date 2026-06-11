import React, { useState } from "react";
import { Eye, EyeOff, Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";

export default function CambiarClave() {
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 4) {
      setError("La clave debe tener al menos 4 caracteres");
      return;
    }
    if (newPwd !== confirmPwd) {
      setError("Las claves no coinciden");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await changePassword(newPwd);
      navigate("/", { replace: true });
    } catch (err: any) {
      const msg = String(err?.message || "").trim();
      setError(msg ? `No se pudo cambiar la clave: ${msg}` : "No se pudo cambiar la clave");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="h-full flex flex-col items-center justify-center bg-vascan-bg px-6 overflow-y-auto py-8">
      <div className="w-full max-w-sm slide-up">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-vascan-gold/15 border border-vascan-gold/30 flex items-center justify-center mx-auto mb-5">
            <ShieldCheck className="w-9 h-9 text-vascan-gold" />
          </div>
          <h1 className="text-2xl font-bold text-white">Crea tu clave</h1>
          <p className="text-white/50 text-sm mt-1.5 leading-relaxed">
            {user?.nombre ? `Hola ${user.nombre}, ` : ""}por seguridad debes
            <br />cambiar tu clave antes de continuar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {error && (
            <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Nueva clave */}
          <div className="space-y-1.5">
            <label className="text-white/60 text-xs font-medium uppercase tracking-wide pl-1">
              Nueva clave
            </label>
            <div className="flex items-center bg-white/8 border border-white/10 rounded-xl focus-within:border-vascan-gold/50 transition-colors">
              <div className="pl-4">
                <Lock className="w-5 h-5 text-white/30" />
              </div>
              <input
                type={showPwd ? "text" : "password"}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                autoComplete="new-password"
                className="flex-1 bg-transparent text-white placeholder-white/25 text-base py-4 px-3 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="pr-4 text-white/30 hover:text-white/60 transition-colors"
              >
                {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirmar clave */}
          <div className="space-y-1.5">
            <label className="text-white/60 text-xs font-medium uppercase tracking-wide pl-1">
              Confirmar clave
            </label>
            <div className="flex items-center bg-white/8 border border-white/10 rounded-xl focus-within:border-vascan-gold/50 transition-colors">
              <div className="pl-4">
                <Lock className="w-5 h-5 text-white/30" />
              </div>
              <input
                type={showPwd ? "text" : "password"}
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Repite la nueva clave"
                autoComplete="new-password"
                className="flex-1 bg-transparent text-white placeholder-white/25 text-base py-4 px-3 outline-none"
              />
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
                <span>Guardando...</span>
              </>
            ) : (
              "Guardar y continuar"
            )}
          </button>
        </form>

        {/* Logout */}
        <div className="text-center mt-8">
          <button
            type="button"
            onClick={handleLogout}
            className="text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
