// Background sync worker. Runs in-process inside the totem's Node server.
//
// Two loops:
//  • PULL every 30 s: fetches master data (casinos/familias/users/minutas/periodos
//    scoped to this totem's casino) and upserts into local SQLite.
//  • PUSH every 15 s: drains the sync_outbox of pedidos generated locally and
//    sends them up. On success they are marked acked and removed.
//
// Uses Node 18+ global fetch (also available in Node 20/22). All network errors
// are swallowed and retried — the totem stays operational even when cloud is
// unreachable for hours/days.
import * as fs from "fs";
import * as path from "path";
import { sqlite } from "../server/db";

if (!sqlite) {
  console.warn("[sync] sqlite handle not available — sync worker disabled (DB_MODE=cloud)");
} else {
  startWorker();
}

function getCfg(key: string): string | null {
  const row = sqlite.prepare("SELECT value FROM totem_config WHERE key = ?").get(key) as any;
  return row?.value ?? null;
}
function setCfg(key: string, value: string) {
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run(key, value);
}
function getState(key: string): string | null {
  const row = sqlite.prepare("SELECT value FROM sync_state WHERE key = ?").get(key) as any;
  return row?.value ?? null;
}
function setState(key: string, value: string) {
  sqlite.prepare("INSERT OR REPLACE INTO sync_state(key, value) VALUES(?, ?)").run(key, value);
}

function cloudUrl(): string {
  return process.env.CLOUD_URL || getCfg("cloud_url") || "https://app.buenamezcla.cl";
}

async function cloudFetch(pathRel: string, init: any = {}) {
  const id = getCfg("totem_id");
  const secret = getCfg("totem_secret");
  if (!id || !secret) throw new Error("Totem no registrado todavía");
  const headers = {
    "content-type": "application/json",
    "x-totem-id": id,
    "x-totem-secret": secret,
    ...(init.headers || {}),
  };
  const url = cloudUrl().replace(/\/$/, "") + pathRel;
  return fetch(url, { ...init, headers });
}

