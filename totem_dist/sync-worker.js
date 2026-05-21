"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var sync_worker_exports = {};
__export(sync_worker_exports, {
  checkUpdate: () => checkUpdate,
  runHeartbeat: () => runHeartbeat,
  runPull: () => runPull,
  runPush: () => runPush
});
module.exports = __toCommonJS(sync_worker_exports);
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var import_db = require("../server/db");
if (!import_db.sqlite) {
  console.warn("[sync] sqlite handle not available \u2014 sync worker disabled (DB_MODE=cloud)");
} else {
  startWorker();
}
function getCfg(key) {
  const row = import_db.sqlite.prepare("SELECT value FROM totem_config WHERE key = ?").get(key);
  return row?.value ?? null;
}
function setCfg(key, value) {
  import_db.sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run(key, value);
}
function getState(key) {
  const row = import_db.sqlite.prepare("SELECT value FROM sync_state WHERE key = ?").get(key);
  return row?.value ?? null;
}
function setState(key, value) {
  import_db.sqlite.prepare("INSERT OR REPLACE INTO sync_state(key, value) VALUES(?, ?)").run(key, value);
}
function cloudUrl() {
  return process.env.CLOUD_URL || getCfg("cloud_url") || "https://app.buenamezcla.cl";
}
async function cloudFetch(pathRel, init = {}) {
  const id = getCfg("totem_id");
  const secret = getCfg("totem_secret");
  if (!id || !secret) throw new Error("Totem no registrado todav\xEDa");
  const headers = {
    "content-type": "application/json",
    "x-totem-id": id,
    "x-totem-secret": secret,
    ...init.headers || {}
  };
  const url = cloudUrl().replace(/\/$/, "") + pathRel;
  return fetch(url, { ...init, headers });
}
const TABLES = ["casinos", "familias", "users", "minutas", "periodos", "pedidos"];
const COLUMN_MAPS = {
  casinos: { id: "id", nombre: "nombre", direccion: "direccion", comensalesDiarios: "comensales_diarios", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  familias: { id: "id", nombre: "nombre", color: "color", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  users: { id: "id", rut: "rut", password: "password", nombre: "nombre", apellido: "apellido", telefono: "telefono", role: "role", casinoId: "casino_id", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  minutas: { id: "id", casinoId: "casino_id", fecha: "fecha", familia: "familia", opcion1: "opcion_1", opcion2: "opcion_2", opcion3: "opcion_3", opcion4: "opcion_4", opcion5: "opcion_5", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  periodos: { id: "id", casinoId: "casino_id", nombre: "nombre", fechaInicio: "fecha_inicio", fechaFin: "fecha_fin", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  // Pedidos: mirror desde cloud para que las anulaciones del admin lleguen al tótem
  // (tombstones con deleted_at). El tótem también pushea pedidos vía outbox; el upsert
  // por id es idempotente — si un pedido vuelve del cloud con datos más nuevos
  // (mayor updated_at), se sobreescribe el local con los valores autoritativos.
  pedidos: { id: "id", userId: "user_id", minutaId: "minuta_id", opcionSeleccionada: "opcion_seleccionada", tipo: "tipo", nombreVisita: "nombre_visita", asignadoPorDefecto: "asignado_por_defecto", codigoQr: "codigo_qr", origenTotemId: "origen_totem_id", impresoEn: "impreso_en", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" }
};
function toEpoch(v) {
  if (!v) return null;
  if (typeof v === "number") return v;
  return new Date(v).getTime();
}
function toBool(v) {
  return v ? 1 : 0;
}
function upsertRow(tbl, row) {
  const map = COLUMN_MAPS[tbl];
  const cols = Object.keys(map);
  const dbCols = cols.map((c) => map[c]);
  const values = cols.map((k) => {
    const v = row[k];
    if (k === "activo" || k === "asignadoPorDefecto") return toBool(v);
    if (k.startsWith("created") || k.startsWith("updated") || k.startsWith("deleted") || k === "fechaInicio" || k === "fechaFin" || k === "impresoEn") {
      return toEpoch(v);
    }
    return v ?? null;
  });
  const placeholders = cols.map(() => "?").join(",");
  const updates = dbCols.filter((c) => c !== "id").map((c) => `${c}=excluded.${c}`).join(",");
  const sql = `INSERT INTO ${tbl} (${dbCols.join(",")}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
  import_db.sqlite.prepare(sql).run(...values);
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
    const json = await res.json();
    const data = json.data || {};
    const tx = import_db.sqlite.transaction((d) => {
      for (const t of TABLES) {
        const rows = d[t] || [];
        for (const r of rows) upsertRow(t, r);
      }
    });
    tx(data);
    const cursor = json.nextCursor ?? json.since ?? 0;
    setState("last_pull_ms", String(cursor));
    setState("last_pull_at", (/* @__PURE__ */ new Date()).toISOString());
    const total = TABLES.reduce((s, t) => s + (data[t] || []).length, 0);
    if (total > 0) console.log(`[sync] pull ok \u2014 ${total} filas actualizadas`);
  } catch (err) {
    console.warn("[sync] pull network error:", err?.message);
  }
}
async function runPush() {
  if (!getCfg("totem_id")) return;
  const batch = import_db.sqlite.prepare(
    "SELECT id, table_name, record_id, op, payload, attempts FROM sync_outbox WHERE acked = 0 ORDER BY id ASC LIMIT 100"
  ).all();
  if (batch.length === 0) return;
  const pedidoEntries = batch.filter((b) => b.table_name === "pedidos");
  if (pedidoEntries.length === 0) return;
  const pedidosPayload = pedidoEntries.map((b) => JSON.parse(b.payload));
  try {
    const res = await cloudFetch(`/api/totem/push`, {
      method: "POST",
      body: JSON.stringify({ pedidos: pedidosPayload })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    }
    const data = await res.json();
    const acceptedSet = new Set(data.accepted || []);
    const ackStmt = import_db.sqlite.prepare("UPDATE sync_outbox SET acked = 1, last_error = NULL WHERE id = ?");
    const failStmt = import_db.sqlite.prepare("UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?");
    const tx = import_db.sqlite.transaction(() => {
      for (const entry of pedidoEntries) {
        const payload = JSON.parse(entry.payload);
        if (acceptedSet.has(payload.id)) ackStmt.run(entry.id);
        else {
          const rej = (data.rejected || []).find((r) => r.id === payload.id);
          failStmt.run(rej?.reason || "rechazado", entry.id);
        }
      }
      import_db.sqlite.prepare("DELETE FROM sync_outbox WHERE acked = 1 AND created_at < ?").run(Date.now() - 7 * 86400 * 1e3);
    });
    tx();
    console.log(`[sync] push ok \u2014 ${acceptedSet.size}/${pedidoEntries.length} aceptados`);
  } catch (err) {
    console.warn("[sync] push network error:", err?.message);
  }
}
async function runHeartbeat() {
  if (!getCfg("totem_id")) return;
  try {
    const pending = import_db.sqlite.prepare("SELECT COUNT(*) as c FROM sync_outbox WHERE acked = 0").get().c;
    const ifaces = require("os").networkInterfaces();
    let ipLocal = "";
    for (const k of Object.keys(ifaces)) {
      for (const a of ifaces[k] || []) {
        if (!a.internal && a.family === "IPv4") {
          ipLocal = a.address;
          break;
        }
      }
      if (ipLocal) break;
    }
    await cloudFetch(`/api/totem/heartbeat`, {
      method: "POST",
      body: JSON.stringify({
        version: getCfg("version") || "0.0.0",
        pedidosPendientes: pending,
        ipLocal,
        hostname: require("os").hostname()
      })
    });
  } catch {
  }
}
async function checkUpdate() {
  if (!getCfg("totem_id")) return;
  try {
    const res = await cloudFetch(`/api/totem/version/latest`);
    if (!res.ok) return;
    const json = await res.json();
    if (!json.version) return;
    const current = getCfg("version") || "0.0.0";
    if (json.version === current) return;
    console.log(`[sync] nueva versi\xF3n disponible: ${json.version} (actual ${current})`);
    const marker = path.join(process.cwd(), "totem-data", "update-pending.json");
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, JSON.stringify(json, null, 2));
  } catch {
  }
}
function startWorker() {
  console.log("[sync] worker iniciado");
  setInterval(runPull, 30 * 1e3);
  setInterval(runPush, 15 * 1e3);
  setInterval(runHeartbeat, 60 * 1e3);
  setInterval(checkUpdate, 30 * 60 * 1e3);
  setTimeout(runHeartbeat, 5e3);
  setTimeout(runPull, 7e3);
  setTimeout(runPush, 1e4);
  setTimeout(checkUpdate, 6e4);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  checkUpdate,
  runHeartbeat,
  runPull,
  runPush
});
