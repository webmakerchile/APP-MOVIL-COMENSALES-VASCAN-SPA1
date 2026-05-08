"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  SYNC_TABLES: () => SYNC_TABLES,
  casinos: () => casinos,
  familias: () => familias,
  insertCasinoSchema: () => insertCasinoSchema,
  insertFamiliaSchema: () => insertFamiliaSchema,
  insertMinutaSchema: () => insertMinutaSchema,
  insertPedidoSchema: () => insertPedidoSchema,
  insertPeriodoSchema: () => insertPeriodoSchema,
  insertUserSchema: () => insertUserSchema,
  loginSchema: () => loginSchema,
  minutas: () => minutas,
  pedidos: () => pedidos,
  periodos: () => periodos,
  totemReleases: () => totemReleases,
  totems: () => totems,
  userRoleEnum: () => userRoleEnum,
  users: () => users
});
var import_drizzle_orm, import_pg_core, import_drizzle_zod, import_zod, userRoleEnum, syncCols, users, casinos, familias, minutas, periodos, pedidos, totems, totemReleases, insertUserSchema, loginSchema, insertCasinoSchema, insertFamiliaSchema, insertMinutaSchema, insertPedidoSchema, insertPeriodoSchema, SYNC_TABLES;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    import_drizzle_orm = require("drizzle-orm");
    import_pg_core = require("drizzle-orm/pg-core");
    import_drizzle_zod = require("drizzle-zod");
    import_zod = require("zod");
    userRoleEnum = (0, import_pg_core.pgEnum)("user_role", [
      "admin",
      "comensal",
      "interlocutor"
    ]);
    syncCols = {
      updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow().notNull(),
      deletedAt: (0, import_pg_core.timestamp)("deleted_at"),
      syncVersion: (0, import_pg_core.bigint)("sync_version", { mode: "number" }).notNull().default(0)
    };
    users = (0, import_pg_core.pgTable)("users", {
      id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
      rut: (0, import_pg_core.text)("rut").notNull().unique(),
      password: (0, import_pg_core.text)("password").notNull(),
      nombre: (0, import_pg_core.text)("nombre").notNull(),
      apellido: (0, import_pg_core.text)("apellido").notNull(),
      telefono: (0, import_pg_core.text)("telefono"),
      role: userRoleEnum("role").notNull().default("comensal"),
      casinoId: (0, import_pg_core.varchar)("casino_id").references(() => casinos.id),
      activo: (0, import_pg_core.boolean)("activo").notNull().default(true),
      createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
      ...syncCols
    });
    casinos = (0, import_pg_core.pgTable)("casinos", {
      id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
      nombre: (0, import_pg_core.text)("nombre").notNull(),
      direccion: (0, import_pg_core.text)("direccion"),
      comensalesDiarios: (0, import_pg_core.integer)("comensales_diarios").notNull().default(0),
      activo: (0, import_pg_core.boolean)("activo").notNull().default(true),
      createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
      ...syncCols
    });
    familias = (0, import_pg_core.pgTable)("familias", {
      id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
      nombre: (0, import_pg_core.text)("nombre").notNull().unique(),
      color: (0, import_pg_core.text)("color").notNull().default("#D4A843"),
      activo: (0, import_pg_core.boolean)("activo").notNull().default(true),
      createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
      ...syncCols
    });
    minutas = (0, import_pg_core.pgTable)("minutas", {
      id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
      casinoId: (0, import_pg_core.varchar)("casino_id").notNull().references(() => casinos.id),
      fecha: (0, import_pg_core.date)("fecha").notNull(),
      familia: (0, import_pg_core.text)("familia").notNull().default("almuerzo"),
      opcion1: (0, import_pg_core.text)("opcion_1").notNull(),
      opcion2: (0, import_pg_core.text)("opcion_2").notNull(),
      opcion3: (0, import_pg_core.text)("opcion_3").notNull(),
      opcion4: (0, import_pg_core.text)("opcion_4"),
      opcion5: (0, import_pg_core.text)("opcion_5"),
      activo: (0, import_pg_core.boolean)("activo").notNull().default(true),
      createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
      ...syncCols
    });
    periodos = (0, import_pg_core.pgTable)("periodos", {
      id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
      casinoId: (0, import_pg_core.varchar)("casino_id").notNull().references(() => casinos.id),
      nombre: (0, import_pg_core.text)("nombre").notNull(),
      fechaInicio: (0, import_pg_core.timestamp)("fecha_inicio").notNull(),
      fechaFin: (0, import_pg_core.timestamp)("fecha_fin").notNull(),
      activo: (0, import_pg_core.boolean)("activo").notNull().default(true),
      createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
      ...syncCols
    });
    pedidos = (0, import_pg_core.pgTable)("pedidos", {
      id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
      userId: (0, import_pg_core.varchar)("user_id").notNull().references(() => users.id),
      minutaId: (0, import_pg_core.varchar)("minuta_id").notNull().references(() => minutas.id),
      opcionSeleccionada: (0, import_pg_core.integer)("opcion_seleccionada").notNull(),
      tipo: (0, import_pg_core.text)("tipo").notNull().default("seleccion"),
      nombreVisita: (0, import_pg_core.text)("nombre_visita"),
      asignadoPorDefecto: (0, import_pg_core.boolean)("asignado_por_defecto").notNull().default(false),
      codigoQr: (0, import_pg_core.text)("codigo_qr"),
      origenTotemId: (0, import_pg_core.varchar)("origen_totem_id"),
      createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
      ...syncCols
    });
    totems = (0, import_pg_core.pgTable)("totems", {
      id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
      nombre: (0, import_pg_core.text)("nombre").notNull(),
      casinoId: (0, import_pg_core.varchar)("casino_id").notNull().references(() => casinos.id),
      secretHash: (0, import_pg_core.text)("secret_hash").notNull(),
      version: (0, import_pg_core.text)("version"),
      ipPublica: (0, import_pg_core.text)("ip_publica"),
      ipLocal: (0, import_pg_core.text)("ip_local"),
      hostname: (0, import_pg_core.text)("hostname"),
      ultimaConexion: (0, import_pg_core.timestamp)("ultima_conexion"),
      ultimoSync: (0, import_pg_core.timestamp)("ultimo_sync"),
      pedidosPendientes: (0, import_pg_core.integer)("pedidos_pendientes").notNull().default(0),
      estado: (0, import_pg_core.text)("estado").notNull().default("offline"),
      notas: (0, import_pg_core.text)("notas"),
      activo: (0, import_pg_core.boolean)("activo").notNull().default(true),
      createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
    });
    totemReleases = (0, import_pg_core.pgTable)("totem_releases", {
      id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
      version: (0, import_pg_core.text)("version").notNull().unique(),
      url: (0, import_pg_core.text)("url").notNull(),
      sha256: (0, import_pg_core.text)("sha256").notNull(),
      notas: (0, import_pg_core.text)("notas"),
      obligatoria: (0, import_pg_core.boolean)("obligatoria").notNull().default(false),
      publicada: (0, import_pg_core.boolean)("publicada").notNull().default(false),
      createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
    });
    insertUserSchema = (0, import_drizzle_zod.createInsertSchema)(users).pick({
      rut: true,
      password: true,
      nombre: true,
      apellido: true,
      telefono: true,
      role: true,
      casinoId: true
    });
    loginSchema = import_zod.z.object({
      rut: import_zod.z.string().min(1),
      password: import_zod.z.string().min(1)
    });
    insertCasinoSchema = (0, import_drizzle_zod.createInsertSchema)(casinos).pick({
      nombre: true,
      direccion: true,
      comensalesDiarios: true
    });
    insertFamiliaSchema = (0, import_drizzle_zod.createInsertSchema)(familias).pick({
      nombre: true,
      color: true
    });
    insertMinutaSchema = (0, import_drizzle_zod.createInsertSchema)(minutas).pick({
      casinoId: true,
      fecha: true,
      familia: true,
      opcion1: true,
      opcion2: true,
      opcion3: true,
      opcion4: true,
      opcion5: true
    });
    insertPedidoSchema = (0, import_drizzle_zod.createInsertSchema)(pedidos).pick({
      userId: true,
      minutaId: true,
      opcionSeleccionada: true,
      codigoQr: true,
      tipo: true,
      nombreVisita: true
    });
    insertPeriodoSchema = (0, import_drizzle_zod.createInsertSchema)(periodos).pick({
      casinoId: true,
      nombre: true,
      fechaInicio: true,
      fechaFin: true
    });
    SYNC_TABLES = ["casinos", "familias", "users", "minutas", "periodos", "pedidos"];
  }
});