// ── PULL ───────────────────────────────────────────────────────────────────
const TABLES = ["casinos", "familias", "users", "minutas", "periodos", "pedidos"] as const;
const COLUMN_MAPS: Record<string, Record<string, string>> = {
  casinos:  { id: "id", nombre: "nombre", direccion: "direccion", comensalesDiarios: "comensales_diarios", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  familias: { id: "id", nombre: "nombre", color: "color", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  users:    { id: "id", rut: "rut", password: "password", nombre: "nombre", apellido: "apellido", telefono: "telefono", role: "role", casinoId: "casino_id", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  minutas:  { id: "id", casinoId: "casino_id", fecha: "fecha", familia: "familia", opcion1: "opcion_1", opcion2: "opcion_2", opcion3: "opcion_3", opcion4: "opcion_4", opcion5: "opcion_5", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  periodos: { id: "id", casinoId: "casino_id", nombre: "nombre", fechaInicio: "fecha_inicio", fechaFin: "fecha_fin", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  // Pedidos: mirror desde cloud para que las anulaciones del admin lleguen al tótem
  // (tombstones con deleted_at). El tótem también pushea pedidos vía outbox; el upsert
  // por id es idempotente — si un pedido vuelve del cloud con datos más nuevos
  // (mayor updated_at), se sobreescribe el local con los valores autoritativos.
  pedidos:  { id: "id", userId: "user_id", minutaId: "minuta_id", opcionSeleccionada: "opcion_seleccionada", tipo: "tipo", nombreVisita: "nombre_visita", asignadoPorDefecto: "asignado_por_defecto", codigoQr: "codigo_qr", origenTotemId: "origen_totem_id", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
};

function toEpoch(v: any): number | null {
  if (!v) return null;
  if (typeof v === "number") return v;
  return new Date(v).getTime();
}
function toBool(v: any): number { return v ? 1 : 0; }

function upsertRow(tbl: string, row: any) {
  const map = COLUMN_MAPS[tbl];
  const cols = Object.keys(map);
  const dbCols = cols.map(c => map[c]);
  const values = cols.map(k => {
    const v = row[k];
    if (k === "activo" || k === "asignadoPorDefecto") return toBool(v);
    if (k.startsWith("created") || k.startsWith("updated") || k.startsWith("deleted") || k === "fechaInicio" || k === "fechaFin") {
      return toEpoch(v);
    }
    return v ?? null;
  });
  const placeholders = cols.map(() => "?").join(",");
  const updates = dbCols.filter(c => c !== "id").map(c => `${c}=excluded.${c}`).join(",");
  const sql = `INSERT INTO ${tbl} (${dbCols.join(",")}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
  sqlite.prepare(sql).run(...values);
}

async function runPull() {
  if (!getCfg("totem_id")) return;
  try {
    const since = parseInt(getState("last_pull_ms") || "0", 10);
    const res = await cloudFetch(`/api/totem/pull?since=${since}`);
    if (!res.ok) {
      console.warn("[sync] pull failed:", res.status);
      return;
    }
    const json: any = await res.json();
    const data = json.data || {};
    const tx = sqlite.transaction((d: any) => {
      for (const t of TABLES) {
        const rows = d[t] || [];
        for (const r of rows) upsertRow(t, r);
      }
    });
    tx(data);
    // Use the server-computed high-water mark of returned rows. Falling back
    // to serverTime would skip rows committed in the millisecond gap between
    // the query and the response.
    const cursor = json.nextCursor ?? json.since ?? 0;
    setState("last_pull_ms", String(cursor));
    setState("last_pull_at", new Date().toISOString());
    const total = TABLES.reduce((s, t) => s + ((data[t] || []).length), 0);
    if (total > 0) console.log(`[sync] pull ok — ${total} filas actualizadas`);
  } catch (err: any) {
    console.warn("[sync] pull network error:", err?.message);
  }
}

// ── PUSH ───────────────────────────────────────────────────────────────────
async function runPush() {
  if (!getCfg("totem_id")) return;
  const batch = sqlite.prepare(
    "SELECT id, table_name, record_id, op, payload, attempts FROM sync_outbox WHERE acked = 0 ORDER BY id ASC LIMIT 100"
  ).all() as any[];
  if (batch.length === 0) return;

  // We currently only push pedidos. Other tables are read-only on the totem.
  const pedidoEntries = batch.filter(b => b.table_name === "pedidos");
  if (pedidoEntries.length === 0) return;

  const pedidosPayload = pedidoEntries.map(b => JSON.parse(b.payload));
  try {
    const res = await cloudFetch(`/api/totem/push`, {
      method: "POST",
      body: JSON.stringify({ pedidos: pedidosPayload }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    }
    const data: any = await res.json();
    const acceptedSet = new Set<string>(data.accepted || []);
    const ackStmt = sqlite.prepare("UPDATE sync_outbox SET acked = 1, last_error = NULL WHERE id = ?");
    const failStmt = sqlite.prepare("UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?");
    const tx = sqlite.transaction(() => {
      for (const entry of pedidoEntries) {
        const payload = JSON.parse(entry.payload);
        if (acceptedSet.has(payload.id)) ackStmt.run(entry.id);
        else {
          const rej = (data.rejected || []).find((r: any) => r.id === payload.id);
          failStmt.run(rej?.reason || "rechazado", entry.id);
        }
      }
      // Cleanup old acked entries (>7 days)
      sqlite.prepare("DELETE FROM sync_outbox WHERE acked = 1 AND created_at < ?").run(Date.now() - 7 * 86400 * 1000);
    });
    tx();
    console.log(`[sync] push ok — ${acceptedSet.size}/${pedidoEntries.length} aceptados`);
  } catch (err: any) {
    console.warn("[sync] push network error:", err?.message);
  }
}

// ── HEARTBEAT ──────────────────────────────────────────────────────────────
async function runHeartbeat() {
  if (!getCfg("totem_id")) return;
  try {
    const pending = (sqlite.prepare("SELECT COUNT(*) as c FROM sync_outbox WHERE acked = 0").get() as any).c;
    const ifaces = require("os").networkInterfaces();
    let ipLocal = "";
    for (const k of Object.keys(ifaces)) {
      for (const a of ifaces[k] || []) {
        if (!a.internal && a.family === "IPv4") { ipLocal = a.address; break; }
      }
      if (ipLocal) break;
    }
    await cloudFetch(`/api/totem/heartbeat`, {
      method: "POST",
      body: JSON.stringify({
        version: getCfg("version") || "0.0.0",
        pedidosPendientes: pending,
        ipLocal,
        hostname: require("os").hostname(),
      }),
    });
  } catch {/* swallow */}
}

// ── AUTO-UPDATE check ─────────────────────────────────────────────────────
async function checkUpdate() {
  if (!getCfg("totem_id")) return;
  try {
    const res = await cloudFetch(`/api/totem/version/latest`);
    if (!res.ok) return;
    const json: any = await res.json();
    if (!json.version) return;
    const current = getCfg("version") || "0.0.0";
    if (json.version === current) return;
    console.log(`[sync] nueva versión disponible: ${json.version} (actual ${current})`);
    // Drop a marker for the updater scheduled task to act on
    const marker = path.join(process.cwd(), "totem-data", "update-pending.json");
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, JSON.stringify(json, null, 2));
  } catch {/* swallow */}
}

function startWorker() {
  console.log("[sync] worker iniciado");
  setInterval(runPull, 30 * 1000);
  setInterval(runPush, 15 * 1000);
  setInterval(runHeartbeat, 60 * 1000);
  setInterval(checkUpdate, 30 * 60 * 1000);
  // Initial kicks (delayed so the HTTP server is up first)
  setTimeout(runHeartbeat, 5_000);
  setTimeout(runPull, 7_000);
  setTimeout(runPush, 10_000);
  setTimeout(checkUpdate, 60_000);
}

export { runPull, runPush, runHeartbeat, checkUpdate };
