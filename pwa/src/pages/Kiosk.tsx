import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Delete, Check, X, ArrowLeft, AlertCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────
interface KioskUser {
  id: string;
  rut: string;
  nombre: string;
  apellido: string;
  role: string;
  casinoId: string | null;
  passwordChangeRequired?: boolean;
}
interface KioskCasino {
  id: string;
  nombre: string;
  permitirCambioClaveTotem?: boolean;
}
interface Minuta {
  id: string;
  fecha: string;
  familia: string;
  opcion1: string;
  opcion2: string;
  opcion3: string;
  opcion4: string | null;
  opcion5: string | null;
  activo: boolean;
}
interface Pedido {
  id: string;
  minutaId: string;
  opcionSeleccionada: number;
  codigoQr: string | null;
}

type Step = "login_rut" | "login_pwd" | "change_pwd" | "menu" | "qr" | "error" | "resumen";

// ── RUT helpers (same logic as PWA) ────────────────────────────────────────
function formatRutDisplay(raw: string): string {
  const cleaned = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (cleaned.length <= 1) return cleaned;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);
  let out = "";
  const rev = body.split("").reverse();
  for (let i = 0; i < rev.length; i++) {
    if (i > 0 && i % 3 === 0) out = "." + out;
    out = rev[i] + out;
  }
  return out + "-" + dv;
}

function getOptions(m: Minuta) {
  const opts = [
    { number: 1, text: m.opcion1 },
    { number: 2, text: m.opcion2 },
    { number: 3, text: m.opcion3 },
  ];
  if (m.opcion4) opts.push({ number: 4, text: m.opcion4 });
  if (m.opcion5) opts.push({ number: 5, text: m.opcion5 });
  return opts;
}

const todayISO = () => new Date().toISOString().split("T")[0];

// ── Inactivity hook ────────────────────────────────────────────────────────
function useIdleReset(onIdle: () => void, ms: number, enabled: boolean) {
  const ref = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    const reset = () => {
      if (ref.current) window.clearTimeout(ref.current);
      ref.current = window.setTimeout(onIdle, ms);
    };
    reset();
    const events = ["pointerdown", "touchstart", "keydown"];
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (ref.current) window.clearTimeout(ref.current);
    };
  }, [onIdle, ms, enabled]);
}

// ── Numeric keypad ─────────────────────────────────────────────────────────
function Keypad({
  value,
  onChange,
  onSubmit,
  withK,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  withK?: boolean;
}) {
  function press(c: string) {
    onChange(value + c);
  }
  function back() {
    onChange(value.slice(0, -1));
  }
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-md">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => press(k)}
          className="h-20 text-3xl font-semibold text-white bg-white/8 hover:bg-white/12 active:scale-95 border border-white/10 rounded-2xl transition-all"
        >
          {k}
        </button>
      ))}
      <button
        onClick={back}
        className="h-20 flex items-center justify-center text-white/70 bg-white/5 hover:bg-white/8 active:scale-95 border border-white/10 rounded-2xl transition-all"
        aria-label="Borrar"
      >
        <Delete className="w-7 h-7" />
      </button>
      <button
        onClick={() => press("0")}
        className="h-20 text-3xl font-semibold text-white bg-white/8 hover:bg-white/12 active:scale-95 border border-white/10 rounded-2xl transition-all"
      >
        0
      </button>
      {withK ? (
        <button
          onClick={() => press("K")}
          className="h-20 text-3xl font-semibold text-vascan-gold bg-vascan-gold/10 hover:bg-vascan-gold/20 active:scale-95 border border-vascan-gold/30 rounded-2xl transition-all"
        >
          K
        </button>
      ) : (
        <div />
      )}
      <button
        onClick={onSubmit}
        className="col-span-3 h-16 mt-2 text-xl font-bold bg-vascan-gold hover:bg-vascan-goldDark active:scale-[0.98] text-vascan-bg rounded-2xl transition-all flex items-center justify-center gap-2"
      >
        <Check className="w-6 h-6" />
        Continuar
      </button>
    </div>
  );
}

