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
  users: () => users,
  usuarioCasinos: () => usuarioCasinos
});
var import_drizzle_orm, import_pg_core, import_drizzle_zod, import_zod, userRoleEnum, syncCols, users, usuarioCasinos, casinos, familias, minutas, periodos, pedidos, totems, totemReleases, insertUserSchema, loginSchema, insertCasinoSchema, insertFamiliaSchema, insertMinutaSchema, insertPedidoSchema, insertPeriodoSchema, SYNC_TABLES;
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
      "interlocutor",
      "encargado_casino"
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
      fechaNacimiento: (0, import_pg_core.date)("fecha_nacimiento"),
      passwordChangeRequired: (0, import_pg_core.boolean)("password_change_required").notNull().default(true),
      activo: (0, import_pg_core.boolean)("activo").notNull().default(true),
      createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
      ...syncCols
    });
    usuarioCasinos = (0, import_pg_core.pgTable)("usuario_casinos", {
      id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
      userId: (0, import_pg_core.varchar)("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      casinoId: (0, import_pg_core.varchar)("casino_id").notNull().references(() => casinos.id, { onDelete: "cascade" }),
      createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow()
    });
    casinos = (0, import_pg_core.pgTable)("casinos", {
      id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
      nombre: (0, import_pg_core.text)("nombre").notNull(),
      direccion: (0, import_pg_core.text)("direccion"),
      comensalesDiarios: (0, import_pg_core.integer)("comensales_diarios").notNull().default(0),
      permitirCambioClaveTotem: (0, import_pg_core.boolean)("permitir_cambio_clave_totem").notNull().default(false),
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
      fechaServicioInicio: (0, import_pg_core.date)("fecha_servicio_inicio"),
      fechaServicioFin: (0, import_pg_core.date)("fecha_servicio_fin"),
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
      casinoId: true,
      fechaNacimiento: true,
      passwordChangeRequired: true
    });
    loginSchema = import_zod.z.object({
      rut: import_zod.z.string().min(1),
      password: import_zod.z.string().min(1)
    });
    insertCasinoSchema = (0, import_drizzle_zod.createInsertSchema)(casinos).pick({
      nombre: true,
      direccion: true,
      comensalesDiarios: true,
      permitirCambioClaveTotem: true
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
      fechaFin: true,
      fechaServicioInicio: true,
      fechaServicioFin: true
    });
    SYNC_TABLES = ["casinos", "familias", "users", "usuario_casinos", "minutas", "periodos", "pedidos"];
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
  users: () => users2,
  usuarioCasinos: () => usuarioCasinos2
});
var import_sqlite_core, syncCols2, users2, usuarioCasinos2, casinos2, familias2, minutas2, periodos2, pedidos2, syncOutbox, syncState, totemConfig;
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
      fechaNacimiento: (0, import_sqlite_core.text)("fecha_nacimiento"),
      // YYYY-MM-DD
      passwordChangeRequired: (0, import_sqlite_core.integer)("password_change_required", { mode: "boolean" }).notNull().default(true),
      role: (0, import_sqlite_core.text)("role").notNull().default("comensal"),
      casinoId: (0, import_sqlite_core.text)("casino_id"),
      activo: (0, import_sqlite_core.integer)("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: (0, import_sqlite_core.integer)("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    usuarioCasinos2 = (0, import_sqlite_core.sqliteTable)("usuario_casinos", {
      id: (0, import_sqlite_core.text)("id").primaryKey(),
      userId: (0, import_sqlite_core.text)("user_id").notNull(),
      casinoId: (0, import_sqlite_core.text)("casino_id").notNull(),
      createdAt: (0, import_sqlite_core.integer)("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    casinos2 = (0, import_sqlite_core.sqliteTable)("casinos", {
      id: (0, import_sqlite_core.text)("id").primaryKey(),
      nombre: (0, import_sqlite_core.text)("nombre").notNull(),
      direccion: (0, import_sqlite_core.text)("direccion"),
      comensalesDiarios: (0, import_sqlite_core.integer)("comensales_diarios").notNull().default(0),
      permitirCambioClaveTotem: (0, import_sqlite_core.integer)("permitir_cambio_clave_totem", { mode: "boolean" }).notNull().default(false),
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
      fechaServicioInicio: (0, import_sqlite_core.text)("fecha_servicio_inicio"),
      // YYYY-MM-DD
      fechaServicioFin: (0, import_sqlite_core.text)("fecha_servicio_fin"),
      // YYYY-MM-DD
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
var users3 = _schema.users;
var casinos3 = _schema.casinos;
var familias3 = _schema.familias;
var minutas3 = _schema.minutas;
var pedidos3 = _schema.pedidos;
var periodos3 = _schema.periodos;
var usuarioCasinos3 = _schema.usuarioCasinos;

// totem/register.ts
var os = __toESM(require("os"));
process.env.DB_MODE = "totem";
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback ?? "";
}
async function main() {
  const nombre = arg("nombre", `Totem-${os.hostname()}`);
  const token = arg("token", process.env.TOTEM_BOOTSTRAP_TOKEN || "");
  const cloud = arg("cloud", process.env.CLOUD_URL || "https://app.buenamezcla.cl");
  const version = arg("version", "1.0.0");
  if (!token) {
    console.error("Uso: tsx totem/register.ts --token <bootstrap> [--nombre <n>] [--cloud <url>]");
    process.exit(1);
  }
  let ipLocal = "";
  const ifaces = os.networkInterfaces();
  for (const k of Object.keys(ifaces)) {
    for (const a of ifaces[k] || []) {
      if (!a.internal && a.family === "IPv4") {
        ipLocal = a.address;
        break;
      }
    }
    if (ipLocal) break;
  }
  const url = cloud.replace(/\/$/, "") + "/api/totem/register";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bootstrap-token": token },
    body: JSON.stringify({ nombre, hostname: os.hostname(), ipLocal, version })
  });
  if (!res.ok) {
    console.error("Registro fall\xF3:", res.status, await res.text());
    process.exit(2);
  }
  const data = await res.json();
  console.log("Registrado:", data);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("totem_id", data.totemId);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("totem_secret", data.secret);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("casino_id", data.casino.id);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("casino_nombre", data.casino.nombre);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("cloud_url", cloud);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("version", version);
  console.log("Configuraci\xF3n guardada en totem_config. Listo para usar.");
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
