import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Delete, Check, X, ArrowLeft, AlertCircle } from "lucide-react";
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
  impresoEn?: string | null;
  createdAt?: string | null;
  tipo?: string | null;
}

type Step =
  | "login_rut"
  | "login_pwd"
  | "change_pwd"
  | "change_pwd_rut"
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
  | "reimp_list"
  | "ya_impreso"
  | "no_asiste_msg";

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

// Normaliza RUT al formato canónico de la BD: "12345678-5" (sin puntos, con guion).
function normalizeRutForApi(raw: string): string {
  const cleaned = raw.replace(/[^0-9kK]/g, "").toUpperCase();
  if (cleaned.length <= 1) return cleaned;
  return cleaned.slice(0, -1) + "-" + cleaned.slice(-1);
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
  const [qrPedidoId, setQrPedidoId] = useState<string | null>(null);
  const [qrMeta, setQrMeta] = useState<{ familia: string; opcion: string; nombre: string; rut: string; hora?: string; fecha?: string } | null>(null);
  const [casino, setCasino] = useState<KioskCasino | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [pwdStage, setPwdStage] = useState<1 | 2>(1);
  // RUT del comensal objetivo cuando el staff resetea claves desde el tótem.
  // Si está vacío al hacer submit, se asume "cambiar mi propia clave".
  const [resetTargetRut, setResetTargetRut] = useState("");
  const [resumen, setResumen] = useState<any>(null);
  const [printTime, setPrintTime] = useState<Date | null>(null);
  // Modo de impresión al llegar al paso "qr":
  //  - "resumen": imprime el resumen del día acumulado (flujo comensal normal,
  //    pedido del cliente del 27/05/2026).
  //  - "vale": imprime SOLO el vale individual del comensal (flujo Vale visita
  //    y Reimpresión — pedido del cliente del 27/05/2026 tarde).
  const [printMode, setPrintMode] = useState<"resumen" | "vale">("resumen");
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
    setQrPedidoId(null);
    setQrMeta(null);
    setCasino(null);
    setNewPwd("");
    setNewPwd2("");
    setPwdStage(1);
    setResetTargetRut("");
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
  // Auto-return after 4s on QR screen (flujo continuo — el siguiente comensal
  // en la fila debe poder usar el tótem de inmediato. Cliente pidió bajar de
  // 15s a algo ágil; 4s da tiempo a leer el "¡Listo!" sin frenar la fila).
  // Pantalla "¡Listo!" muy breve (1.5s) — al cliente le importa el ticket
  // impreso, no el QR en pantalla. Flujo continuo: el siguiente comensal
  // entra de inmediato.
  useIdleReset(reset, step === "qr" ? 1500 : 60000, step !== "login_rut");

  // Auto-impresión del vale al llegar al paso QR. La impresora térmica USB
  // del tótem está configurada en Chrome `--kiosk-printing` para imprimir
  // sin diálogo. El layout imprimible vive en el div `.print-vale` al final
  // del render y usa CSS `@media print` (pwa/src/index.css) para 80mm.
  const printedRef = useRef<string | null>(null);
  useEffect(() => {
    if (step !== "qr" || !qrCode || !qrMeta) return;
    if (printedRef.current === qrCode) return;
    printedRef.current = qrCode;
    // Pedido del cliente (27/05/2026): cada vez que un comensal imprime su
    // vale, también debe salir el resumen acumulado del día. El resumen se
    // pre-cargó vía preloadResumenForPrint() en cada handler ANTES del logout
    // (la sesión del comensal ya no existe acá). Si quedó cargado con datos,
    // imprimimos vale + resumen juntos vía print-both-mode; si no, solo vale.
    const r = resumen;
    const resumenOk = !!(r && r.minuta && (
      (Array.isArray(r.opciones) && r.opciones.length > 0) ||
      (r.totalSeleccion || 0) > 0 ||
      (r.totalVisitas || 0) > 0
    ));
    // 2 frames para asegurar que el DOM con el resumen ya pintó.
    const raf1 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        // - printMode "vale": imprime el vale individual (Vale visita, Reimpresión).
        // - printMode "resumen": imprime el resumen del día (comensal normal).
        //   Si no se pudo cargar el resumen, cae al vale como fallback para
        //   que el comensal/visitante no se quede sin ticket.
        const useResumen = printMode === "resumen" && resumenOk;
        const mode = useResumen ? "print-resumen-mode" : "";
        if (mode) document.body.classList.add(mode);
        try { window.print(); } catch {}
        setTimeout(() => { if (mode) document.body.classList.remove(mode); }, 500);
        const pid = qrPedidoId;
        if (pid) {
          apiRequest("POST", `/api/pedidos/${pid}/marcar-impreso`, {}).catch(() => {});
        }
      });
    });
    return () => window.cancelAnimationFrame(raf1);
  }, [step, qrCode, qrMeta, qrPedidoId, resumen, printMode]);
  useEffect(() => {
    if (step !== "qr") {
      printedRef.current = null;
      // Resetear printMode al modo por defecto (comensal = resumen) cuando
      // salimos del paso QR, para que el próximo flujo arranque correctamente.
      setPrintMode("resumen");
    }
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
      const res = await apiRequest("POST", "/api/auth/login", { rut: normalizeRutForApi(rutRaw), password: submittedPwd });
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

      // Cambio de clave forzado DESHABILITADO en el tótem por decisión del cliente:
      // la clave del comensal es siempre los primeros 4 dígitos de su RUT y no
      // necesita cambiarse. Se ignora `passwordChangeRequired` aquí. (El botón
      // opcional "Cambio de clave" del menú staff sigue disponible si el casino
      // tiene `permitirCambioClaveTotem` activo.)

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
      // Soporte multi-casino: el comensal puede tener acceso a varios casinos
      // (campo casinoIds). Pedimos minutas de TODOS sus casinos accesibles y
      // las unimos. El backend (auto-totem) valida que la minuta pertenezca a
      // uno de sus casinos accesibles, así que esto es seguro.
      const today = todayISO();
      const casinoIdsAccesibles: string[] = (u!.casinoIds && u!.casinoIds.length > 0)
        ? u!.casinoIds
        : (u!.casinoId ? [u!.casinoId] : []);
      if (casinoIdsAccesibles.length === 0) {
        setErrMsg("Tu usuario no tiene un casino asignado.");
        setStep("error");
        return;
      }
      const [minutasArrays, pedidosRes] = await Promise.all([
        Promise.all(
          casinoIdsAccesibles.map(cid =>
            fetch(`/api/minutas/${cid}?_t=${Date.now()}`, { credentials: "include" })
              .then(r => r.ok ? r.json() as Promise<Minuta[]> : [] as Minuta[])
              .catch(() => [] as Minuta[])
          )
        ),
        fetch(`/api/pedidos/${u!.id}?_t=${Date.now()}`, { credentials: "include" }),
      ]);
      // Unir minutas de todos los casinos accesibles, deduplicando por id.
      const seenIds = new Set<string>();
      const minutasData: Minuta[] = [];
      for (const arr of minutasArrays) {
        for (const m of arr) {
          if (!seenIds.has(m.id)) { seenIds.add(m.id); minutasData.push(m); }
        }
      }
      const pedidosData: Pedido[] = pedidosRes.ok ? await pedidosRes.json() : [];

      const todayMins = minutasData.filter((m) => m.fecha === today && m.activo);
      if (todayMins.length === 0) {
        setErrMsg("No hay menú disponible para hoy en tu casino.");
        setStep("error");
        return;
      }

      // ── Flujo de CONSUMO (módulo Tótem) ──
      // El tótem es para retirar el vale, no para inscribirse. Tres casos:
      //  1) Tiene pedido válido del día → mostrar QR (o "ya impreso" si corresponde).
      //  2) Tiene pedido "no_asiste" → mensaje + sugerir vale visita al interlocutor.
      //  3) No tiene pedido → auto-crear pedido con Opción 1 (asignación default).
      const todayIds = new Set(todayMins.map(m => m.id));
      const todayPedidos = pedidosData.filter(p => todayIds.has(p.minutaId));
      // Priorizar pedido VÁLIDO (opcion>0) sobre "no_asiste". Si en el mismo día
      // hay varias minutas/familias y al menos una tiene un pedido válido,
      // mostramos el vale; no_asiste solo gana si TODOS los pedidos del día son 0.
      const existingValid = todayPedidos.find(p => p.opcionSeleccionada > 0);
      const existingNoAsiste = todayPedidos.find(p => p.opcionSeleccionada === 0);
      const existingToday = existingValid || existingNoAsiste;

      // Caso 2: solo no_asiste (sin ningún pedido válido).
      if (!existingValid && existingNoAsiste) {
        setStep("no_asiste_msg");
        try { await apiRequest("POST", "/api/auth/logout"); } catch {}
        return;
      }

      // Casos 1 + 3 unificados vía auto-totem:
      //  · Caso 1 (pedido existente, no impreso) → action "marked_existing" → imprimir
      //  · Caso 1 (pedido existente, ya impreso)  → action "already_printed" → ya_impreso
      //  · Caso 3 (sin pedido)                    → action "created"         → imprimir
      // CRÍTICO: si ya tiene pedido válido, usar SU minutaId — no siempre todayMins[0].
      // Con varias minutas en el día (Almuerzo + Colación), todayMins[0] podría ser
      // distinto al pedido inscrito, haciendo que el servidor no encontrara el pedido
      // existente y creara uno nuevo → el comensal podía imprimir un segundo vale.
      // Enviar fecha LOCAL (Chile) para evitar desfase UTC.
      // Bloque crítico: emisión del pedido. Lo separamos en dos fases para que
      // un fallo POST-creación (ej: getOptions, preloadResumen, una excepción
      // en setState) no muestre "Algo salió mal" cuando el pedido YA existe en
      // el servidor — el comensal igual debe poder ver/imprimir su vale.
      let pedido: (Pedido & { action?: string }) | null = null;
      let minutaUsada: Minuta = todayMins[0];
      try {
        minutaUsada = existingValid
          ? (todayMins.find(m => m.id === existingValid.minutaId) ?? todayMins[0])
          : todayMins[0];
        const res = await apiRequest("POST", "/api/pedidos/auto-totem", {
          userId: u!.id,
          minutaId: minutaUsada.id,
          fecha: todayISO(),
        });
        const data = await res.json();
        if (!res.ok) {
          // Mensaje detallado del servidor + código HTTP para que el cliente
          // pueda enviarnos screenshot si vuelve a fallar.
          const serverMsg = data?.message || data?.error || `HTTP ${res.status}`;
          setErrMsg(`No se pudo emitir tu vale: ${serverMsg}`);
          setStep("error");
          try { await apiRequest("POST", "/api/auth/logout"); } catch {}
          return;
        }
        pedido = data;
      } catch (err: any) {
        // Falló la llamada misma (red, parse). Mostramos el mensaje real.
        const detail = err?.message || String(err) || "error desconocido";
        setErrMsg(`No se pudo emitir tu vale: ${detail}`);
        setStep("error");
        return;
      }

      // A partir de acá el pedido YA existe en el servidor. Cualquier excepción
      // posterior se loguea pero NO bloquea al comensal: igual mostramos QR.
      if (pedido!.action === "already_printed") {
        setStep("ya_impreso");
        try { await apiRequest("POST", "/api/auth/logout"); } catch {}
        return;
      }
      try {
        const opt = getOptions(minutaUsada).find(o => o.number === pedido!.opcionSeleccionada);
        const nowDate = new Date();
        setQrCode(pedido!.codigoQr || pedido!.id);
        setQrPedidoId(pedido!.id);
        setQrMeta({
          familia: minutaUsada.familia || "Almuerzo",
          opcion: opt?.text || `Opción ${pedido!.opcionSeleccionada}`,
          nombre: `${u!.nombre} ${u!.apellido}`,
          rut: formatRutDisplay(u!.rut),
          fecha: nowDate.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }),
          hora: nowDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        });
      } catch (err) {
        // Datos mínimos para que el QR igual se imprima.
        console.error("[totem] error armando qrMeta:", err);
        setQrCode(pedido!.codigoQr || pedido!.id);
        setQrPedidoId(pedido!.id);
        setQrMeta({
          familia: minutaUsada.familia || "Almuerzo",
          opcion: `Opción ${pedido!.opcionSeleccionada}`,
          nombre: `${u!.nombre} ${u!.apellido}`,
          rut: formatRutDisplay(u!.rut),
          fecha: new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }),
          hora: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        });
      }
      try { await preloadResumenForPrint(); } catch (e) { console.error("[totem] preloadResumen falló:", e); }
      setStep("qr");
      try { await apiRequest("POST", "/api/auth/logout"); } catch {}
      return;
    } catch (err: any) {
      const detail = err?.message || String(err) || "error desconocido";
      setErrMsg(`No se pudo cargar tu menú: ${detail}`);
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

  // Pre-carga el resumen ANTES del logout. La sesión del comensal se cierra
  // apenas entramos al paso "qr", entonces el useEffect de impresión ya no
  // puede hacer fetch (401). Llamamos esto justo antes de cada setStep("qr").
  async function preloadResumenForPrint() {
    const cid = selectedCasinoId || casino?.id;
    if (!cid) return;
    setPrintTime(new Date());
    try { await loadResumen(cid); } catch {}
  }

  async function loadResumen(casinoId: string): Promise<any | null> {
    try {
      // Pasar fecha del cliente (timezone local) para evitar desfase UTC.
      const fecha = todayISO();
      const r = await fetch(`/api/reportes/resumen-dia/${casinoId}?fecha=${fecha}&_t=${Date.now()}`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setResumen(data);
        return data;
      }
    } catch {}
    return null;
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
      // Dos modos:
      //  a) `resetTargetRut` lleno → staff está reseteando la clave de OTRO
      //     usuario (comensal o staff dentro de su scope). Usa endpoint
      //     reset-password-by-rut, no pide clave actual.
      //  b) vacío → cambio de clave propia (con currentPassword si no es forzado).
      if (resetTargetRut) {
        const res = await apiRequest("POST", "/api/auth/reset-password-by-rut", {
          rut: normalizeRutForApi(resetTargetRut),
          newPassword: newPwd,
        });
        if (!res.ok) {
          let serverMsg = "";
          try { const j = await res.json(); serverMsg = j?.message || ""; } catch {}
          throw new Error(serverMsg || `HTTP ${res.status}`);
        }
        setErrMsg("Clave actualizada para el usuario.");
        setTimeout(reset, 1800);
        return;
      }
      // Si NO es cambio forzado, el backend exige currentPassword.
      // Reutilizamos la clave que el usuario acaba de tipear al ingresar.
      const body: { newPassword: string; currentPassword?: string } = { newPassword: newPwd };
      if (!user?.passwordChangeRequired && lastLoginPwd) {
        body.currentPassword = lastLoginPwd;
      }
      const res = await apiRequest("POST", "/api/auth/change-password", body);
      if (!res.ok) {
        let serverMsg = "";
        try { const j = await res.json(); serverMsg = j?.message || ""; } catch {}
        throw new Error(serverMsg || `HTTP ${res.status}`);
      }
      setErrMsg("Clave actualizada. Vuelve a ingresar.");
      setTimeout(reset, 1500);
    } catch (e: any) {
      // Surface el mensaje real del servidor (clave actual incorrecta, sesión
      // expirada, etc.) para que el operador pueda diagnosticar en sitio.
      const msg = String(e?.message || "").trim();
      setErrMsg(msg ? `No se pudo cambiar la clave: ${msg}` : "No se pudo cambiar la clave");
    } finally { setBusy(false); }
  }

  // ── Staff: Vale propio (auto-opcion 1, solo 1 por día) ──
  // Cliente pidió: 1 vale propio por día. Si no hay inscripción previa, debe
  // emitirse opción 1 automáticamente SIN ERRORES (docx 25/05). Usa el mismo
  // endpoint /api/pedidos/auto-totem que el flujo comensal — éste maneja:
  //  · pedido nuevo: crea con opción 1 + marca impreso
  //  · pedido existente sin imprimir: marca impreso y devuelve
  //  · pedido existente impreso: devuelve impresoEn → UI muestra "ya_impreso"
  //  · pedido no_asiste: lo flipea a opción 1 + marca impreso
  async function handleStaffValePropio() {
    if (!user) return;
    if (todayMinutas.length === 0) {
      setErrMsg("No hay minuta para hoy.");
      setStep("error");
      return;
    }
    setBusy(true);
    setErrMsg("");
    try {
      const minuta = todayMinutas[0];
      const res = await apiRequest("POST", "/api/pedidos/auto-totem", {
        userId: user.id,
        minutaId: minuta.id,
        fecha: todayISO(),
      });
      const pedido: Pedido & { action?: "created" | "marked_existing" | "already_printed" } = await res.json();
      // Determinístico desde el server: si ya estaba impreso ANTES de esta
      // llamada, mostrar "ya_impreso" — la reemisión va por flujo Reimpresión.
      if (pedido.action === "already_printed") {
        setBusy(false);
        setStep("ya_impreso");
        try { await apiRequest("POST", "/api/auth/logout"); } catch {}
        return;
      }
      const opt = getOptions(minuta).find(o => o.number === pedido.opcionSeleccionada);
      const nowDate = new Date();
      setQrCode(pedido.codigoQr || pedido.id);
      setQrPedidoId(pedido.id);
      setQrMeta({
        familia: minuta.familia || "Almuerzo",
        opcion: opt?.text || `Opción ${pedido.opcionSeleccionada}`,
        nombre: `${user.nombre} ${user.apellido}`,
        rut: formatRutDisplay(user.rut),
        fecha: nowDate.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }),
        hora: nowDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      });
      setBusy(false);
      await preloadResumenForPrint();
      setStep("qr");
      try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    } catch {
      setBusy(false);
      setErrMsg("No se pudo emitir tu vale. Intenta nuevamente.");
      setStep("error");
    }
  }

  // ── Staff: Vale visita ──
  // Cliente pidió: eliminar el paso de pedir RUT del visitante. Ir directo a nombre.
  async function handleVisitaSubmit() {
    if (!user) return;
    if (!visitaRut || visitaRut.length < 2) { setErrMsg("Ingresa el RUT del visitante"); return; }
    setErrMsg("");
    setStep("vale_visita_nombre");
  }
  async function handleVisitaNombreSubmit(nombreOverride?: string) {
    const nombreFinal = (nombreOverride ?? visitaNombre).trim() || "Visita";
    if (todayMinutas.length === 0) { setErrMsg("No hay minuta para hoy."); setStep("error"); return; }
    setErrMsg("");
    setBusy(true);
    try {
      const minuta = todayMinutas[0];
      const res = await apiRequest("POST", "/api/pedidos/visita", {
        userId: user!.id,
        minutaId: minuta.id,
        nombreVisita: nombreFinal,
      });
      const pedido: Pedido = await res.json();
      const nowDate = new Date();
      setQrCode(pedido.codigoQr || pedido.id);
      setQrPedidoId(pedido.id);
      setQrMeta({
        familia: minuta.familia || "Almuerzo",
        opcion: `Visita: ${nombreFinal}`,
        nombre: nombreFinal,
        rut: "—",
        fecha: nowDate.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }),
        hora: nowDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      });
      // Marcar impreso ANTES del logout (mismo motivo que en selectOption).
      try { await apiRequest("POST", `/api/pedidos/${pedido.id}/marcar-impreso`, {}); } catch {}
      // Vale visita: el ticket impreso debe ser el VALE individual del
      // visitante, NO el resumen del día. (Pedido cliente 27/05/2026.)
      setPrintMode("vale");
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
      const r = await fetch(`/api/pedidos/buscar/por-rut?rut=${encodeURIComponent(normalizeRutForApi(reimpRut))}&fecha=${todayISO()}`, { credentials: "include" });
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (!data.user) { setErrMsg("No se encontró un comensal con ese RUT"); setBusy(false); return; }
      setReimpResult(data);
      setStep("reimp_list");
    } catch {
      setErrMsg("No se pudo buscar el vale");
    } finally { setBusy(false); }
  }
  async function showReimpQR(p: Pedido) {
    if (!reimpResult) return;
    const minuta = reimpResult.minutas.find(m => m.id === p.minutaId);
    if (!minuta) return;
    const opt = minuta ? getOptions(minuta).find(o => o.number === p.opcionSeleccionada) : null;
    // Reimpresión: usar hora ORIGINAL del pedido (cliente pidió que la hora
    // refleje cuándo se emitió el vale, no la hora de la reimpresión).
    const ts = p.impresoEn || p.createdAt;
    const origDate = ts ? new Date(ts) : new Date();
    setQrCode(p.codigoQr || p.id);
    setQrPedidoId(p.id);
    setQrMeta({
      familia: minuta.familia || "Almuerzo",
      opcion: opt?.text || `Opción ${p.opcionSeleccionada}`,
      nombre: `${reimpResult.user.nombre} ${reimpResult.user.apellido}`,
      rut: formatRutDisplay(reimpResult.user.rut),
      fecha: origDate.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }),
      hora: origDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
    });
    // Reimpresión: imprimir la COPIA DEL VALE individual, no el resumen del día.
    // (Pedido cliente 27/05/2026 tarde.)
    setPrintMode("vale");
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
      const nowDate = new Date();
      setQrCode(pedido.codigoQr || pedido.id);
      setQrPedidoId(pedido.id);
      setQrMeta({
        familia: minuta.familia || "Almuerzo",
        opcion: opt?.text || `Opción ${pedido.opcionSeleccionada}`,
        nombre: `${user.nombre} ${user.apellido}`,
        rut: formatRutDisplay(user.rut),
        fecha: nowDate.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }),
        hora: nowDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      });
      // CRÍTICO: marcar impreso ANTES del logout. Si se hace después, el
      // useEffect de impresión llama marcar-impreso ya sin sesión (401),
      // `impresoEn` nunca queda en BD y el comensal puede re-imprimir
      // re-logueándose. Ahora el segundo login muestra "ya_impreso".
      try { await apiRequest("POST", `/api/pedidos/${pedido.id}/marcar-impreso`, {}); } catch {}
      await preloadResumenForPrint();
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
            <p className="text-vascan-goldLight text-xs leading-tight">Tótem Casino</p>
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

        {step === "change_pwd_rut" && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">RUT del usuario</h2>
              <p className="text-white/50">Ingresa el RUT del comensal cuya clave quieres resetear</p>
            </div>
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-center">
              <p className="text-4xl font-mono font-bold tracking-wider text-vascan-gold min-h-[3rem]">
                {resetTargetRut ? formatRutDisplay(resetTargetRut) : <span className="text-white/20">12.345.678-9</span>}
              </p>
            </div>
            {errMsg && <p className="text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {errMsg}</p>}
            <Keypad
              value={resetTargetRut}
              onChange={(v) => setResetTargetRut(v.slice(0, 9).toUpperCase())}
              onSubmit={() => {
                if (!resetTargetRut || resetTargetRut.length < 2) { setErrMsg("Ingresa un RUT válido"); return; }
                setErrMsg("");
                setNewPwd("");
                setNewPwd2("");
                setPwdStage(1);
                setStep("change_pwd");
              }}
              withK
            />
            <button onClick={() => setStep("staff_menu")} className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm">
              <ArrowLeft className="w-4 h-4" /> Cancelar
            </button>
          </div>
        )}

        {step === "change_pwd" && (
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">{pwdStage === 1 ? "Crea la nueva clave" : "Confirma la nueva clave"}</h2>
              {resetTargetRut ? (
                <p className="text-white/50">Para RUT: <span className="text-vascan-gold font-mono">{formatRutDisplay(resetTargetRut)}</span></p>
              ) : (
                <p className="text-white/50">Mínimo 4 dígitos · solo numérica</p>
              )}
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
                    {(resumen.opciones || []).map((o: any, i: number) => (
                      <div key={`${o.familia || "-"}:${o.numero}:${i}`} className="flex items-center justify-between bg-white/3 rounded-lg px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 shrink-0 rounded-full bg-vascan-gold/20 text-vascan-gold flex items-center justify-center font-bold">{o.numero}</span>
                          <div className="min-w-0">
                            {o.familia && <p className="text-xs text-white/40 uppercase tracking-wide">{o.familia}</p>}
                            <span className="text-white truncate block">{o.descripcion}</span>
                          </div>
                        </div>
                        <span className="text-vascan-gold font-bold text-xl shrink-0 ml-3">{o.cantidad}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-white/60 text-center py-6">No hay menú para hoy.</p>
              )}
            </div>
            <div className="flex justify-center gap-3 flex-wrap">
              <button onClick={() => selectedCasinoId && loadResumen(selectedCasinoId)} className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10">
                Actualizar
              </button>
              <button
                onClick={() => { setPrintTime(new Date()); document.body.classList.add("print-resumen-mode"); window.print(); setTimeout(() => document.body.classList.remove("print-resumen-mode"), 500); }}
                className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/15"
              >
                Imprimir
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
                onClick={() => { setVisitaRut(""); setVisitaNombre("Visita"); setErrMsg(""); handleVisitaNombreSubmit("Visita"); }}
                disabled={busy || todayMinutas.length === 0}
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
              {/* Cliente pidió: el botón de cambio de clave debe estar SIEMPRE
                  disponible para staff en el tótem, sin depender de la flag por
                  casino. */}
              <button
                onClick={() => { setStep("change_pwd_rut"); setResetTargetRut(""); setNewPwd(""); setNewPwd2(""); setPwdStage(1); setErrMsg(""); }}
                className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xl transition sm:col-span-2"
              >
                Cambio de clave
                <p className="text-sm font-normal text-white/60 mt-1">Resetear clave de un comensal por RUT</p>
              </button>
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
              <button onClick={() => setStep("staff_menu")} className="flex-1 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10">
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
          <div className="flex flex-col items-center gap-5">
            <div className="w-32 h-32 rounded-full bg-green-500/15 border-2 border-green-500/40 flex items-center justify-center">
              <Check className="w-20 h-20 text-green-400" />
            </div>
            <h2 className="text-5xl font-bold text-center">¡Listo, {qrMeta.nombre.split(" ")[0]}!</h2>
            <p className="text-white/70 text-xl">Retira tu vale impreso</p>
          </div>
        )}

        {step === "no_asiste_msg" && (
          <div className="flex flex-col items-center gap-5 text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-orange-300" />
            </div>
            <h2 className="text-2xl font-bold">Tu inscripción dice "No asisto"</h2>
            <p className="text-white/60">
              Si decides almorzar, acércate al interlocutor del casino para que te emita un vale de visita.
            </p>
            <button
              onClick={reset}
              className="px-8 py-3 rounded-xl bg-vascan-gold hover:bg-vascan-goldDark text-vascan-bg font-bold"
            >
              Volver al inicio
            </button>
          </div>
        )}

        {step === "ya_impreso" && (
          <div className="flex flex-col items-center gap-5 text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold">Ya retiraste tu vale hoy</h2>
            <p className="text-white/60">
              Tu vale ya fue impreso. Si lo necesitas nuevamente, pídeselo al encargado del casino para una reimpresión.
            </p>
            <button
              onClick={reset}
              className="px-8 py-3 rounded-xl bg-vascan-gold hover:bg-vascan-goldDark text-vascan-bg font-bold"
            >
              Volver al inicio
            </button>
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
          <div className="pv-title">&gt;&gt; CASINO &lt;&lt;</div>
          {casino?.nombre && <div className="pv-sub">{casino.nombre}</div>}
          <div className="pv-sub">VALE DE CONTROL INTERNO</div>
          <hr className="pv-hr" />
          <div className="pv-familia">{qrMeta.familia}</div>
          <div className="pv-opcion">{qrMeta.opcion}</div>
          <hr className="pv-hr" />
          <div className="pv-row">
            <span className="pv-label">Nombre</span>
            <span className="pv-value">{qrMeta.nombre}</span>
          </div>
          <div className="pv-row">
            <span className="pv-label">RUT</span>
            <span className="pv-value">{qrMeta.rut}</span>
          </div>
          <div className="pv-row">
            <span className="pv-label">Fecha</span>
            <span className="pv-value">
              {qrMeta.fecha || new Date().toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          </div>
          <div className="pv-row">
            <span className="pv-label">Hora</span>
            <span className="pv-value">
              {qrMeta.hora || new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <hr className="pv-hr" />
          <div className="pv-foot">BuenaMezcla · Vale no reimprimible</div>
        </div>
      )}

      {/* Layout imprimible del resumen (térmica 80mm). DEBE estar SIEMPRE en
          el DOM (no dentro de step==="resumen") porque también se imprime
          desde el flujo del comensal en step==="qr". Solo visible cuando
          body tiene .print-resumen-mode + @media print. */}
      <div className="print-resumen" aria-hidden="true">
        {(() => {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, "0");
          // Formato local 24h, sin segundos: DD/MM/YYYY HH:MM
          const fmtDateTime = (d: Date) =>
            `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
          const nowDateTime = fmtDateTime(printTime || now);
          // Ventana de servicio del periodo activo (Desde/Hasta). Si el casino
          // no tiene periodo activo, mostramos placeholder para que sea evidente.
          const PLACEHOLDER = "--/--/----  --:--";
          const desdeStr = resumen?.periodo?.fechaInicio
            ? fmtDateTime(new Date(resumen.periodo.fechaInicio))
            : PLACEHOLDER;
          const hastaStr = resumen?.periodo?.fechaFin
            ? fmtDateTime(new Date(resumen.periodo.fechaFin))
            : PLACEHOLDER;
          // Fecha del día de servicio para los subtítulos de OPCIONES DE MENÚ.
          const resumenDateStr = resumen?.fecha
            ? (() => { const [y, m, d] = resumen.fecha.split("-"); return `${d}/${m}/${y}`; })()
            : `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
          // Agrupar opciones por familia para las dos secciones del ticket.
          const titleCase = (s: string) =>
            s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
          const familiaServicio = new Map<string, number>();
          const familiaOpciones = new Map<string, Array<{ numero: number; descripcion: string; cantidad: number }>>();
          for (const o of (resumen?.opciones || [])) {
            const famRaw = (o.familia || "Servicio").trim();
            const fam = titleCase(famRaw);
            familiaServicio.set(fam, (familiaServicio.get(fam) || 0) + o.cantidad);
            if (!familiaOpciones.has(fam)) familiaOpciones.set(fam, []);
            familiaOpciones.get(fam)!.push({ numero: o.numero, descripcion: o.descripcion, cantidad: o.cantidad });
          }
          const grandTotal = (resumen?.totalSeleccion || 0) + (resumen?.totalVisitas || 0);
          return (
            <>
              {/* Cabecera: 3 líneas centradas según mockup aprobado por cliente. */}
              <div className="pr-title">&gt;&gt; CASINO &lt;&lt;</div>
              <div className="pr-casino-name">{casino?.nombre || ""}</div>
              <div className="pr-doc-title">VALE DE CONTROL INTERNO</div>
              <hr className="pr-hr" />
              {/* Bloque rótulo:valor alineado a la izquierda, formato 24h sin segundos */}
              <div className="pr-info-row"><span className="pr-info-lbl">Informe:</span><span className="pr-info-val">{nowDateTime}</span></div>
              <div className="pr-info-row"><span className="pr-info-lbl">Desde:</span><span className="pr-info-val">{desdeStr}</span></div>
              <div className="pr-info-row"><span className="pr-info-lbl">Hasta:</span><span className="pr-info-val">{hastaStr}</span></div>
              <hr className="pr-hr" />
              {resumen?.minuta ? (
                <>
                  <div className="pr-section">RESUMEN DE SERVICIOS</div>
                  <div className="pr-col-hdr">
                    <span className="pr-col-svc">Servicio</span>
                    <span className="pr-col-qty">Cant.</span>
                  </div>
                  {[...familiaServicio.entries()].map(([familia, qty]) => (
                    <div key={familia} className="pr-svc-row">
                      <span className="pr-col-svc">{familia}</span>
                      <span className="pr-col-qty">{qty}</span>
                    </div>
                  ))}
                  {(resumen.totalVisitas || 0) > 0 && (
                    <div className="pr-svc-row">
                      <span className="pr-col-svc">VISITAS</span>
                      <span className="pr-col-qty">{resumen.totalVisitas}</span>
                    </div>
                  )}
                  <div className="pr-total-row">
                    <span className="pr-col-svc">TOTAL</span>
                    <span className="pr-col-qty">{grandTotal}</span>
                  </div>
                  <hr className="pr-hr" />
                  <div className="pr-section">OPCIONES DE MENÚ</div>
                  {[...familiaOpciones.entries()].map(([familia, opciones]) => {
                    const subtotal = opciones.reduce((acc, o) => acc + o.cantidad, 0);
                    return (
                      <div key={familia}>
                        <div className="pr-date-hdr">{resumenDateStr} — {familia}</div>
                        {opciones.map((o, i) => (
                          <div key={`${familia}:${o.numero}:${i}`} className="pr-opt-row">
                            <span className="pr-opt-num">{o.numero}.</span>
                            <span className="pr-opt-desc">{o.descripcion}</span>
                            <span className="pr-opt-qty">{o.cantidad}</span>
                          </div>
                        ))}
                        <div className="pr-opt-total">
                          <span className="pr-col-svc">TOTAL</span>
                          <span className="pr-col-qty">{subtotal}</span>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="pr-center">Sin menú para hoy.</div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
