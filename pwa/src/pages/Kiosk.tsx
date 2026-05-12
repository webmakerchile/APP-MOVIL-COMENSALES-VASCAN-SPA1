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
  // Casinos accesibles (incluye casinoId base + multi-casino vía usuario_casinos).
  // Permite que un mismo tótem atienda staff a cargo de varios casinos
  // (ej: Química General + Química Ejecutivo).
  casinoIds?: string[];
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

type Step =
  | "login_rut"
  | "login_pwd"
  | "change_pwd"
  | "menu"
  | "qr"
  | "error"
  | "resumen"
  | "staff_select_casino"
  | "staff_menu"
  | "vale_visita_rut"
  | "vale_visita_nombre"
  | "vale_visita_opcion"
  | "reimp_rut"
  | "reimp_list";

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
  const [lastLoginPwd, setLastLoginPwd] = useState("");
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
  const [reimpRut, setReimpRut] = useState("");
  const [reimpResult, setReimpResult] = useState<{ user: any; pedidos: Pedido[]; minutas: Minuta[] } | null>(null);
  const [visitaRut, setVisitaRut] = useState("");
  const [visitaNombre, setVisitaNombre] = useState("");
  const [todayMinutas, setTodayMinutas] = useState<Minuta[]>([]);
  // Multi-casino para staff: casinos accesibles del usuario y casino activo elegido.
  const [accessibleCasinos, setAccessibleCasinos] = useState<KioskCasino[]>([]);
  const [selectedCasinoId, setSelectedCasinoId] = useState<string | null>(null);

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
    setReimpRut("");
    setReimpResult(null);
    setVisitaRut("");
    setVisitaNombre("");
    setTodayMinutas([]);
    setAccessibleCasinos([]);
    setSelectedCasinoId(null);
  }, []);

  // Auto-logout after 60s of inactivity in any post-login step.
  // Auto-return after 15s on QR screen (specific shorter timer).
  useIdleReset(reset, step === "qr" ? 15000 : 60000, step !== "login_rut");

  // Auto-impresión del vale al llegar al paso QR. La impresora térmica USB
  // del tótem está configurada en Chrome `--kiosk-printing` para imprimir
  // sin diálogo. El layout imprimible vive en el div `.print-vale` al final
  // del render y usa CSS `@media print` (pwa/src/index.css) para 80mm.
  const printedRef = useRef<string | null>(null);
  useEffect(() => {
    if (step !== "qr" || !qrCode || !qrMeta) return;
    if (printedRef.current === qrCode) return;
    printedRef.current = qrCode;
    const t = window.setTimeout(() => {
      try { window.print(); } catch {}
    }, 250);
    return () => window.clearTimeout(t);
  }, [step, qrCode, qrMeta]);
  useEffect(() => {
    if (step !== "qr") printedRef.current = null;
  }, [step]);

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
    const submittedPwd = pwdRaw;
    try {
      const res = await apiRequest("POST", "/api/auth/login", { rut: rutRaw, password: submittedPwd });
      const data = await res.json();
      if (!data.user) throw new Error("Sin sesión");
      u = data.user;
      setLastLoginPwd(submittedPwd);
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

      // Cargar catálogo de casinos una sola vez (necesario para multi-casino del staff
      // y para conocer el flag permitirCambioClaveTotem del casino del usuario).
      let allCasinos: KioskCasino[] = [];
      try {
        const cRes = await fetch(`/api/casinos`, { credentials: "include" });
        if (cRes.ok) allCasinos = await cRes.json();
      } catch {}
      const casinoData: KioskCasino | null = u!.casinoId
        ? (allCasinos.find(c => c.id === u!.casinoId) || null)
        : null;
      setCasino(casinoData);

      // ¿Cambio de clave forzado en primer login? (Independiente del toggle del casino:
      // el toggle solo controla si el botón "Cambio de clave" está disponible
      // como acción opcional dentro del menú staff.)
      if (u!.passwordChangeRequired) {
        setStep("change_pwd");
        setBusy(false);
        return;
      }

      // Roles staff → menú con 5 botones (Vale propio, Vale visita, Cambio
      // de clave, Resumen del día, Reimpresión).
      if (u!.role === "admin" || u!.role === "encargado_casino" || u!.role === "interlocutor") {
        // Resolver casinos accesibles para el staff (multi-casino):
        // un mismo tótem físico puede atender más de un casino (ej: Química
        // General + Química Ejecutivo). Se usa la lista de casinos que el
        // usuario tiene asignados (casinoId base + relación usuario_casinos,
        // expuesta en `casinoIds` por /api/auth/me).
        const ids = (u!.casinoIds && u!.casinoIds.length > 0)
          ? u!.casinoIds
          : (u!.casinoId ? [u!.casinoId] : []);
        const matched = allCasinos.filter(c => ids.includes(c.id));
        // Admin global (sin casinoIds explícitos) → ve todos los casinos activos.
        const list = matched.length > 0
          ? matched
          : (u!.role === "admin" ? allCasinos : (casinoData ? [casinoData] : []));
        setAccessibleCasinos(list);
        if (list.length > 1) {
          // Pedir al staff que elija a qué casino está atendiendo en este momento.
          setStep("staff_select_casino");
          setBusy(false);
          return;
        }
        // Un solo casino accesible → entrar directo al menú staff.
        const onlyCasino = list[0] || casinoData || null;
        if (onlyCasino) {
          setSelectedCasinoId(onlyCasino.id);
          setCasino(onlyCasino);
          await loadStaffContextForCasino(onlyCasino.id);
        }
        setStep("staff_menu");
        setBusy(false);
        return;
      }

      // Comensal: si ya tiene pedido para hoy, saltar directo al QR.
      const today = todayISO();
      const [minutasRes, pedidosRes] = await Promise.all([
        fetch(`/api/minutas/${u!.casinoId}?_t=${Date.now()}`, { credentials: "include" }),
        fetch(`/api/pedidos/${u!.id}?_t=${Date.now()}`, { credentials: "include" }),
      ]);
      if (!minutasRes.ok) throw new Error("No se pudo cargar el menú");
      const minutasData: Minuta[] = await minutasRes.json();
      const pedidosData: Pedido[] = pedidosRes.ok ? await pedidosRes.json() : [];

      const todayMins = minutasData.filter((m) => m.fecha === today && m.activo);
      if (todayMins.length === 0) {
        setErrMsg("No hay menú disponible para hoy en tu casino.");
        setStep("error");
        return;
      }

      // Auto-salto a QR si ya tiene pedido del día (no_asiste no se considera).
      const todayIds = new Set(todayMins.map(m => m.id));
      const existingToday = pedidosData.find(p => todayIds.has(p.minutaId) && p.opcionSeleccionada > 0);
      if (existingToday) {
        const minuta = todayMins.find(m => m.id === existingToday.minutaId)!;
        const opt = getOptions(minuta).find(o => o.number === existingToday.opcionSeleccionada);
        setQrCode(existingToday.codigoQr || existingToday.id);
        setQrMeta({
          familia: minuta.familia || "Almuerzo",
          opcion: opt?.text || `Opción ${existingToday.opcionSeleccionada}`,
          nombre: `${u!.nombre} ${u!.apellido}`,
          rut: formatRutDisplay(u!.rut),
        });
        setStep("qr");
        try { await apiRequest("POST", "/api/auth/logout"); } catch {}
        return;
      }

      setMinutas(todayMins);
      setExistingPedidos(pedidosData);
      setStep("menu");
    } catch {
      setErrMsg("No se pudo cargar tu menú. Intenta nuevamente.");
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  // Carga las minutas activas del día para el casino dado (usado al entrar al
  // staff_menu y al cambiar de casino dentro del menú staff).
  async function loadStaffContextForCasino(casinoId: string) {
    const today = todayISO();
    try {
      const mRes = await fetch(`/api/minutas/${casinoId}?_t=${Date.now()}`, { credentials: "include" });
      if (mRes.ok) {
        const all: Minuta[] = await mRes.json();
        setTodayMinutas(all.filter(m => m.fecha === today && m.activo));
      } else {
        setTodayMinutas([]);
      }
    } catch {
      setTodayMinutas([]);
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
      // Si NO es cambio forzado, el backend exige currentPassword.
      // Reutilizamos la clave que el usuario acaba de tipear al ingresar.
      const body: { newPassword: string; currentPassword?: string } = { newPassword: newPwd };
      if (!user?.passwordChangeRequired && lastLoginPwd) {
        body.currentPassword = lastLoginPwd;
      }
      const res = await apiRequest("POST", "/api/auth/change-password", body);
      if (!res.ok) throw new Error();
      setErrMsg("Clave actualizada. Vuelve a ingresar.");
      setTimeout(reset, 1500);
    } catch {
      setErrMsg("No se pudo cambiar la clave");
    } finally { setBusy(false); }
  }

  // ── Staff: Vale propio (auto-opcion 1) ──
  async function handleStaffValePropio() {
    if (!user) return;
    if (todayMinutas.length === 0) {
      setErrMsg("No hay minuta para hoy.");
      setStep("error");
      return;
    }
    await selectOption(todayMinutas[0], 1);
  }

  // ── Staff: Vale visita ──
  async function handleVisitaSubmit() {
    if (!user) return;
    if (!visitaRut || visitaRut.length < 2) { setErrMsg("Ingresa el RUT del visitante"); return; }
    setErrMsg("");
    setStep("vale_visita_nombre");
  }
  async function handleVisitaNombreSubmit() {
    if (!visitaNombre.trim()) { setErrMsg("Ingresa el nombre del visitante"); return; }
    if (todayMinutas.length === 0) { setErrMsg("No hay minuta para hoy."); setStep("error"); return; }
    setErrMsg("");
    setBusy(true);
    try {
      const minuta = todayMinutas[0];
      const res = await apiRequest("POST", "/api/pedidos/visita", {
        userId: user!.id,
        minutaId: minuta.id,
        nombreVisita: visitaNombre.trim(),
      });
      const pedido: Pedido = await res.json();
      setQrCode(pedido.codigoQr || pedido.id);
      setQrMeta({
        familia: minuta.familia || "Almuerzo",
        opcion: `Visita: ${visitaNombre.trim()}`,
        nombre: visitaNombre.trim(),
        rut: formatRutDisplay(visitaRut),
      });
      setStep("qr");
      try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    } catch {
      setErrMsg("No se pudo emitir el vale de visita");
      setStep("error");
    } finally { setBusy(false); }
  }

  // ── Staff: Reimpresión ──
  async function handleReimpSubmit() {
    if (!reimpRut || reimpRut.length < 2) { setErrMsg("Ingresa el RUT"); return; }
    setBusy(true); setErrMsg("");
    try {
      const r = await fetch(`/api/pedidos/buscar/por-rut?rut=${encodeURIComponent(reimpRut)}&fecha=${todayISO()}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (!data.user) { setErrMsg("No se encontró un comensal con ese RUT"); setBusy(false); return; }
      setReimpResult(data);
      setStep("reimp_list");
    } catch {
      setErrMsg("No se pudo buscar el vale");
    } finally { setBusy(false); }
  }
  function showReimpQR(p: Pedido) {
    if (!reimpResult) return;
    const minuta = reimpResult.minutas.find(m => m.id === p.minutaId);
    if (!minuta) return;
    const opt = minuta ? getOptions(minuta).find(o => o.number === p.opcionSeleccionada) : null;
    setQrCode(p.codigoQr || p.id);
    setQrMeta({
      familia: minuta.familia || "Almuerzo",
      opcion: opt?.text || `Opción ${p.opcionSeleccionada}`,
      nombre: `${reimpResult.user.nombre} ${reimpResult.user.apellido}`,
      rut: formatRutDisplay(reimpResult.user.rut),
    });
    setStep("qr");
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
              <button onClick={() => selectedCasinoId && loadResumen(selectedCasinoId)} className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10">
                Actualizar
              </button>
              <button onClick={reset} className="px-6 py-3 rounded-xl bg-vascan-gold hover:bg-vascan-goldDark text-vascan-bg font-bold">
                Terminar
              </button>
            </div>
          </div>
        )}

        {step === "staff_select_casino" && user && (
          <div className="w-full max-w-2xl flex flex-col gap-6">
            <div className="text-center">
              <p className="text-vascan-goldLight text-lg">Hola, <span className="text-white font-semibold">{user.nombre} {user.apellido}</span></p>
              <h2 className="text-3xl font-bold mt-1">¿A qué casino vas a atender?</h2>
              <p className="text-white/50 mt-1">Tienes más de un casino asignado en este tótem</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {accessibleCasinos.map((c) => (
                <button
                  key={c.id}
                  onClick={async () => {
                    setSelectedCasinoId(c.id);
                    setCasino(c);
                    setBusy(true);
                    await loadStaffContextForCasino(c.id);
                    setBusy(false);
                    setStep("staff_menu");
                  }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xl transition text-left"
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            <div className="flex justify-center">
              <button onClick={reset} className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10">Cancelar</button>
            </div>
          </div>
        )}

        {step === "staff_menu" && user && (
          <div className="w-full max-w-3xl flex flex-col gap-6">
            <div className="text-center">
              <p className="text-vascan-goldLight text-lg">Hola, <span className="text-white font-semibold">{user.nombre} {user.apellido}</span></p>
              <h2 className="text-3xl font-bold mt-1">¿Qué necesitas hacer?</h2>
              {casino && (
                <div className="mt-1 flex items-center justify-center gap-2">
                  <p className="text-white/50">Atendiendo: <span className="text-white/80 font-semibold">{casino.nombre}</span></p>
                  {accessibleCasinos.length > 1 && (
                    <button
                      onClick={() => setStep("staff_select_casino")}
                      className="text-xs px-2 py-1 rounded-md bg-white/5 border border-white/10 text-vascan-goldLight hover:bg-white/10"
                    >
                      Cambiar casino
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleStaffValePropio}
                disabled={busy || todayMinutas.length === 0}
                className="p-6 rounded-2xl bg-vascan-gold hover:bg-vascan-goldDark text-vascan-bg font-bold text-xl transition disabled:opacity-40"
              >
                Mi vale
                <p className="text-sm font-normal opacity-80 mt-1">Vale propio del día</p>
              </button>
              <button
                onClick={() => { setStep("vale_visita_rut"); setVisitaRut(""); setVisitaNombre(""); setErrMsg(""); }}
                disabled={todayMinutas.length === 0}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xl transition disabled:opacity-40"
              >
                Vale visita
                <p className="text-sm font-normal text-white/60 mt-1">Emitir vale para un invitado</p>
              </button>
              <button
                onClick={async () => { if (selectedCasinoId) await loadResumen(selectedCasinoId); setStep("resumen"); }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xl transition"
              >
                Resumen del día
                <p className="text-sm font-normal text-white/60 mt-1">Ver totales del casino</p>
              </button>
              <button
                onClick={() => { setStep("reimp_rut"); setReimpRut(""); setReimpResult(null); setErrMsg(""); }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xl transition"
              >
                Reimpresión
                <p className="text-sm font-normal text-white/60 mt-1">Buscar vale por RUT</p>
              </button>
              {casino?.permitirCambioClaveTotem && (
                <button
                  onClick={() => { setStep("change_pwd"); setNewPwd(""); setNewPwd2(""); setPwdStage(1); setErrMsg(""); }}
                  className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xl transition sm:col-span-2"
                >
                  Cambio de clave
                  <p className="text-sm font-normal text-white/60 mt-1">Actualizar tu clave numérica</p>
                </button>
              )}
            </div>
            {errMsg && <p className="text-red-400 text-sm flex items-center gap-2 justify-center"><AlertCircle className="w-4 h-4" /> {errMsg}</p>}
            <div className="flex justify-center">
              <button onClick={reset} className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10">Terminar</button>
            </div>
          </div>
        )}

        {step === "vale_visita_rut" && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">RUT del visitante</h2>
              <p className="text-white/50">Sin puntos ni guion</p>
            </div>
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-center">
              <p className="text-4xl font-bold tracking-widest text-vascan-gold min-h-[2.5rem]">
                {visitaRut || <span className="text-white/20 text-2xl tracking-normal">12345678K</span>}
              </p>
            </div>
            {errMsg && <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {errMsg}</p>}
            <Keypad value={visitaRut} onChange={(v) => setVisitaRut(v.slice(0, 9).toUpperCase())} onSubmit={handleVisitaSubmit} withK />
            <button onClick={() => setStep("staff_menu")} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm">
              <ArrowLeft className="w-4 h-4" /> Cancelar
            </button>
          </div>
        )}

        {step === "vale_visita_nombre" && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Nombre del visitante</h2>
              <p className="text-white/50">Aparecerá impreso en el vale</p>
            </div>
            <input
              autoFocus
              value={visitaNombre}
              onChange={(e) => setVisitaNombre(e.target.value)}
              placeholder="Juan Pérez"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-2xl text-white text-center focus:outline-none focus:border-vascan-gold/60"
            />
            {errMsg && <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {errMsg}</p>}
            <div className="flex gap-3 w-full">
              <button onClick={() => setStep("vale_visita_rut")} className="flex-1 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10">
                Atrás
              </button>
              <button onClick={handleVisitaNombreSubmit} disabled={busy} className="flex-1 px-6 py-3 rounded-xl bg-vascan-gold hover:bg-vascan-goldDark text-vascan-bg font-bold disabled:opacity-50">
                Emitir vale
              </button>
            </div>
          </div>
        )}

        {step === "reimp_rut" && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">Reimpresión de vale</h2>
              <p className="text-white/50">Ingresa el RUT del comensal</p>
            </div>
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-center">
              <p className="text-4xl font-bold tracking-widest text-vascan-gold min-h-[2.5rem]">
                {reimpRut || <span className="text-white/20 text-2xl tracking-normal">12345678K</span>}
              </p>
            </div>
            {errMsg && <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {errMsg}</p>}
            <Keypad value={reimpRut} onChange={(v) => setReimpRut(v.slice(0, 9).toUpperCase())} onSubmit={handleReimpSubmit} withK />
            <button onClick={() => setStep("staff_menu")} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm">
              <ArrowLeft className="w-4 h-4" /> Cancelar
            </button>
          </div>
        )}

        {step === "reimp_list" && reimpResult && (
          <div className="w-full max-w-2xl flex flex-col gap-5">
            <div className="text-center">
              <h2 className="text-3xl font-bold">{reimpResult.user.nombre} {reimpResult.user.apellido}</h2>
              <p className="text-white/50 font-mono mt-1">{formatRutDisplay(reimpResult.user.rut)}</p>
            </div>
            <div className="space-y-3">
              {reimpResult.pedidos.length === 0 ? (
                <p className="text-white/60 text-center py-8 bg-white/3 rounded-xl border border-white/10">
                  Este comensal no tiene vales emitidos para hoy.
                </p>
              ) : (
                reimpResult.pedidos.filter(p => p.opcionSeleccionada > 0).map(p => {
                  const m = reimpResult.minutas.find(x => x.id === p.minutaId);
                  const opt = m ? getOptions(m).find(o => o.number === p.opcionSeleccionada) : null;
                  return (
                    <button
                      key={p.id}
                      onClick={() => showReimpQR(p)}
                      className="w-full text-left p-5 rounded-xl bg-white/5 border border-white/10 hover:border-vascan-gold/60 hover:bg-vascan-gold/5 transition"
                    >
                      <p className="text-vascan-goldLight text-sm uppercase tracking-wide">{m?.familia || "Almuerzo"}</p>
                      <p className="text-white text-lg font-semibold mt-1">{opt?.text || `Opción ${p.opcionSeleccionada}`}</p>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex justify-center gap-3">
              <button onClick={() => setStep("reimp_rut")} className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10">
                Buscar otro
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
            <div className="flex gap-3">
              <button
                onClick={() => { try { window.print(); } catch {} }}
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 font-semibold transition-all"
              >
                Reimprimir
              </button>
              <button
                onClick={reset}
                className="px-8 py-3 rounded-xl bg-vascan-gold hover:bg-vascan-goldDark text-vascan-bg font-bold transition-all"
              >
                Terminar
              </button>
            </div>
            <p className="text-white/30 text-xs">El vale se imprimió. Esta pantalla se cerrará en 15s.</p>
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

      {/* Layout imprimible (térmica 80mm). Solo visible en @media print. */}
      {qrCode && qrMeta && (
        <div className="print-vale" aria-hidden="true">
          <div className="pv-center pv-brand">BuenaMezcla</div>
          {casino?.nombre && <div className="pv-center pv-sub">{casino.nombre}</div>}
          <hr className="pv-hr" />
          <div className="pv-familia">{qrMeta.familia}</div>
          <div className="pv-opcion">{qrMeta.opcion}</div>
          <div className="pv-row">
            <span className="pv-label">Comensal</span>
            <span className="pv-value">{qrMeta.nombre}</span>
          </div>
          <div className="pv-row">
            <span className="pv-label">RUT</span>
            <span className="pv-value">{qrMeta.rut}</span>
          </div>
          <div className="pv-row">
            <span className="pv-label">Fecha</span>
            <span className="pv-value">
              {new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          </div>
          <div className="pv-row">
            <span className="pv-label">Hora</span>
            <span className="pv-value">
              {new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <hr className="pv-hr" />
          <div className="pv-qr">
            <QRCodeSVG value={qrCode} size={180} level="M" />
          </div>
          <div className="pv-foot">Presenta este vale al retirar tu comida</div>
          <div className="pv-foot" style={{ fontFamily: "monospace", marginTop: "1mm" }}>
            {qrCode.slice(0, 8).toUpperCase()}
          </div>
        </div>
      )}
    </div>
  );
}
