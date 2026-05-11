import React, { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  UtensilsCrossed,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Check,
  RefreshCw,
  QrCode,
  Clock,
  CalendarDays,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api";
import QRModal from "@/components/QRModal";
import Toast from "@/components/Toast";

// ── Types ──────────────────────────────────────────────────────────────────
interface Minuta {
  id: string;
  casinoId: string;
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
  userId: string;
  minutaId: string;
  opcionSeleccionada: number;
  tipo?: string;
  codigoQr: string | null;
}

type DaySelection = {
  minutaId: string;
  opcionSeleccionada: number;
  tipo: "seleccion" | "no_asiste";
};

type ToastState = { message: string; type: "success" | "error" | "warning" } | null;

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS_ES   = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS_ES  = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTHS_FULL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// Los rangos del periodo activo determinan los chips disponibles. No hay
// rangos calendario fijos: todo se calcula sobre la ventana de servicio.

// ── Helpers ────────────────────────────────────────────────────────────────
function getOptions(m: Minuta) {
  const opts: { number: number; text: string }[] = [
    { number: 1, text: m.opcion1 },
    { number: 2, text: m.opcion2 },
    { number: 3, text: m.opcion3 },
  ];
  if (m.opcion4) opts.push({ number: 4, text: m.opcion4 });
  if (m.opcion5) opts.push({ number: 5, text: m.opcion5 });
  return opts;
}

function parseDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00");
}

/** Returns ISO week number (Mon=start) */
function getISOWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