// ── Main Kiosk component ───────────────────────────────────────────────────
export default function Kiosk() {
  const [step, setStep] = useState<Step>("login_rut");
  const [rutRaw, setRutRaw] = useState("");
  const [pwdRaw, setPwdRaw] = useState("");
  const [user, setUser] = useState<KioskUser | null>(null);
  const [minutas, setMinutas] = useState<Minuta[]>([]);
  const [existingPedidos, setExistingPedidos] = useState<Pedido[]>([]);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrMeta, setQrMeta] = useState<{ familia: string; opcion: string; nombre: string; rut: string } | null>(null);
  const [casino, setCasino] = useState<KioskCasino | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdStage, setPwdStage] = useState<1 | 2>(1);
  const [resumen, setResumen] = useState<any>(null);

  // ── Reset to initial state ──
  const reset = useCallback(() => {
    setStep("login_rut");
    setRutRaw("");
    setPwdRaw("");
    setUser(null);
    setMinutas([]);
    setExistingPedidos([]);
    setBusy(false);
    setErrMsg("");
    setQrCode(null);
    setQrMeta(null);
    setCasino(null);
    setNewPwd("");
    setNewPwd2("");
    setPwdStage(1);
    setResumen(null);
  }, []);

  // Auto-logout after 60s of inactivity in any post-login step.
  // Auto-return after 15s on QR screen (specific shorter timer).
  useIdleReset(reset, step === "qr" ? 15000 : 60000, step !== "login_rut");

  // ── Login submit ──
  async function handleLoginRut() {
    if (!rutRaw || rutRaw.length < 2) {
      setErrMsg("Ingresa tu RUT completo");
      return;
    }
    setErrMsg("");
    setStep("login_pwd");
  }

  async function handleLoginPwd() {
    if (!pwdRaw) {
      setErrMsg("Ingresa tu contraseña");
      return;
    }
    setBusy(true);
    setErrMsg("");
    let u: KioskUser | null = null;
    try {
      const res = await apiRequest("POST", "/api/auth/login", { rut: rutRaw, password: pwdRaw });
      const data = await res.json();
      if (!data.user) throw new Error("Sin sesión");
      u = data.user;
    } catch {
      setErrMsg("RUT o contraseña incorrectos");
      setPwdRaw("");
      setBusy(false);
      return;
    }

    try {
      setUser(u);
      if (!u!.casinoId) {
        setErrMsg("Tu usuario no tiene un casino asignado.");
        setStep("error");
        return;
      }

      // Cargar info del casino para saber si permite cambio de clave en tótem
      let casinoData: KioskCasino | null = null;
      try {
        const cRes = await fetch(`/api/casinos`, { credentials: "include" });
        if (cRes.ok) {
          const all: KioskCasino[] = await cRes.json();
          casinoData = all.find(c => c.id === u!.casinoId) || null;
          setCasino(casinoData);
        }
      } catch {}

      // ¿Cambio de clave forzado?
      if (u!.passwordChangeRequired) {
        if (casinoData?.permitirCambioClaveTotem) {
          setStep("change_pwd");
          setBusy(false);
          return;
        }
        setErrMsg("Debes cambiar tu clave en el panel web antes de usar el tótem. Pide ayuda al encargado.");
        setStep("error");
        setBusy(false);
        return;
      }

      // Roles staff → menú especial: resumen del día
      if (u!.role === "admin" || u!.role === "encargado_casino" || u!.role === "interlocutor") {
        await loadResumen(u!.casinoId);
        setStep("resumen");
        setBusy(false);
        return;
      }

      const today = todayISO();
      const [minutasRes, pedidosRes] = await Promise.all([
        fetch(`/api/minutas/${u!.casinoId}?_t=${Date.now()}`, { credentials: "include" }),
        fetch(`/api/pedidos/${u!.id}?_t=${Date.now()}`, { credentials: "include" }),
      ]);
      if (!minutasRes.ok) throw new Error("No se pudo cargar el menú");
      const minutasData: Minuta[] = await minutasRes.json();
      const pedidosData: Pedido[] = pedidosRes.ok ? await pedidosRes.json() : [];

      const todayMinutas = minutasData.filter((m) => m.fecha === today && m.activo);
      if (todayMinutas.length === 0) {
        setErrMsg("No hay menú disponible para hoy en tu casino.");
        setStep("error");
        return;
      }
      setMinutas(todayMinutas);
      setExistingPedidos(pedidosData);
      setStep("menu");
    } catch {
      setErrMsg("No se pudo cargar tu menú. Intenta nuevamente.");
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  async function loadResumen(casinoId: string) {
    try {
      const r = await fetch(`/api/reportes/resumen-dia/${casinoId}?_t=${Date.now()}`, { credentials: "include" });
      if (r.ok) setResumen(await r.json());
    } catch {}
  }

  // ── Cambio de clave forzado (primer ingreso) ──
  async function handleChangePwd() {
    if (pwdStage === 1) {
      if (!newPwd || newPwd.length < 4) { setErrMsg("Mínimo 4 dígitos"); return; }
      setErrMsg("");
      setPwdStage(2);
      return;
    }
    if (newPwd2 !== newPwd) { setErrMsg("Las claves no coinciden"); setNewPwd2(""); return; }
    setBusy(true); setErrMsg("");
    try {
      const res = await apiRequest("POST", "/api/auth/change-password", { newPassword: newPwd });
      if (!res.ok) throw new Error();
      // Volver a login para que el usuario use la nueva clave
      setErrMsg("Clave actualizada. Vuelve a ingresar.");
      setTimeout(reset, 1500);
    } catch {
      setErrMsg("No se pudo cambiar la clave");
    } finally { setBusy(false); }
  }

  // ── Selección de opción ──
  async function selectOption(minuta: Minuta, opcionNum: number) {
    if (!user) return;
    setBusy(true);
    setErrMsg("");
    try {
      // Si ya tiene pedido para esta minuta, mostrar el QR existente
      const existing = existingPedidos.find((p) => p.minutaId === minuta.id);
      let pedido: Pedido;
      if (existing) {
        pedido = existing;
      } else {
        const res = await apiRequest("POST", "/api/pedidos", {
          userId: user.id,
          minutaId: minuta.id,
          opcionSeleccionada: opcionNum,
          tipo: "seleccion",
        });
        pedido = await res.json();
      }

      const opt = getOptions(minuta).find((o) => o.number === pedido.opcionSeleccionada);
      setQrCode(pedido.codigoQr || pedido.id);
      setQrMeta({
        familia: minuta.familia || "Almuerzo",
        opcion: opt?.text || `Opción ${pedido.opcionSeleccionada}`,
        nombre: `${user.nombre} ${user.apellido}`,
        rut: formatRutDisplay(user.rut),
      });
      setStep("qr");
      // Cerrar sesión silenciosamente para que el siguiente comensal parta limpio
      try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("403") || msg.toLowerCase().includes("periodo")) {
        setErrMsg("El periodo de inscripción no está activo. Contacta a tu administrador.");
      } else {
        setErrMsg("No se pudo registrar el pedido. Intenta nuevamente.");
      }
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  // ── Render por paso ──
  return (
    <div className="fixed inset-0 bg-vascan-bg text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-8 pt-6 pb-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-vascan-bg flex items-center justify-center">
            <img src="/logo.png" alt="BuenaMezcla" className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          </div>
          <div>
            <p className="text-white font-bold text-xl leading-tight">BuenaMezcla</p>
            <p className="text-vascan-goldLight text-xs leading-tight">Tótem de inscripción</p>
          </div>
        </div>
        {step !== "login_rut" && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 text-white/60 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" /> Cancelar
          </button>
        )}
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto flex items-start justify-center px-8 py-8 relative">
        {step === "login_rut" && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Ingresa tu RUT</h2>
              <p className="text-white/50">Sin puntos, con dígito verificador</p>
            </div>
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-center">
              <p className="text-4xl font-mono font-bold tracking-wider text-vascan-gold min-h-[3rem]">
                {rutRaw ? formatRutDisplay(rutRaw) : <span className="text-white/20">12.345.678-9</span>}
              </p>
            </div>
            {errMsg && (
              <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {errMsg}</p>
            )}
            <Keypad
              value={rutRaw}
              onChange={(v) => setRutRaw(v.slice(0, 9).toUpperCase())}
              onSubmit={handleLoginRut}
              withK
            />
          </div>
        )}

        {step === "login_pwd" && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Tu contraseña</h2>
              <p className="text-white/50">RUT: <span className="text-vascan-gold font-mono">{formatRutDisplay(rutRaw)}</span></p>
            </div>
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-center">
              <p className="text-5xl font-bold tracking-[0.5em] text-vascan-gold min-h-[3rem]">
                {pwdRaw ? "•".repeat(pwdRaw.length) : <span className="text-white/20 text-3xl tracking-normal">••••</span>}
              </p>
            </div>
            {errMsg && (
              <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {errMsg}</p>
            )}
            <Keypad value={pwdRaw} onChange={(v) => setPwdRaw(v.slice(0, 12))} onSubmit={handleLoginPwd} />
            <button
              onClick={() => { setStep("login_rut"); setPwdRaw(""); setErrMsg(""); }}
              className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Cambiar RUT
            </button>
          </div>
        )}

        {step === "change_pwd" && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">{pwdStage === 1 ? "Crea tu nueva clave" : "Confirma tu nueva clave"}</h2>
              <p className="text-white/50">Mínimo 4 dígitos · solo numérica</p>
            </div>
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-center">
              <p className="text-5xl font-bold tracking-[0.5em] text-vascan-gold min-h-[3rem]">
                {(pwdStage === 1 ? newPwd : newPwd2)
                  ? "•".repeat((pwdStage === 1 ? newPwd : newPwd2).length)
                  : <span className="text-white/20 text-3xl tracking-normal">••••</span>}
              </p>
            </div>
            {errMsg && (
              <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {errMsg}</p>
            )}
            <Keypad
              value={pwdStage === 1 ? newPwd : newPwd2}
              onChange={(v) => (pwdStage === 1 ? setNewPwd(v.slice(0, 12)) : setNewPwd2(v.slice(0, 12)))}
              onSubmit={handleChangePwd}
            />
          </div>
        )}

        {step === "resumen" && user && (
          <div className="w-full max-w-3xl flex flex-col gap-6">
            <div className="text-center">
              <p className="text-vascan-goldLight text-lg">Hola, <span className="text-white font-semibold">{user.nombre} {user.apellido}</span></p>
              <h2 className="text-3xl font-bold mt-1">Resumen del día</h2>
              {casino && <p className="text-white/50 mt-1">{casino.nombre}</p>}
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              {resumen?.minuta ? (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="text-center">
                      <p className="text-white/50 text-sm">Selecciones</p>
                      <p className="text-3xl font-bold text-vascan-gold mt-1">{resumen.totalSeleccion}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/50 text-sm">No asiste</p>
                      <p className="text-3xl font-bold text-orange-300 mt-1">{resumen.totalNoAsiste}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/50 text-sm">Visitas</p>
                      <p className="text-3xl font-bold text-blue-300 mt-1">{resumen.totalVisitas}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(resumen.opciones || []).map((o: any) => (
                      <div key={o.numero} className="flex items-center justify-between bg-white/3 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-vascan-gold/20 text-vascan-gold flex items-center justify-center font-bold">{o.numero}</span>
                          <span className="text-white">{o.descripcion}</span>
                        </div>
                        <span className="text-vascan-gold font-bold text-xl">{o.cantidad}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-white/60 text-center py-6">No hay menú para hoy.</p>
              )}
            </div>
            <div className="flex justify-center gap-3">
              <button onClick={() => user.casinoId && loadResumen(user.casinoId)} className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10">
                Actualizar
              </button>
              <button onClick={reset} className="px-6 py-3 rounded-xl bg-vascan-gold hover:bg-vascan-goldDark text-vascan-bg font-bold">
                Terminar
              </button>
            </div>
          </div>
        )}

        {step === "menu" && user && (
          <div className="w-full max-w-5xl h-full flex flex-col gap-6 overflow-hidden">
            <div className="text-center flex-shrink-0">
              <p className="text-vascan-goldLight text-lg">Hola, <span className="text-white font-semibold">{user.nombre} {user.apellido}</span></p>
              <h2 className="text-3xl font-bold mt-1">¿Qué eliges hoy?</h2>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {minutas.map((m) => {
                const already = existingPedidos.find((p) => p.minutaId === m.id && p.opcionSeleccionada > 0);
                return (
                  <div key={m.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-vascan-gold capitalize">{m.familia || "Almuerzo"}</h3>
                      {already && (
                        <span className="px-3 py-1 rounded-lg bg-green-500/15 text-green-400 text-sm font-medium">
                          Ya inscrito · Toca para ver vale
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {getOptions(m).map((opt) => {
                        const isAlready = already?.opcionSeleccionada === opt.number;
                        return (
                          <button
                            key={opt.number}
                            disabled={busy}
                            onClick={() => selectOption(m, opt.number)}
                            className={`text-left p-5 rounded-xl border-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                              isAlready
                                ? "border-green-500 bg-green-500/10"
                                : "border-white/10 bg-white/3 hover:border-vascan-gold/60 hover:bg-vascan-gold/5"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0 ${
                                isAlready ? "bg-green-500 text-white" : "bg-vascan-gold/20 text-vascan-gold"
                              }`}>
                                {isAlready ? <Check className="w-6 h-6" /> : opt.number}
                              </div>
                              <p className="text-lg leading-snug">{opt.text}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "qr" && qrCode && qrMeta && (
          <div className="flex flex-col items-center gap-5 max-w-2xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/15 text-green-400 text-sm font-semibold mb-3">
                <Check className="w-4 h-4" /> Inscripción confirmada
              </div>
              <h2 className="text-3xl font-bold">¡Listo, {qrMeta.nombre.split(" ")[0]}!</h2>
              <p className="text-white/60 mt-1">Muestra este código al recibir tu comida</p>
            </div>
            <div className="bg-white p-5 rounded-2xl">
              <QRCodeSVG value={qrCode} size={320} level="M" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 w-full text-center">
              <p className="text-vascan-goldLight text-sm uppercase tracking-wide">{qrMeta.familia}</p>
              <p className="text-white text-xl font-semibold mt-1">{qrMeta.opcion}</p>
              <p className="text-white/40 text-xs mt-2 font-mono">{qrMeta.rut}</p>
            </div>
            <button
              onClick={reset}
              className="px-8 py-3 rounded-xl bg-vascan-gold hover:bg-vascan-goldDark text-vascan-bg font-bold transition-all"
            >
              Terminar
            </button>
            <p className="text-white/30 text-xs">El vale se cerrará automáticamente en 15s</p>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-5 text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold">Algo salió mal</h2>
            <p className="text-white/60">{errMsg || "Intenta nuevamente"}</p>
            <button
              onClick={reset}
              className="px-8 py-3 rounded-xl bg-vascan-gold hover:bg-vascan-goldDark text-vascan-bg font-bold"
            >
              Volver al inicio
            </button>
          </div>
        )}

        {busy && step !== "qr" && (
          <div className="absolute inset-0 bg-vascan-bg/70 flex items-center justify-center z-50">
            <div className="w-12 h-12 border-3 border-vascan-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 px-8 py-3 border-t border-white/5 flex items-center justify-between text-white/30 text-xs">
        <span>BuenaMezcla · Sistema de Comensales</span>
        <span>{new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
      </footer>
    </div>
  );
}