// shared/schema-sqlite.ts
var schema_sqlite_exports = {};
__export(schema_sqlite_exports, {
  casinos: () => casinos2,
  familias: () => familias2,
  minutas: () => minutas2,
  pedidos: () => pedidos2,
  periodos: () => periodos2,
  syncOutbox: () => syncOutbox,
  syncState: () => syncState,
  totemConfig: () => totemConfig,
  users: () => users2
});
var import_sqlite_core, syncCols2, users2, casinos2, familias2, minutas2, periodos2, pedidos2, syncOutbox, syncState, totemConfig;
var init_schema_sqlite = __esm({
  "shared/schema-sqlite.ts"() {
    "use strict";
    import_sqlite_core = require("drizzle-orm/sqlite-core");
    syncCols2 = {
      updatedAt: (0, import_sqlite_core.integer)("updated_at", { mode: "timestamp_ms" }).notNull(),
      deletedAt: (0, import_sqlite_core.integer)("deleted_at", { mode: "timestamp_ms" }),
      syncVersion: (0, import_sqlite_core.integer)("sync_version").notNull().default(0)
    };
    users2 = (0, import_sqlite_core.sqliteTable)("users", {
      id: (0, import_sqlite_core.text)("id").primaryKey(),
      rut: (0, import_sqlite_core.text)("rut").notNull().unique(),
      password: (0, import_sqlite_core.text)("password").notNull(),
      nombre: (0, import_sqlite_core.text)("nombre").notNull(),
      apellido: (0, import_sqlite_core.text)("apellido").notNull(),
      telefono: (0, import_sqlite_core.text)("telefono"),
      role: (0, import_sqlite_core.text)("role").notNull().default("comensal"),
      casinoId: (0, import_sqlite_core.text)("casino_id"),
      activo: (0, import_sqlite_core.integer)("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: (0, import_sqlite_core.integer)("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    casinos2 = (0, import_sqlite_core.sqliteTable)("casinos", {
      id: (0, import_sqlite_core.text)("id").primaryKey(),
      nombre: (0, import_sqlite_core.text)("nombre").notNull(),
      direccion: (0, import_sqlite_core.text)("direccion"),
      comensalesDiarios: (0, import_sqlite_core.integer)("comensales_diarios").notNull().default(0),
      activo: (0, import_sqlite_core.integer)("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: (0, import_sqlite_core.integer)("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    familias2 = (0, import_sqlite_core.sqliteTable)("familias", {
      id: (0, import_sqlite_core.text)("id").primaryKey(),
      nombre: (0, import_sqlite_core.text)("nombre").notNull().unique(),
      color: (0, import_sqlite_core.text)("color").notNull().default("#D4A843"),
      activo: (0, import_sqlite_core.integer)("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: (0, import_sqlite_core.integer)("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    minutas2 = (0, import_sqlite_core.sqliteTable)("minutas", {
      id: (0, import_sqlite_core.text)("id").primaryKey(),
      casinoId: (0, import_sqlite_core.text)("casino_id").notNull(),
      fecha: (0, import_sqlite_core.text)("fecha").notNull(),
      // YYYY-MM-DD
      familia: (0, import_sqlite_core.text)("familia").notNull().default("almuerzo"),
      opcion1: (0, import_sqlite_core.text)("opcion_1").notNull(),
      opcion2: (0, import_sqlite_core.text)("opcion_2").notNull(),
      opcion3: (0, import_sqlite_core.text)("opcion_3").notNull(),
      opcion4: (0, import_sqlite_core.text)("opcion_4"),
      opcion5: (0, import_sqlite_core.text)("opcion_5"),
      activo: (0, import_sqlite_core.integer)("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: (0, import_sqlite_core.integer)("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    periodos2 = (0, import_sqlite_core.sqliteTable)("periodos", {
      id: (0, import_sqlite_core.text)("id").primaryKey(),
      casinoId: (0, import_sqlite_core.text)("casino_id").notNull(),
      nombre: (0, import_sqlite_core.text)("nombre").notNull(),
      fechaInicio: (0, import_sqlite_core.integer)("fecha_inicio", { mode: "timestamp_ms" }).notNull(),
      fechaFin: (0, import_sqlite_core.integer)("fecha_fin", { mode: "timestamp_ms" }).notNull(),
      activo: (0, import_sqlite_core.integer)("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: (0, import_sqlite_core.integer)("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    pedidos2 = (0, import_sqlite_core.sqliteTable)("pedidos", {
      id: (0, import_sqlite_core.text)("id").primaryKey(),
      userId: (0, import_sqlite_core.text)("user_id").notNull(),
      minutaId: (0, import_sqlite_core.text)("minuta_id").notNull(),
      opcionSeleccionada: (0, import_sqlite_core.integer)("opcion_seleccionada").notNull(),
      tipo: (0, import_sqlite_core.text)("tipo").notNull().default("seleccion"),
      nombreVisita: (0, import_sqlite_core.text)("nombre_visita"),
      asignadoPorDefecto: (0, import_sqlite_core.integer)("asignado_por_defecto", { mode: "boolean" }).notNull().default(false),
      codigoQr: (0, import_sqlite_core.text)("codigo_qr"),
      origenTotemId: (0, import_sqlite_core.text)("origen_totem_id"),
      createdAt: (0, import_sqlite_core.integer)("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    syncOutbox = (0, import_sqlite_core.sqliteTable)("sync_outbox", {
      id: (0, import_sqlite_core.integer)("id").primaryKey({ autoIncrement: true }),
      tableName: (0, import_sqlite_core.text)("table_name").notNull(),
      recordId: (0, import_sqlite_core.text)("record_id").notNull(),
      op: (0, import_sqlite_core.text)("op").notNull(),
      // upsert | delete
      payload: (0, import_sqlite_core.text)("payload").notNull(),
      // JSON of the full row
      createdAt: (0, import_sqlite_core.integer)("created_at", { mode: "timestamp_ms" }).notNull(),
      attempts: (0, import_sqlite_core.integer)("attempts").notNull().default(0),
      lastError: (0, import_sqlite_core.text)("last_error"),
      acked: (0, import_sqlite_core.integer)("acked", { mode: "boolean" }).notNull().default(false)
    });
    syncState = (0, import_sqlite_core.sqliteTable)("sync_state", {
      key: (0, import_sqlite_core.text)("key").primaryKey(),
      value: (0, import_sqlite_core.text)("value").notNull()
    });
    totemConfig = (0, import_sqlite_core.sqliteTable)("totem_config", {
      key: (0, import_sqlite_core.text)("key").primaryKey(),
      value: (0, import_sqlite_core.text)("value").notNull()
    });
  }
});

// totem/sync-worker.ts
var sync_worker_exports = {};
__export(sync_worker_exports, {
  checkUpdate: () => checkUpdate,
  runHeartbeat: () => runHeartbeat,
  runPull: () => runPull,
  runPush: () => runPush
});
module.exports = __toCommonJS(sync_worker_exports);
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));

// server/db.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var DB_MODE = process.env.DB_MODE === "totem" ? "totem" : "cloud";
var _db;
var _pool;
var _schema;
var _sqlite;
if (DB_MODE === "cloud") {
  const { Pool } = require("pg");
  const { drizzle } = require("drizzle-orm/node-postgres");
  const schema = (init_schema(), __toCommonJS(schema_exports));
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in cloud mode");
  }
  _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _db = drizzle(_pool, { schema });
  _schema = schema;
} else {
  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const schema = (init_schema_sqlite(), __toCommonJS(schema_sqlite_exports));
  const dbPath = process.env.TOTEM_DB_PATH || path.resolve(process.cwd(), "totem-data", "totem.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _sqlite.pragma("synchronous = NORMAL");
  const ddl = fs.readFileSync(path.resolve(__dirname, "../shared/schema-sqlite.sql"), "utf-8");
  _sqlite.exec(ddl);
  _db = drizzle(_sqlite, { schema });
  _schema = schema;
}
var sqlite = _sqlite;

// totem/sync-worker.ts
if (!sqlite) {
  console.warn("[sync] sqlite handle not available \u2014 sync worker disabled (DB_MODE=cloud)");
} else {
  startWorker();
}
function getCfg(key) {
  const row = sqlite.prepare("SELECT value FROM totem_config WHERE key = ?").get(key);
  return row?.value ?? null;
}
function getState(key) {
  const row = sqlite.prepare("SELECT value FROM sync_state WHERE key = ?").get(key);
  return row?.value ?? null;
}
function setState(key, value) {
  sqlite.prepare("INSERT OR REPLACE INTO sync_state(key, value) VALUES(?, ?)").run(key, value);
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
var TABLES = ["casinos", "familias", "users", "minutas", "periodos"];
var COLUMN_MAPS = {
  casinos: { id: "id", nombre: "nombre", direccion: "direccion", comensalesDiarios: "comensales_diarios", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  familias: { id: "id", nombre: "nombre", color: "color", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  users: { id: "id", rut: "rut", password: "password", nombre: "nombre", apellido: "apellido", telefono: "telefono", role: "role", casinoId: "casino_id", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  minutas: { id: "id", casinoId: "casino_id", fecha: "fecha", familia: "familia", opcion1: "opcion_1", opcion2: "opcion_2", opcion3: "opcion_3", opcion4: "opcion_4", opcion5: "opcion_5", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" },
  periodos: { id: "id", casinoId: "casino_id", nombre: "nombre", fechaInicio: "fecha_inicio", fechaFin: "fecha_fin", activo: "activo", createdAt: "created_at", updatedAt: "updated_at", deletedAt: "deleted_at", syncVersion: "sync_version" }
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
    if (k === "activo") return toBool(v);
    if (k.startsWith("created") || k.startsWith("updated") || k.startsWith("deleted") || k === "fechaInicio" || k === "fechaFin") {
      return toEpoch(v);
    }
    return v ?? null;
  });
  const placeholders = cols.map(() => "?").join(",");
  const updates = dbCols.filter((c) => c !== "id").map((c) => `${c}=excluded.${c}`).join(",");
  const sql2 = `INSERT INTO ${tbl} (${dbCols.join(",")}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
  sqlite.prepare(sql2).run(...values);
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
    const tx = sqlite.transaction((d) => {
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
  const batch = sqlite.prepare(
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
      const text3 = await res.text();
      throw new Error(`HTTP ${res.status}: ${text3.slice(0, 120)}`);
    }
    const data = await res.json();
    const acceptedSet = new Set(data.accepted || []);
    const ackStmt = sqlite.prepare("UPDATE sync_outbox SET acked = 1, last_error = NULL WHERE id = ?");
    const failStmt = sqlite.prepare("UPDATE sync_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?");
    const tx = sqlite.transaction(() => {
      for (const entry of pedidoEntries) {
        const payload = JSON.parse(entry.payload);
        if (acceptedSet.has(payload.id)) ackStmt.run(entry.id);
        else {
          const rej = (data.rejected || []).find((r) => r.id === payload.id);
          failStmt.run(rej?.reason || "rechazado", entry.id);
        }
      }
      sqlite.prepare("DELETE FROM sync_outbox WHERE acked = 1 AND created_at < ?").run(Date.now() - 7 * 86400 * 1e3);
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
    const pending = sqlite.prepare("SELECT COUNT(*) as c FROM sync_outbox WHERE acked = 0").get().c;
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
    const marker = path2.join(process.cwd(), "totem-data", "update-pending.json");
    fs2.mkdirSync(path2.dirname(marker), { recursive: true });
    fs2.writeFileSync(marker, JSON.stringify(json, null, 2));
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