/** Monday of the week containing d */
function weekStart(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

/** Friday of the week containing d */
function weekEnd(d: Date): Date {
  const fri = weekStart(d);
  fri.setDate(fri.getDate() + 4);
  return fri;
}

function weekGroupKey(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${d.getFullYear()}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

function weekGroupLabel(dateStr: string): string {
  const d = parseDate(dateStr);
  const mon = weekStart(d);
  const fri = weekEnd(d);
  const monStr = `${mon.getDate()} ${MONTHS_ES[mon.getMonth()]}`;
  const friStr = `${fri.getDate()} ${MONTHS_ES[fri.getMonth()]}`;
  return `Semana ${getISOWeek(d)} — ${monStr} al ${friStr}`;
}

// ── Home Screen ────────────────────────────────────────────────────────────
export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selections, setSelections] = useState<Record<string, DaySelection>>({});
  const [expandedMinuta, setExpandedMinuta] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [activeChip, setActiveChip] = useState<string>("all");
  const [qrModal, setQrModal] = useState<{
    qrCode: string; opcionNum: number; opcionText: string; fecha: string;
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: ToastState["type"]) => setToast({ message, type }),
    []
  );

  // ── Queries ──
  // Usamos /api/minutas-disponibles que ya filtra por la ventana de servicio
  // del periodo activo (cuando está definida). Devuelve { minutas, periodo }.
  const { data: disponibles, isLoading, isRefetching, refetch } = useQuery<{ minutas: Minuta[]; periodo: any }>({
    queryKey: ["/api/minutas-disponibles", user?.casinoId ?? "none"],
    enabled: !!user?.casinoId,
  });
  const minutas = disponibles?.minutas;

  const { data: periodoData } = useQuery<{ activo: boolean; periodo: { fechaInicio: string; fechaFin: string; fechaServicioInicio?: string | null; fechaServicioFin?: string | null } | null; fechaServicioInicio?: string | null; fechaServicioFin?: string | null }>({
    queryKey: ["/api/periodo-activo", user?.casinoId ?? "none"],
    enabled: !!user?.casinoId,
  });

  const { data: pedidos } = useQuery<Pedido[]>({
    queryKey: ["/api/pedidos", user?.id ?? "none"],
    enabled: !!user?.id,
  });

  const periodoActivo = periodoData?.activo ?? false;

  // ── Derived: filter + sort + group by week ──
  const todayStr = new Date().toISOString().split("T")[0];
  const today = parseDate(todayStr);

  // Chips reflejan los rangos reales del periodo activo (semanas dentro de la
  // ventana de servicio). Si no hay periodo activo, no hay chips.
  const chips = useMemo(() => {
    const all = (minutas ?? []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (all.length === 0) return [] as { key: string; label: string; from: string; to: string }[];
    const out: { key: string; label: string; from: string; to: string }[] = [];
    out.push({ key: "all", label: "Todo el periodo", from: all[0].fecha, to: all[all.length - 1].fecha });
    const seen = new Set<string>();
    for (const m of all) {
      const k = weekGroupKey(m.fecha);
      if (seen.has(k)) continue;
      seen.add(k);
      const items = all.filter(x => weekGroupKey(x.fecha) === k);
      out.push({ key: k, label: weekGroupLabel(items[0].fecha).replace(/\sSemana\s/, "Sem ").replace(/—.*/, "").trim(), from: items[0].fecha, to: items[items.length - 1].fecha });
    }
    return out;
  }, [minutas]);

  const sortedMinutas = useMemo(() => {
    const all = (minutas ?? []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (activeChip === "all") return all;
    const chip = chips.find(c => c.key === activeChip);
    if (!chip) return all;
    return all.filter(m => m.fecha >= chip.from && m.fecha <= chip.to);
  }, [minutas, activeChip, chips]);

  /** Grouped as ordered array of { key, label, items } */
  const weekGroups = useMemo(() => {
    const map = new Map<string, { label: string; items: Minuta[] }>();
    for (const m of sortedMinutas) {
      const key = weekGroupKey(m.fecha);
      if (!map.has(key)) {
        map.set(key, { label: weekGroupLabel(m.fecha), items: [] });
      }
      map.get(key)!.items.push(m);
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
  }, [sortedMinutas]);

  const pedidoByMinuta = useMemo(() => {
    const map: Record<string, Pedido> = {};
    (pedidos ?? []).forEach((p) => { map[p.minutaId] = p; });
    return map;
  }, [pedidos]);

  // ── Mutations ──
  const submitWeek = useMutation({
    mutationFn: async (selArray: DaySelection[]) => {
      const res = await apiRequest("POST", "/api/pedidos/semanal", {
        userId: user!.id,
        selecciones: selArray,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/pedidos"] });
      setSelections({});
      const skipped = Array.isArray(data?.skipped) ? data.skipped : [];
      const okCount = Array.isArray(data?.results) ? data.results.length : 0;
      if (skipped.length > 0 && okCount > 0) {
        showToast(`Se registraron ${okCount} días. ${skipped.length} fueron omitidos por estar fuera de la ventana de inscripción.`, "warning");
      } else if (skipped.length > 0 && okCount === 0) {
        showToast("Ningún día pudo registrarse: todos están fuera de la ventana de inscripción.", "error");
      } else {
        showToast("¡Inscripción registrada correctamente!", "success");
      }
    },
    onError: (err: Error) => {
      showToast(err.message || "Hubo un problema al registrar la inscripción.", "error");
    },
  });

  // ── Handlers ──
  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function selectOption(minutaId: string, opcion: number) {
    setSelections((prev) => ({
      ...prev,
      [minutaId]: { minutaId, opcionSeleccionada: opcion, tipo: "seleccion" },
    }));
    setExpandedMinuta(null);
  }

  function selectNoAsiste(minutaId: string) {
    setSelections((prev) => ({
      ...prev,
      [minutaId]: { minutaId, opcionSeleccionada: 0, tipo: "no_asiste" },
    }));
    setExpandedMinuta(null);
  }

  function toggleMinuta(minutaId: string) {
    setExpandedMinuta((prev) => (prev === minutaId ? null : minutaId));
  }

  function handleSubmitWeek() {
    if (!periodoActivo || !periodoData?.periodo) {
      showToast("No hay un periodo de inscripción activo. Contacta a tu administrador.", "warning");
      return;
    }
    // Validate ALL days within the ACTIVE PERIOD have a selection (new or already registered)
    const pStart = new Date(periodoData.periodo.fechaInicio);
    const pEnd = new Date(periodoData.periodo.fechaFin);
    const startCheck = pStart < today ? today : pStart;
    const minutasEnPeriodo = (minutas ?? []).filter(m => {
      const d = parseDate(m.fecha);
      return d >= startCheck && d <= pEnd;
    });
    const unregistered = minutasEnPeriodo.filter(m => !pedidoByMinuta[m.id] && !selections[m.id]);
    if (unregistered.length > 0) {
      showToast(`Debes inscribir TODOS los días del período activo. Faltan ${unregistered.length} día${unregistered.length > 1 ? "s" : ""}.`, "warning");
      return;
    }
    const selArray = Object.values(selections);
    if (selArray.length === 0) {
      showToast("No hay cambios para guardar.", "warning");
      return;
    }
    submitWeek.mutate(selArray);
  }

  function openQrModal(minuta: Minuta, pedido: Pedido) {
    const options = getOptions(minuta);
    const opt = options.find((o) => o.number === pedido.opcionSeleccionada);
    setQrModal({
      qrCode: pedido.codigoQr || pedido.id,
      opcionNum: pedido.opcionSeleccionada,
      opcionText: opt?.text ?? "",
      fecha: minuta.fecha,
    });
  }

  // ── Status helpers ──
  function getDayStatus(minuta: Minuta): "registered" | "selected" | "no_asiste" | "pending" {
    const pedido = pedidoByMinuta[minuta.id];
    if (pedido) return pedido.opcionSeleccionada === 0 ? "no_asiste" : "registered";
    const sel = selections[minuta.id];
    if (sel) return sel.tipo === "no_asiste" ? "no_asiste" : "selected";
    return "pending";
  }

  const statusStyles = {
    registered: { dot: "bg-green-500",   badge: "bg-green-500/15 text-green-400",  label: "Inscrito",      border: "#22C55E" },
    selected:   { dot: "bg-green-300",   badge: "bg-green-300/15 text-green-300",  label: "Seleccionado",  border: "#86EFAC" },
    no_asiste:  { dot: "bg-orange-500",  badge: "bg-orange-500/15 text-orange-400",label: "No asiste",     border: "#F97316" },
    pending:    { dot: "bg-white/15",    badge: "bg-white/6 text-white/30",        label: "Pendiente",     border: "rgba(255,255,255,0.12)" },
  };

  const pendingSelections = Object.keys(selections).length;

  // ── Render ──
  return (
    <div className="h-full flex flex-col bg-vascan-bg overflow-hidden">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {qrModal && (
        <QRModal
          qrCode={qrModal.qrCode}
          opcionNum={qrModal.opcionNum}
          opcionText={qrModal.opcionText}
          fecha={qrModal.fecha}
          onClose={() => setQrModal(null)}
        />
      )}

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 pt-12 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-vascan-bg flex items-center justify-center">
            <img src="/logo.png" alt="BuenaMezcla" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-white font-semibold text-base leading-tight">Hola, {user?.nombre}</p>
            <p className="text-vascan-goldLight text-xs leading-tight capitalize">
              {user?.role === "admin" ? "Administrador" : user?.role === "interlocutor" ? "Interlocutor" : "Comensal"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/historial")}
            className="w-9 h-9 rounded-lg bg-white/6 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
            title="Historial de pedidos"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="w-9 h-9 rounded-lg bg-white/6 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-lg bg-white/6 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Section title + range selector ── */}
      <div className="flex-shrink-0 px-5 pb-3 space-y-3">
        <div className="flex items-center gap-2.5">
          <UtensilsCrossed className="w-5 h-5 text-vascan-gold" />
          <h2 className="text-white font-semibold text-lg">Inscripción</h2>
        </div>

        {/* Range pills (basadas en la ventana de servicio del periodo activo) */}
        {chips.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => setActiveChip(c.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeChip === c.key
                    ? "bg-vascan-gold text-vascan-bg"
                    : "bg-white/6 text-white/45 hover:text-white/70 border border-white/8"
                }`}
              >
                <CalendarDays className="w-3 h-3" />
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-vascan-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-white/40 text-sm">Cargando minutas...</p>
        </div>
      ) : !user?.casinoId ? (
        <EmptyState
          icon={<AlertCircle className="w-10 h-10 text-white/20" />}
          title="Sin casino asignado"
          subtitle="Contacta a tu administrador para ser asignado a un casino"
        />
      ) : !periodoActivo ? (
        <EmptyState
          icon={<AlertCircle className="w-10 h-10 text-yellow-400/60" />}
          title="Sin periodo activo"
          subtitle="No hay un periodo de inscripción abierto en este momento. Vuelve cuando tu administrador lo habilite."
        />
      ) : sortedMinutas.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed className="w-10 h-10 text-white/20" />}
          title="Sin minutas disponibles"
          subtitle="No hay menús cargados para la ventana de servicio del periodo activo."
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pb-6 space-y-5">

            {/* Period warning */}
            {!periodoActivo && (
              <div className="flex items-start gap-2.5 bg-yellow-500/10 border border-yellow-500/25 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-400 text-sm leading-relaxed">
                  El periodo de inscripción no está activo. Solo puedes ver el menú.
                </p>
              </div>
            )}

            {/* Week groups */}
            {weekGroups.map((group, gi) => (
              <div key={group.key}>
                {/* Week header separator */}
                <div className="flex items-center gap-3 mb-2.5">
                  <p className="text-vascan-gold/60 text-[11px] font-semibold uppercase tracking-wider flex-shrink-0">
                    {group.label}
                  </p>
                  <div className="flex-1 h-px bg-white/6" />
                </div>

                {/* Day cards */}
                <div className="space-y-2.5">
                  {group.items.map((minuta) => {
                    const d = parseDate(minuta.fecha);
                    const dayShort = DAYS_SHORT[d.getDay()];
                    const dayFull  = DAYS_ES[d.getDay()];
                    const dayNum   = d.getDate();
                    const month    = MONTHS_ES[d.getMonth()];
                    const isToday  = minuta.fecha === todayStr;
                    const status   = getDayStatus(minuta);
                    const st       = statusStyles[status];
                    const isExpanded      = expandedMinuta === minuta.id;
                    const pedido          = pedidoByMinuta[minuta.id];
                    const sel             = selections[minuta.id];
                    const options         = getOptions(minuta);
                    const alreadyRegistered = !!pedido;

                    const canModify = periodoActivo;

                    return (
                      <div
                        key={minuta.id}
                        className="rounded-2xl border overflow-hidden"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(255,255,255,0.10)",
                        }}
                      >
                        {/* Card header */}
                        <button
                          onClick={() => canModify && toggleMinuta(minuta.id)}
                          className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors ${
                            canModify ? "active:bg-white/5" : ""
                          } ${isToday ? "bg-vascan-gold/5" : ""}`}
                          style={{ borderLeft: `4px solid ${st.border}` }}
                        >
                          {/* Left: date */}
                          <div className="flex items-center gap-3.5">
                            <div className="text-center w-10">
                              <p className={`text-[10px] uppercase font-medium tracking-wide ${isToday ? "text-vascan-gold" : "text-white/35"}`}>
                                {dayShort}
                              </p>
                              <p className={`text-xl font-bold leading-none my-0.5 ${isToday ? "text-vascan-gold" : "text-white"}`}>
                                {dayNum}
                              </p>
                              <p className="text-[10px] text-white/35">{month}</p>
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">{dayFull}</p>
                              <p className="text-vascan-goldLight text-xs capitalize">{minuta.familia || "Almuerzo"}</p>
                            </div>
                          </div>

                          {/* Right: status + chevron */}
                          <div className="flex items-center gap-2">
                            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${st.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </span>
                            {canModify && (
                              isExpanded
                                ? <ChevronUp className="w-4 h-4 text-white/30" />
                                : <ChevronDown className="w-4 h-4 text-white/30" />
                            )}
                          </div>
                        </button>

                        {/* Expanded options */}
                        {isExpanded && canModify && (
                          <div className="px-4 pt-3 pb-4 border-t border-white/8 space-y-2">
                            <p className="text-white/50 text-xs font-medium mb-3">Selecciona tu opción:</p>
                            {options.map((opt) => {
                              const isSelected = sel?.tipo === "seleccion" && sel?.opcionSeleccionada === opt.number;
                              return (
                                <button
                                  key={opt.number}
                                  onClick={() => selectOption(minuta.id, opt.number)}
                                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all ${
                                    isSelected
                                      ? "border-green-500/60 bg-green-500/8"
                                      : "border-white/8 bg-white/3 hover:border-white/15"
                                  }`}
                                >
                                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                    isSelected ? "bg-green-500 text-white" : "bg-vascan-gold/20 text-vascan-gold"
                                  }`}>
                                    {isSelected ? <Check className="w-3.5 h-3.5" /> : opt.number}
                                  </div>
                                  <p className={`flex-1 text-sm leading-snug ${isSelected ? "text-white font-medium" : "text-white/65"}`}>
                                    {opt.text}
                                  </p>
                                  {isSelected && <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />}
                                </button>
                              );
                            })}

                            {/* No asiste */}
                            <button
                              onClick={() => selectNoAsiste(minuta.id)}
                              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                                sel?.tipo === "no_asiste"
                                  ? "bg-orange-500 border-orange-500 text-white"
                                  : "border-orange-500/30 bg-orange-500/5 text-orange-400 hover:border-orange-500/50"
                              }`}
                            >
                              <XCircle className="w-4 h-4" />
                              No asisto este día
                            </button>
                          </div>
                        )}

                        {/* Registered info row */}
                        {alreadyRegistered && !isExpanded && (
                          <div className="px-4 py-2.5 border-t border-white/8">
                            {pedido.opcionSeleccionada === 0 ? (
                              <div className="flex items-center justify-between">
                                <p className="text-white/40 text-xs">No asistirás este día</p>
                                {canModify && <p className="text-white/25 text-xs">Toca para cambiar</p>}
                              </div>
                            ) : sel ? (
                              <p className="text-vascan-gold text-xs font-medium">Cambio pendiente de guardar</p>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); openQrModal(minuta, pedido); }}
                                className="w-full flex items-center justify-between"
                              >
                                <p className="text-white/50 text-xs">
                                  Opción {pedido.opcionSeleccionada} inscrita
                                </p>
                                <span className="flex items-center gap-1.5 text-vascan-gold text-xs font-medium">
                                  <QrCode className="w-3.5 h-3.5" />
                                  Ver vale
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Submit button */}
            {pendingSelections > 0 && (
              <button
                onClick={handleSubmitWeek}
                disabled={submitWeek.isPending}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-green-500 hover:bg-green-400 active:scale-[0.98] disabled:opacity-60 text-white font-semibold text-base transition-all"
              >
                {submitWeek.isPending ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Confirmar Inscripción ({pendingSelections}{" "}
                    {pendingSelections === 1 ? "día" : "días"})
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 pb-16">
      <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
        {icon}
      </div>
      <p className="text-white/50 font-medium text-base text-center">{title}</p>
      <p className="text-white/30 text-sm text-center leading-relaxed">{subtitle}</p>
    </div>
  );
}
