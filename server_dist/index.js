import { createRequire } from 'module'; const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
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
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  bigint,
  date,
  timestamp,
  boolean,
  pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var userRoleEnum, syncCols, users, usuarioCasinos, casinos, familias, minutas, periodos, pedidos, totems, totemReleases, insertUserSchema, loginSchema, insertCasinoSchema, insertFamiliaSchema, insertMinutaSchema, insertPedidoSchema, insertPeriodoSchema, SYNC_TABLES;
var init_schema = __esm({
  "shared/schema.ts"() {
    "use strict";
    userRoleEnum = pgEnum("user_role", [
      "admin",
      "comensal",
      "interlocutor",
      "encargado_casino"
    ]);
    syncCols = {
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
      deletedAt: timestamp("deleted_at"),
      syncVersion: bigint("sync_version", { mode: "number" }).notNull().default(0)
    };
    users = pgTable("users", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      rut: text("rut").notNull().unique(),
      password: text("password").notNull(),
      nombre: text("nombre").notNull(),
      apellido: text("apellido").notNull(),
      telefono: text("telefono"),
      role: userRoleEnum("role").notNull().default("comensal"),
      casinoId: varchar("casino_id").references(() => casinos.id),
      fechaNacimiento: date("fecha_nacimiento"),
      passwordChangeRequired: boolean("password_change_required").notNull().default(true),
      activo: boolean("activo").notNull().default(true),
      createdAt: timestamp("created_at").defaultNow(),
      ...syncCols
    });
    usuarioCasinos = pgTable("usuario_casinos", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
      casinoId: varchar("casino_id").notNull().references(() => casinos.id, { onDelete: "cascade" }),
      createdAt: timestamp("created_at").defaultNow()
    });
    casinos = pgTable("casinos", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      nombre: text("nombre").notNull(),
      direccion: text("direccion"),
      comensalesDiarios: integer("comensales_diarios").notNull().default(0),
      permitirCambioClaveTotem: boolean("permitir_cambio_clave_totem").notNull().default(false),
      activo: boolean("activo").notNull().default(true),
      createdAt: timestamp("created_at").defaultNow(),
      ...syncCols
    });
    familias = pgTable("familias", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      nombre: text("nombre").notNull().unique(),
      color: text("color").notNull().default("#D4A843"),
      activo: boolean("activo").notNull().default(true),
      createdAt: timestamp("created_at").defaultNow(),
      ...syncCols
    });
    minutas = pgTable("minutas", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      casinoId: varchar("casino_id").notNull().references(() => casinos.id),
      fecha: date("fecha").notNull(),
      familia: text("familia").notNull().default("almuerzo"),
      opcion1: text("opcion_1").notNull(),
      opcion2: text("opcion_2").notNull(),
      opcion3: text("opcion_3").notNull(),
      opcion4: text("opcion_4"),
      opcion5: text("opcion_5"),
      activo: boolean("activo").notNull().default(true),
      createdAt: timestamp("created_at").defaultNow(),
      ...syncCols
    });
    periodos = pgTable("periodos", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      casinoId: varchar("casino_id").notNull().references(() => casinos.id),
      nombre: text("nombre").notNull(),
      fechaInicio: timestamp("fecha_inicio").notNull(),
      fechaFin: timestamp("fecha_fin").notNull(),
      fechaServicioInicio: date("fecha_servicio_inicio"),
      fechaServicioFin: date("fecha_servicio_fin"),
      activo: boolean("activo").notNull().default(true),
      createdAt: timestamp("created_at").defaultNow(),
      ...syncCols
    });
    pedidos = pgTable("pedidos", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      userId: varchar("user_id").notNull().references(() => users.id),
      minutaId: varchar("minuta_id").notNull().references(() => minutas.id),
      opcionSeleccionada: integer("opcion_seleccionada").notNull(),
      tipo: text("tipo").notNull().default("seleccion"),
      nombreVisita: text("nombre_visita"),
      asignadoPorDefecto: boolean("asignado_por_defecto").notNull().default(false),
      codigoQr: text("codigo_qr"),
      origenTotemId: varchar("origen_totem_id"),
      impresoEn: timestamp("impreso_en"),
      createdAt: timestamp("created_at").defaultNow(),
      ...syncCols
    });
    totems = pgTable("totems", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      nombre: text("nombre").notNull(),
      casinoId: varchar("casino_id").notNull().references(() => casinos.id),
      secretHash: text("secret_hash").notNull(),
      version: text("version"),
      ipPublica: text("ip_publica"),
      ipLocal: text("ip_local"),
      hostname: text("hostname"),
      ultimaConexion: timestamp("ultima_conexion"),
      ultimoSync: timestamp("ultimo_sync"),
      pedidosPendientes: integer("pedidos_pendientes").notNull().default(0),
      estado: text("estado").notNull().default("offline"),
      notas: text("notas"),
      activo: boolean("activo").notNull().default(true),
      createdAt: timestamp("created_at").defaultNow()
    });
    totemReleases = pgTable("totem_releases", {
      id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
      version: text("version").notNull().unique(),
      url: text("url").notNull(),
      sha256: text("sha256").notNull(),
      notas: text("notas"),
      obligatoria: boolean("obligatoria").notNull().default(false),
      publicada: boolean("publicada").notNull().default(false),
      createdAt: timestamp("created_at").defaultNow()
    });
    insertUserSchema = createInsertSchema(users).pick({
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
    loginSchema = z.object({
      rut: z.string().min(1),
      password: z.string().min(1)
    });
    insertCasinoSchema = createInsertSchema(casinos).pick({
      nombre: true,
      direccion: true,
      comensalesDiarios: true,
      permitirCambioClaveTotem: true
    });
    insertFamiliaSchema = createInsertSchema(familias).pick({
      nombre: true,
      color: true
    });
    insertMinutaSchema = createInsertSchema(minutas).pick({
      casinoId: true,
      fecha: true,
      familia: true,
      opcion1: true,
      opcion2: true,
      opcion3: true,
      opcion4: true,
      opcion5: true
    });
    insertPedidoSchema = createInsertSchema(pedidos).pick({
      userId: true,
      minutaId: true,
      opcionSeleccionada: true,
      codigoQr: true,
      tipo: true,
      nombreVisita: true
    });
    insertPeriodoSchema = createInsertSchema(periodos).pick({
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
import { sqliteTable, text as text2, integer as integer2 } from "drizzle-orm/sqlite-core";
var syncCols2, users2, usuarioCasinos2, casinos2, familias2, minutas2, periodos2, pedidos2, syncOutbox, syncState, totemConfig;
var init_schema_sqlite = __esm({
  "shared/schema-sqlite.ts"() {
    "use strict";
    syncCols2 = {
      updatedAt: integer2("updated_at", { mode: "timestamp_ms" }).notNull(),
      deletedAt: integer2("deleted_at", { mode: "timestamp_ms" }),
      syncVersion: integer2("sync_version").notNull().default(0)
    };
    users2 = sqliteTable("users", {
      id: text2("id").primaryKey(),
      rut: text2("rut").notNull().unique(),
      password: text2("password").notNull(),
      nombre: text2("nombre").notNull(),
      apellido: text2("apellido").notNull(),
      telefono: text2("telefono"),
      fechaNacimiento: text2("fecha_nacimiento"),
      // YYYY-MM-DD
      passwordChangeRequired: integer2("password_change_required", { mode: "boolean" }).notNull().default(true),
      role: text2("role").notNull().default("comensal"),
      casinoId: text2("casino_id"),
      activo: integer2("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: integer2("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    usuarioCasinos2 = sqliteTable("usuario_casinos", {
      id: text2("id").primaryKey(),
      userId: text2("user_id").notNull(),
      casinoId: text2("casino_id").notNull(),
      createdAt: integer2("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    casinos2 = sqliteTable("casinos", {
      id: text2("id").primaryKey(),
      nombre: text2("nombre").notNull(),
      direccion: text2("direccion"),
      comensalesDiarios: integer2("comensales_diarios").notNull().default(0),
      permitirCambioClaveTotem: integer2("permitir_cambio_clave_totem", { mode: "boolean" }).notNull().default(false),
      activo: integer2("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: integer2("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    familias2 = sqliteTable("familias", {
      id: text2("id").primaryKey(),
      nombre: text2("nombre").notNull().unique(),
      color: text2("color").notNull().default("#D4A843"),
      activo: integer2("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: integer2("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    minutas2 = sqliteTable("minutas", {
      id: text2("id").primaryKey(),
      casinoId: text2("casino_id").notNull(),
      fecha: text2("fecha").notNull(),
      // YYYY-MM-DD
      familia: text2("familia").notNull().default("almuerzo"),
      opcion1: text2("opcion_1").notNull(),
      opcion2: text2("opcion_2").notNull(),
      opcion3: text2("opcion_3").notNull(),
      opcion4: text2("opcion_4"),
      opcion5: text2("opcion_5"),
      activo: integer2("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: integer2("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    periodos2 = sqliteTable("periodos", {
      id: text2("id").primaryKey(),
      casinoId: text2("casino_id").notNull(),
      nombre: text2("nombre").notNull(),
      fechaInicio: integer2("fecha_inicio", { mode: "timestamp_ms" }).notNull(),
      fechaFin: integer2("fecha_fin", { mode: "timestamp_ms" }).notNull(),
      fechaServicioInicio: text2("fecha_servicio_inicio"),
      // YYYY-MM-DD
      fechaServicioFin: text2("fecha_servicio_fin"),
      // YYYY-MM-DD
      activo: integer2("activo", { mode: "boolean" }).notNull().default(true),
      createdAt: integer2("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    pedidos2 = sqliteTable("pedidos", {
      id: text2("id").primaryKey(),
      userId: text2("user_id").notNull(),
      minutaId: text2("minuta_id").notNull(),
      opcionSeleccionada: integer2("opcion_seleccionada").notNull(),
      tipo: text2("tipo").notNull().default("seleccion"),
      nombreVisita: text2("nombre_visita"),
      asignadoPorDefecto: integer2("asignado_por_defecto", { mode: "boolean" }).notNull().default(false),
      codigoQr: text2("codigo_qr"),
      origenTotemId: text2("origen_totem_id"),
      impresoEn: integer2("impreso_en", { mode: "timestamp_ms" }),
      createdAt: integer2("created_at", { mode: "timestamp_ms" }),
      ...syncCols2
    });
    syncOutbox = sqliteTable("sync_outbox", {
      id: integer2("id").primaryKey({ autoIncrement: true }),
      tableName: text2("table_name").notNull(),
      recordId: text2("record_id").notNull(),
      op: text2("op").notNull(),
      // upsert | delete
      payload: text2("payload").notNull(),
      // JSON of the full row
      createdAt: integer2("created_at", { mode: "timestamp_ms" }).notNull(),
      attempts: integer2("attempts").notNull().default(0),
      lastError: text2("last_error"),
      acked: integer2("acked", { mode: "boolean" }).notNull().default(false)
    });
    syncState = sqliteTable("sync_state", {
      key: text2("key").primaryKey(),
      value: text2("value").notNull()
    });
    totemConfig = sqliteTable("totem_config", {
      key: text2("key").primaryKey(),
      value: text2("value").notNull()
    });
  }
});

// server/index.ts
import express from "express";

// server/routes.ts
import { createServer } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt2 from "bcryptjs";
import multer from "multer";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import * as path2 from "path";
import * as fs2 from "fs";

// server/storage.ts
import { eq, and, isNull, isNotNull, ne } from "drizzle-orm";

// server/db.ts
import * as fs from "fs";
import * as path from "path";
var DB_MODE = process.env.DB_MODE === "totem" ? "totem" : "cloud";
var _db;
var _pool;
var _schema;
var _sqlite;
if (DB_MODE === "cloud") {
  const { Pool } = __require("pg");
  const { drizzle } = __require("drizzle-orm/node-postgres");
  const schema = (init_schema(), __toCommonJS(schema_exports));
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in cloud mode");
  }
  _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _db = drizzle(_pool, { schema });
  _schema = schema;
} else {
  let ensureColumn = function(table, column, ddlFragment) {
    try {
      const cols = _sqlite.prepare(`PRAGMA table_info(${table})`).all();
      if (!cols.some((c) => c.name === column)) {
        _sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddlFragment}`);
      }
    } catch {
    }
  };
  ensureColumn2 = ensureColumn;
  const Database = __require("better-sqlite3");
  const { drizzle } = __require("drizzle-orm/better-sqlite3");
  const schema = (init_schema_sqlite(), __toCommonJS(schema_sqlite_exports));
  const dbPath = process.env.TOTEM_DB_PATH || path.resolve(process.cwd(), "totem-data", "totem.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _sqlite.pragma("synchronous = NORMAL");
  const ddl = fs.readFileSync(path.resolve(__dirname, "../shared/schema-sqlite.sql"), "utf-8");
  _sqlite.exec(ddl);
  ensureColumn("pedidos", "impreso_en", "impreso_en INTEGER");
  _db = drizzle(_sqlite, { schema });
  _schema = schema;
}
var ensureColumn2;
var db = _db;
var pool = _pool;
var sqlite = _sqlite;
var users3 = _schema.users;
var casinos3 = _schema.casinos;
var familias3 = _schema.familias;
var minutas3 = _schema.minutas;
var pedidos3 = _schema.pedidos;
var periodos3 = _schema.periodos;
var usuarioCasinos3 = _schema.usuarioCasinos;

// server/storage.ts
function enqueuePedidoOutboxSync(p, op) {
  if (!sqlite) return;
  const payload = {
    id: p.id,
    userId: p.userId,
    minutaId: p.minutaId,
    opcionSeleccionada: p.opcionSeleccionada,
    tipo: p.tipo,
    nombreVisita: p.nombreVisita,
    codigoQr: p.codigoQr,
    createdAt: typeof p.createdAt === "number" ? p.createdAt : new Date(p.createdAt || Date.now()).getTime(),
    origenTotemId: p.origenTotemId,
    // impresoEn: timestamp en ms cuando el comensal retiró el vale impreso.
    // Sin esto el cloud no aprende que el vale ya se entregó y permitiría
    // que un re-login en otro dispositivo del mismo casino vuelva a imprimir.
    impresoEn: p.impresoEn == null ? null : typeof p.impresoEn === "number" ? p.impresoEn : new Date(p.impresoEn).getTime()
  };
  sqlite.prepare(
    "INSERT INTO sync_outbox(table_name, record_id, op, payload, created_at) VALUES(?, ?, ?, ?, ?)"
  ).run("pedidos", p.id, op, JSON.stringify(payload), Date.now());
}
function touch(data) {
  return { ...data, updatedAt: /* @__PURE__ */ new Date(), syncVersion: Date.now() };
}
function tombstone() {
  return { activo: false, deletedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date(), syncVersion: Date.now() };
}
var DatabaseStorage = class {
  // ── Users ──
  async getUser(id) {
    const [user] = await db.select().from(users3).where(eq(users3.id, id));
    return user;
  }
  async getUserByRut(rut) {
    const raw = (rut || "").trim();
    const cleaned = raw.replace(/[^0-9kK]/g, "").toUpperCase();
    const looksLikeRut2 = cleaned.length > 1 && /^[0-9]+[0-9kK]$/.test(cleaned);
    const normalized = looksLikeRut2 ? cleaned.slice(0, -1) + "-" + cleaned.slice(-1) : raw;
    const [user] = await db.select().from(users3).where(eq(users3.rut, normalized));
    if (user) return user;
    if (looksLikeRut2) return void 0;
    const [byRaw] = await db.select().from(users3).where(eq(users3.rut, raw));
    return byRaw;
  }
  async getAllUsers() {
    return db.select().from(users3);
  }
  async createUser(insertUser) {
    const v = touch(insertUser);
    if (!v.id) v.id = __require("crypto").randomUUID();
    const [user] = await db.insert(users3).values(v).returning();
    return user;
  }
  async updateUser(id, data) {
    const [user] = await db.update(users3).set(touch(data)).where(eq(users3.id, id)).returning();
    return user;
  }
  async deleteUser(id) {
    const [u] = await db.update(users3).set(tombstone()).where(eq(users3.id, id)).returning();
    return !!u;
  }
  // ── Casinos ──
  async getCasinos() {
    return db.select().from(casinos3).where(eq(casinos3.activo, true));
  }
  async getAllCasinos() {
    return db.select().from(casinos3);
  }
  async getCasino(id) {
    const [casino] = await db.select().from(casinos3).where(eq(casinos3.id, id));
    return casino;
  }
  async createCasino(insertCasino) {
    const v = touch(insertCasino);
    if (!v.id) v.id = __require("crypto").randomUUID();
    const [casino] = await db.insert(casinos3).values(v).returning();
    return casino;
  }
  async updateCasino(id, data) {
    const [casino] = await db.update(casinos3).set(touch(data)).where(eq(casinos3.id, id)).returning();
    return casino;
  }
  async deleteCasino(id) {
    const [casino] = await db.update(casinos3).set(tombstone()).where(eq(casinos3.id, id)).returning();
    return !!casino;
  }
  async hardDeleteCasino(id) {
    const [casino] = await db.delete(casinos3).where(eq(casinos3.id, id)).returning();
    return !!casino;
  }
  // ── Minutas ──
  async getMinutasByCasino(casinoId) {
    return db.select().from(minutas3).where(and(eq(minutas3.casinoId, casinoId), eq(minutas3.activo, true)));
  }
  async getAllMinutasByCasino(casinoId) {
    return db.select().from(minutas3).where(eq(minutas3.casinoId, casinoId));
  }
  async getAllMinutas() {
    return db.select().from(minutas3);
  }
  async getMinuta(id) {
    const [minuta] = await db.select().from(minutas3).where(eq(minutas3.id, id));
    return minuta;
  }
  async createMinuta(insertMinuta) {
    const v = touch(insertMinuta);
    if (!v.id) v.id = __require("crypto").randomUUID();
    const [minuta] = await db.insert(minutas3).values(v).returning();
    return minuta;
  }
  async updateMinuta(id, data) {
    const [minuta] = await db.update(minutas3).set(touch(data)).where(eq(minutas3.id, id)).returning();
    return minuta;
  }
  async deleteMinuta(id) {
    const [minuta] = await db.update(minutas3).set(tombstone()).where(eq(minutas3.id, id)).returning();
    return !!minuta;
  }
  // ── Pedidos ──
  async getAllPedidos() {
    return db.select().from(pedidos3).where(isNull(pedidos3.deletedAt));
  }
  async getPedidosByUser(userId) {
    return db.select().from(pedidos3).where(and(eq(pedidos3.userId, userId), isNull(pedidos3.deletedAt)));
  }
  async getPedidoByUserAndMinuta(userId, minutaId) {
    const [pedido] = await db.select().from(pedidos3).where(and(
      eq(pedidos3.userId, userId),
      eq(pedidos3.minutaId, minutaId),
      isNull(pedidos3.deletedAt),
      ne(pedidos3.tipo, "visita")
    ));
    return pedido;
  }
  async createPedido(insertPedido) {
    const values = touch(insertPedido);
    if (DB_MODE === "totem" && !values.id) values.id = __require("crypto").randomUUID();
    if (DB_MODE === "totem" && !values.origenTotemId) {
      try {
        const row = sqlite.prepare("SELECT value FROM totem_config WHERE key = ?").get("totem_id");
        if (row?.value) values.origenTotemId = row.value;
      } catch {
      }
    }
    if (DB_MODE === "totem" && sqlite) {
      const tx = sqlite.transaction((v) => {
        const [p] = db.insert(pedidos3).values(v).returning().all ? db.insert(pedidos3).values(v).returning().all() : [];
        const inserted = p ?? sqlite.prepare("SELECT * FROM pedidos WHERE id = ?").get(v.id);
        enqueuePedidoOutboxSync(inserted, "insert");
        return inserted;
      });
      const pedido2 = tx(values);
      return pedido2;
    }
    const [pedido] = await db.insert(pedidos3).values(values).returning();
    return pedido;
  }
  async updatePedido(id, data) {
    if (DB_MODE === "totem" && sqlite) {
      const tx = sqlite.transaction((d) => {
        const [p] = db.update(pedidos3).set(d).where(eq(pedidos3.id, id)).returning().all ? db.update(pedidos3).set(d).where(eq(pedidos3.id, id)).returning().all() : [];
        const updated = p ?? sqlite.prepare("SELECT * FROM pedidos WHERE id = ?").get(id);
        if (updated) enqueuePedidoOutboxSync(updated, "update");
        return updated;
      });
      return tx(touch(data));
    }
    const [pedido] = await db.update(pedidos3).set(touch(data)).where(eq(pedidos3.id, id)).returning();
    return pedido;
  }
  async getPedidosByMinuta(minutaId) {
    return db.select().from(pedidos3).where(and(eq(pedidos3.minutaId, minutaId), isNull(pedidos3.deletedAt)));
  }
  async markPedidoImpreso(id) {
    if (DB_MODE === "totem" && sqlite) {
      const tx = sqlite.transaction(() => {
        const data = touch({ impresoEn: /* @__PURE__ */ new Date() });
        const [p] = db.update(pedidos3).set(data).where(eq(pedidos3.id, id)).returning().all ? db.update(pedidos3).set(data).where(eq(pedidos3.id, id)).returning().all() : [];
        const updated = p ?? sqlite.prepare("SELECT * FROM pedidos WHERE id = ?").get(id);
        if (updated) enqueuePedidoOutboxSync(updated, "update");
        return updated;
      });
      return tx();
    }
    const [pedido] = await db.update(pedidos3).set(touch({ impresoEn: /* @__PURE__ */ new Date() })).where(eq(pedidos3.id, id)).returning();
    return pedido;
  }
  async getAnuladosByMinuta(minutaId) {
    return db.select().from(pedidos3).where(and(eq(pedidos3.minutaId, minutaId), isNotNull(pedidos3.deletedAt)));
  }
  async getPedidoById(id) {
    const [p] = await db.select().from(pedidos3).where(eq(pedidos3.id, id));
    return p;
  }
  async deletePedido(id) {
    if (DB_MODE === "totem" && sqlite) {
      const tx = sqlite.transaction(() => {
        const [p] = db.update(pedidos3).set(tombstone()).where(eq(pedidos3.id, id)).returning().all ? db.update(pedidos3).set(tombstone()).where(eq(pedidos3.id, id)).returning().all() : [];
        const updated = p ?? sqlite.prepare("SELECT * FROM pedidos WHERE id = ?").get(id);
        if (updated) enqueuePedidoOutboxSync(updated, "delete");
        return !!updated;
      });
      return tx();
    }
    const [pedido] = await db.update(pedidos3).set(tombstone()).where(eq(pedidos3.id, id)).returning();
    return !!pedido;
  }
  // ── Familias ──
  async getAllFamilias() {
    return db.select().from(familias3);
  }
  async createFamilia(insertFamilia) {
    const v = touch(insertFamilia);
    if (!v.id) v.id = __require("crypto").randomUUID();
    const [familia] = await db.insert(familias3).values(v).returning();
    return familia;
  }
  async updateFamilia(id, data) {
    const [familia] = await db.update(familias3).set(touch(data)).where(eq(familias3.id, id)).returning();
    return familia;
  }
  async deleteFamilia(id) {
    const [familia] = await db.update(familias3).set(tombstone()).where(eq(familias3.id, id)).returning();
    return !!familia;
  }
  // ── Periodos ──
  async getPeriodosByCasino(casinoId) {
    return db.select().from(periodos3).where(eq(periodos3.casinoId, casinoId));
  }
  async getAllPeriodos() {
    return db.select().from(periodos3);
  }
  async getPeriodo(id) {
    const [periodo] = await db.select().from(periodos3).where(eq(periodos3.id, id));
    return periodo;
  }
  async createPeriodo(insertPeriodo) {
    const v = touch(insertPeriodo);
    if (!v.id) v.id = __require("crypto").randomUUID();
    const [periodo] = await db.insert(periodos3).values(v).returning();
    return periodo;
  }
  async updatePeriodo(id, data) {
    const [periodo] = await db.update(periodos3).set(touch(data)).where(eq(periodos3.id, id)).returning();
    return periodo;
  }
  async deletePeriodo(id) {
    const [periodo] = await db.update(periodos3).set(tombstone()).where(eq(periodos3.id, id)).returning();
    return !!periodo;
  }
  // ── Usuario ↔ Casinos (multi-casino interlocutor / encargado) ──
  async getUserCasinoIds(userId) {
    const rows = await db.select().from(usuarioCasinos3).where(eq(usuarioCasinos3.userId, userId));
    return rows.map((r) => r.casinoId);
  }
  async setUserCasinos(userId, casinoIds) {
    await db.delete(usuarioCasinos3).where(eq(usuarioCasinos3.userId, userId));
    if (casinoIds.length === 0) return;
    const rows = casinoIds.map((cid) => ({ userId, casinoId: cid }));
    await db.insert(usuarioCasinos3).values(rows).onConflictDoNothing();
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
init_schema();

// server/cron.ts
import cron from "node-cron";
init_schema();
import { eq as eq2, and as and2 } from "drizzle-orm";
async function generateDailyReport(targetDate) {
  const today = targetDate ?? (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const allCasinos = await db.select().from(casinos).where(eq2(casinos.activo, true));
  const report = [];
  for (const casino of allCasinos) {
    const minutasByCasino = await db.select().from(minutas).where(and2(eq2(minutas.casinoId, casino.id), eq2(minutas.fecha, today), eq2(minutas.activo, true)));
    if (minutasByCasino.length === 0) continue;
    let totalInscritos = 0;
    let totalNoAsiste = 0;
    let totalVisitas = 0;
    const porOpcion = {};
    for (const minuta of minutasByCasino) {
      const pedidosList = await db.select().from(pedidos).where(eq2(pedidos.minutaId, minuta.id));
      for (const p of pedidosList) {
        if (p.tipo === "no_asiste" || p.opcionSeleccionada === 0) {
          totalNoAsiste++;
        } else if (p.tipo === "visita") {
          totalVisitas++;
          totalInscritos++;
        } else {
          totalInscritos++;
          const op = p.opcionSeleccionada ?? 0;
          porOpcion[op] = (porOpcion[op] ?? 0) + 1;
        }
      }
    }
    report.push({
      casinoNombre: casino.nombre,
      fecha: today,
      totalInscritos,
      totalNoAsiste,
      totalVisitas,
      porOpcion
    });
  }
  return report;
}
function logReport(entries, targetDate) {
  console.log("\u2500".repeat(60));
  console.log(`\u{1F4CA} REPORTE DIARIO VASCAN \u2014 ${targetDate}`);
  console.log("\u2500".repeat(60));
  if (entries.length === 0) {
    console.log("  Sin minutas programadas para hoy.");
  } else {
    for (const e of entries) {
      console.log(`
  Casino: ${e.casinoNombre}`);
      console.log(`  \u251C\u2500 Inscritos : ${e.totalInscritos}`);
      console.log(`  \u251C\u2500 No asiste : ${e.totalNoAsiste}`);
      console.log(`  \u251C\u2500 Visitas   : ${e.totalVisitas}`);
      const opKeys = Object.keys(e.porOpcion).map(Number).sort();
      for (const k of opKeys) {
        console.log(`  \u2502    Opci\xF3n ${k}: ${e.porOpcion[k]} persona(s)`);
      }
      console.log(`  \u2514\u2500 Total     : ${e.totalInscritos + e.totalNoAsiste}`);
    }
  }
  console.log("\n" + "\u2500".repeat(60));
}
function startCronJobs() {
  cron.schedule("0 3 * * *", async () => {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    console.log(`[cron] Generando reporte diario para ${today}...`);
    try {
      const entries = await generateDailyReport(today);
      logReport(entries, today);
    } catch (err) {
      console.error("[cron] Error al generar reporte diario:", err);
    }
  }, { timezone: "UTC" });
  cron.schedule("0 4 * * *", async () => {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const nowUTC = (/* @__PURE__ */ new Date()).getUTCHours();
    if (nowUTC === 4) {
      console.log(`[cron] Reporte horario verano CL para ${today}...`);
      try {
        const entries = await generateDailyReport(today);
        logReport(entries, today);
      } catch (err) {
        console.error("[cron] Error al generar reporte (horario verano):", err);
      }
    }
  }, { timezone: "UTC" });
  console.log("[cron] Reportes diarios programados (03:00 y 04:00 UTC \u2192 medianoche CL)");
}

// server/sync-cloud.ts
import bcrypt from "bcryptjs";
init_schema();
import { eq as eq3, and as and3, gt, sql as sql2, inArray } from "drizzle-orm";
async function requireTotem(req, res, next) {
  const id = req.header("x-totem-id");
  const secret = req.header("x-totem-secret");
  if (!id || !secret) return res.status(401).json({ message: "Faltan credenciales del t\xF3tem" });
  const [t] = await db.select().from(totems).where(eq3(totems.id, id));
  if (!t || !t.activo) return res.status(401).json({ message: "T\xF3tem no autorizado" });
  const ok = await bcrypt.compare(secret, t.secretHash);
  if (!ok) return res.status(401).json({ message: "Credenciales inv\xE1lidas" });
  req.totem = t;
  next();
}
var bootstrapTokens = [];
function issueBootstrapToken(createdBy, casinoId) {
  const buf = __require("crypto").randomBytes(24).toString("base64url");
  const hash = __require("crypto").createHash("sha256").update(buf).digest("hex");
  const now = Date.now();
  for (let i = bootstrapTokens.length - 1; i >= 0; i--) {
    if (bootstrapTokens[i].expiresAt < now) bootstrapTokens.splice(i, 1);
  }
  bootstrapTokens.push({ hash, expiresAt: now + 60 * 60 * 1e3, createdBy, casinoId });
  return buf;
}
function consumeBootstrapToken(token) {
  const hash = __require("crypto").createHash("sha256").update(token).digest("hex");
  const now = Date.now();
  const idx = bootstrapTokens.findIndex((t) => t.hash === hash && t.expiresAt > now);
  if (idx < 0) {
    if (!!process.env.TOTEM_BOOTSTRAP_TOKEN && token === process.env.TOTEM_BOOTSTRAP_TOKEN) {
      return { valid: true };
    }
    return { valid: false };
  }
  const { casinoId } = bootstrapTokens[idx];
  bootstrapTokens.splice(idx, 1);
  return { valid: true, casinoId };
}
async function requireBootstrapToken(req, res, next) {
  const token = req.header("x-bootstrap-token");
  if (!token) return res.status(401).json({ message: "Token de instalaci\xF3n requerido" });
  const result = consumeBootstrapToken(token);
  if (!result.valid) {
    return res.status(401).json({ message: "Token de instalaci\xF3n inv\xE1lido o expirado" });
  }
  req.bootstrapCasinoId = result.casinoId;
  next();
}
function registerSyncRoutes(app2) {
  app2.post("/api/totem/register", requireBootstrapToken, async (req, res) => {
    try {
      const { nombre, hostname, ipLocal, version } = req.body;
      const casinoId = req.bootstrapCasinoId || req.body.casinoId;
      if (!nombre || !casinoId) {
        return res.status(400).json({ message: "Faltan campos: nombre, casinoId" });
      }
      const casino = await storage.getCasino(casinoId);
      if (!casino) return res.status(404).json({ message: "Casino no existe" });
      const secret = generateSecret(48);
      const secretHash = await bcrypt.hash(secret, 10);
      const ipPublica = (req.ip || req.socket.remoteAddress || "").replace("::ffff:", "");
      const [t] = await db.insert(totems).values({
        nombre,
        casinoId,
        secretHash,
        hostname,
        ipLocal,
        ipPublica,
        version,
        ultimaConexion: /* @__PURE__ */ new Date(),
        estado: "online"
      }).returning();
      return res.status(201).json({
        totemId: t.id,
        secret,
        casino: { id: casino.id, nombre: casino.nombre }
      });
    } catch (err) {
      console.error("totem register error", err);
      return res.status(500).json({ message: "Error al registrar t\xF3tem" });
    }
  });
  app2.post("/api/totem/heartbeat", requireTotem, async (req, res) => {
    try {
      const t = req.totem;
      const { version, pedidosPendientes, ipLocal, hostname } = req.body || {};
      const ipPublica = (req.ip || req.socket.remoteAddress || "").replace("::ffff:", "");
      await db.update(totems).set({
        ultimaConexion: /* @__PURE__ */ new Date(),
        version: version ?? t.version,
        pedidosPendientes: typeof pedidosPendientes === "number" ? pedidosPendientes : t.pedidosPendientes,
        ipPublica,
        ipLocal: ipLocal ?? t.ipLocal,
        hostname: hostname ?? t.hostname,
        estado: "online"
      }).where(eq3(totems.id, t.id));
      return res.json({ ok: true, serverTime: Date.now() });
    } catch (err) {
      console.error("heartbeat error", err);
      return res.status(500).json({ message: "Error en heartbeat" });
    }
  });
  app2.get("/api/totem/pull", requireTotem, async (req, res) => {
    try {
      const t = req.totem;
      const since = new Date(parseInt(req.query.since || "0", 10));
      const limit = Math.min(parseInt(req.query.limit || "5000", 10), 1e4);
      const casinoFilter = (col) => eq3(col, t.casinoId);
      const minutaIdsForCasino = db.select({ id: minutas.id }).from(minutas).where(eq3(minutas.casinoId, t.casinoId));
      const [casinosRows, familiasRows, usersRows, minutasRows, periodosRows, pedidosRows] = await Promise.all([
        db.select().from(casinos).where(and3(gt(casinos.updatedAt, since), eq3(casinos.id, t.casinoId))).limit(limit),
        db.select().from(familias).where(gt(familias.updatedAt, since)).limit(limit),
        db.select().from(users).where(and3(gt(users.updatedAt, since), casinoFilter(users.casinoId))).limit(limit),
        db.select().from(minutas).where(and3(gt(minutas.updatedAt, since), casinoFilter(minutas.casinoId))).limit(limit),
        db.select().from(periodos).where(and3(gt(periodos.updatedAt, since), casinoFilter(periodos.casinoId))).limit(limit),
        // Pedidos del casino (incluye tombstones para que el tótem mirror anulaciones desde el dashboard).
        db.select().from(pedidos).where(and3(gt(pedidos.updatedAt, since), inArray(pedidos.minutaId, minutaIdsForCasino))).limit(limit)
      ]);
      await db.update(totems).set({ ultimoSync: /* @__PURE__ */ new Date() }).where(eq3(totems.id, t.id));
      const allRows = [...casinosRows, ...familiasRows, ...usersRows, ...minutasRows, ...periodosRows, ...pedidosRows];
      const maxUpdatedAt = allRows.reduce((m, r) => {
        const ts = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
        return ts > m ? ts : m;
      }, since.getTime());
      return res.json({
        serverTime: Date.now(),
        since: since.getTime(),
        // Client should set its next cursor to this exact value, NOT serverTime.
        nextCursor: maxUpdatedAt,
        data: {
          casinos: casinosRows,
          familias: familiasRows,
          users: usersRows,
          minutas: minutasRows,
          periodos: periodosRows,
          pedidos: pedidosRows
        }
      });
    } catch (err) {
      console.error("pull error", err);
      return res.status(500).json({ message: "Error al sincronizar pull" });
    }
  });
  app2.post("/api/totem/push", requireTotem, async (req, res) => {
    try {
      const t = req.totem;
      const incoming = Array.isArray(req.body?.pedidos) ? req.body.pedidos : [];
      const accepted = [];
      const rejected = [];
      for (const p of incoming) {
        try {
          if (!p.id || !p.userId || !p.minutaId) {
            rejected.push({ id: p.id ?? "?", reason: "Faltan campos requeridos" });
            continue;
          }
          const [m] = await db.select().from(minutas).where(eq3(minutas.id, p.minutaId));
          if (!m) {
            rejected.push({ id: p.id, reason: "Minuta no existe" });
            continue;
          }
          if (m.casinoId !== t.casinoId) {
            rejected.push({ id: p.id, reason: "Minuta de otro casino" });
            continue;
          }
          const [u] = await db.select().from(users).where(eq3(users.id, p.userId));
          if (!u) {
            rejected.push({ id: p.id, reason: "Usuario no existe" });
            continue;
          }
          const payload = {
            id: p.id,
            userId: p.userId,
            minutaId: p.minutaId,
            opcionSeleccionada: p.opcionSeleccionada ?? 0,
            tipo: p.tipo || "seleccion",
            nombreVisita: p.nombreVisita ?? null,
            codigoQr: p.codigoQr ?? null,
            // impresoEn: monotonic — una vez marcado no debe volver a null.
            // El cloud confía en el valor del tótem (es la fuente de verdad
            // de la impresión física).
            impresoEn: p.impresoEn ? new Date(p.impresoEn) : null,
            createdAt: p.createdAt ? new Date(p.createdAt) : /* @__PURE__ */ new Date(),
            origenTotemId: t.id,
            updatedAt: /* @__PURE__ */ new Date(),
            syncVersion: Date.now()
          };
          await db.insert(pedidos).values(payload).onConflictDoUpdate({
            target: pedidos.id,
            set: {
              opcionSeleccionada: payload.opcionSeleccionada,
              tipo: payload.tipo,
              nombreVisita: payload.nombreVisita,
              codigoQr: payload.codigoQr,
              impresoEn: payload.impresoEn,
              updatedAt: payload.updatedAt,
              syncVersion: payload.syncVersion,
              origenTotemId: t.id
            }
          });
          accepted.push(p.id);
        } catch (e) {
          rejected.push({ id: p.id ?? "?", reason: e?.message || "error" });
        }
      }
      const remaining = Math.max(0, (t.pedidosPendientes ?? 0) - accepted.length);
      await db.update(totems).set({
        pedidosPendientes: remaining,
        ultimoSync: /* @__PURE__ */ new Date(),
        ultimaConexion: /* @__PURE__ */ new Date()
      }).where(eq3(totems.id, t.id));
      return res.json({ accepted, rejected, serverTime: Date.now() });
    } catch (err) {
      console.error("push error", err);
      return res.status(500).json({ message: "Error al sincronizar push" });
    }
  });
  app2.get("/api/totem/version/latest", requireTotem, async (_req, res) => {
    try {
      const [r] = await db.select().from(totemReleases).where(eq3(totemReleases.publicada, true)).orderBy(sql2`created_at DESC`).limit(1);
      if (!r) return res.json({ version: null });
      return res.json({ version: r.version, url: r.url, sha256: r.sha256, obligatoria: r.obligatoria, notas: r.notas });
    } catch (err) {
      console.error("version latest error", err);
      return res.status(500).json({ message: "Error al consultar versi\xF3n" });
    }
  });
}
function generateSecret(len = 48) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = __require("crypto").randomBytes(len);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// server/routes.ts
import { eq as eqOp, sql as sqlOp } from "drizzle-orm";
var PgSession = connectPgSimple(session);
var upload = multer({ dest: "/tmp/uploads/" });
var SUPER_ADMIN_RUT = "21212011-1";
function validarRutChileno(rutCompleto) {
  const cleaned = rutCompleto.replace(/\./g, "").replace(/-/g, "").trim().toUpperCase();
  if (cleaned.length < 2) return false;
  const cuerpo = cleaned.slice(0, -1);
  const dvIngresado = cleaned.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }
  const resto = suma % 11;
  const dvCalculado = resto === 0 ? "0" : resto === 1 ? "K" : String(11 - resto);
  return dvIngresado === dvCalculado;
}
function looksLikeRut(val) {
  return /\d/.test(val) && /^[\d.\-kK]+$/.test(val.trim());
}
async function ensureSuperAdmin() {
  try {
    const existing = await storage.getUserByRut(SUPER_ADMIN_RUT);
    if (!existing) {
      const hashed = await bcrypt2.hash("peseta832", 10);
      await storage.createUser({
        rut: SUPER_ADMIN_RUT,
        password: hashed,
        nombre: "Super",
        apellido: "Admin",
        role: "admin",
        casinoId: null
      });
      console.log("Super admin created.");
    }
  } catch (err) {
    console.error("Super admin init error:", err);
  }
  try {
    const oliver = await storage.getUserByRut("olivervasquez");
    if (!oliver) {
      const oliverPassword = process.env.OLIVER_PASSWORD;
      if (!oliverPassword) throw new Error("OLIVER_PASSWORD env var is not set");
      const hashed = await bcrypt2.hash(oliverPassword, 10);
      await storage.createUser({
        rut: "olivervasquez",
        password: hashed,
        nombre: "Oliver",
        apellido: "Vasquez",
        role: "admin",
        casinoId: null
      });
      console.log("Oliver admin created.");
    }
  } catch (err) {
    console.error("Oliver admin init error:", err);
  }
  try {
    const oliverComensal = await storage.getUserByRut("9876543-3");
    if (!oliverComensal) {
      const password = process.env.OLIVER_PASSWORD;
      if (!password) throw new Error("OLIVER_PASSWORD env var is not set");
      const casinos4 = await storage.getCasinos();
      const hashed = await bcrypt2.hash(password, 10);
      await storage.createUser({
        rut: "9876543-3",
        password: hashed,
        nombre: "Oliver (Demo)",
        apellido: "Comensal",
        role: "comensal",
        casinoId: casinos4[0]?.id ?? null
      });
      console.log("Oliver comensal demo created.");
    }
  } catch (err) {
    console.error("Oliver comensal init error:", err);
  }
  try {
    const oliverInterlocutor = await storage.getUserByRut("7654321-6");
    if (!oliverInterlocutor) {
      const password = process.env.OLIVER_PASSWORD;
      if (!password) throw new Error("OLIVER_PASSWORD env var is not set");
      const casinos4 = await storage.getCasinos();
      const hashed = await bcrypt2.hash(password, 10);
      await storage.createUser({
        rut: "7654321-6",
        password: hashed,
        nombre: "Oliver (Demo)",
        apellido: "Interlocutor",
        role: "interlocutor",
        casinoId: casinos4[0]?.id ?? null
      });
      console.log("Oliver interlocutor demo created.");
    }
  } catch (err) {
    console.error("Oliver interlocutor init error:", err);
  }
}
function requireAdmin(req, res, next) {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(401).json({ message: "No autenticado" });
  }
  storage.getUser(userId).then((user) => {
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }
    if (user.role !== "admin" && user.role !== "interlocutor" && user.role !== "encargado_casino") {
      return res.status(403).json({ message: "Acceso restringido" });
    }
    req.currentUser = user;
    next();
  }).catch(() => {
    return res.status(500).json({ message: "Error de autenticaci\xF3n" });
  });
}
function requireAdminOnly(req, res, next) {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ message: "No autenticado" });
  storage.getUser(userId).then((user) => {
    if (!user) return res.status(401).json({ message: "Usuario no encontrado" });
    if (user.role !== "admin") return res.status(403).json({ message: "Solo administradores" });
    req.currentUser = user;
    next();
  }).catch(() => res.status(500).json({ message: "Error de autenticaci\xF3n" }));
}
async function getAccessibleCasinoIds(user) {
  if (!user) return [];
  if (user.role === "admin") return null;
  const extra = await storage.getUserCasinoIds(user.id);
  const ids = new Set(extra);
  if (user.casinoId) ids.add(user.casinoId);
  return Array.from(ids);
}
async function assertCasinoAccess(req, res, casinoId) {
  const me = req.currentUser;
  const accessible = await getAccessibleCasinoIds(me);
  if (accessible === null) return true;
  if (!casinoId || casinoId === "all") {
    res.status(403).json({ message: "Debes seleccionar un casino al que tengas acceso" });
    return false;
  }
  if (!accessible.includes(casinoId)) {
    res.status(403).json({ message: "Sin acceso a este casino" });
    return false;
  }
  return true;
}
async function autoSeed() {
  try {
    const existingCasinos = await storage.getCasinos();
    if (existingCasinos.length > 0) return;
    console.log("Auto-seeding database...");
    const casino = await storage.createCasino({
      nombre: "Casino Central Santiago",
      direccion: "Av. Providencia 1234, Santiago"
    });
    const casino2 = await storage.createCasino({
      nombre: "Casino Planta Rancagua",
      direccion: "Calle Industrial 567, Rancagua"
    });
    const today = /* @__PURE__ */ new Date();
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    const menus1 = [
      { o1: "Pollo al horno con arroz y ensalada", o2: "Pescado frito con pur\xE9 de papas", o3: "Pasta bolo\xF1esa con parmesano", o4: "Ensalada C\xE9sar con pollo grillado" },
      { o1: "Lomo saltado con arroz", o2: "Cazuela de vacuno", o3: "Tortilla espa\xF1ola con ensalada", o4: "Wrap de pollo teriyaki" },
      { o1: "Chuleta de cerdo con arroz", o2: "Merluza al horno con verduras", o3: "Lasa\xF1a de carne", o4: "Bowl de quinoa con pollo" },
      { o1: "Estofado de res con papas", o2: "Salm\xF3n grillado con esp\xE1rragos", o3: "Risotto de champi\xF1ones", o4: null },
      { o1: "Pollo a la plancha con ensalada", o2: "Alb\xF3ndigas en salsa con arroz", o3: "Tacos de carne", o4: "Sopa de verduras con pan" },
      { o1: "Milanesa de pollo con pur\xE9", o2: "Pescado al vapor con arroz", o3: "Empanadas de pino", o4: null },
      { o1: "Asado alem\xE1n con pur\xE9", o2: "Carbonada", o3: "Pastel de choclo", o4: "Ensalada mediterr\xE1nea" }
    ];
    for (let i = 0; i < dates.length; i++) {
      const menu = menus1[i % menus1.length];
      await storage.createMinuta({
        casinoId: casino.id,
        fecha: dates[i],
        opcion1: menu.o1,
        opcion2: menu.o2,
        opcion3: menu.o3,
        opcion4: menu.o4
      });
      await storage.createMinuta({
        casinoId: casino2.id,
        fecha: dates[i],
        opcion1: "Cazuela de vacuno con verduras",
        opcion2: "Lomo saltado con arroz",
        opcion3: "Tortilla espa\xF1ola con ensalada"
      });
    }
    const hashedPassword = await bcrypt2.hash("123456", 10);
    await storage.createUser({
      rut: "12345678-9",
      password: hashedPassword,
      nombre: "Juan",
      apellido: "P\xE9rez",
      role: "comensal",
      casinoId: casino.id
    });
    await storage.createUser({
      rut: "11111111-1",
      password: hashedPassword,
      nombre: "Admin",
      apellido: "Sistema",
      role: "admin",
      casinoId: null
    });
    await storage.createUser({
      rut: "22222222-2",
      password: hashedPassword,
      nombre: "Mar\xEDa",
      apellido: "Gonz\xE1lez",
      role: "interlocutor",
      casinoId: casino.id
    });
    console.log("Auto-seed complete.");
  } catch (err) {
    console.error("Auto-seed error:", err);
  }
}
async function backfillRutPasswords() {
  try {
    const all = await storage.getAllUsers();
    const targets = all.filter((u) => u.passwordChangeRequired && u.rut !== "21212011-1");
    if (targets.length === 0) return;
    console.log(`[migration] backfilling RUT-based passwords for ${targets.length} usuarios...`);
    let ok = 0;
    for (const u of targets) {
      const digits = (u.rut || "").replace(/[^0-9]/g, "");
      if (digits.length < 4) continue;
      const hashed = await bcrypt2.hash(digits.slice(0, 4), 10);
      await storage.updateUser(u.id, { password: hashed, passwordChangeRequired: false });
      ok++;
    }
    console.log(`[migration] backfill OK: ${ok}/${targets.length}`);
  } catch (err) {
    console.error("[migration] backfill error:", err);
  }
}
async function registerRoutes(app2) {
  const sessionStore = pool ? new PgSession({ pool, tableName: "session", createTableIfMissing: true }) : new session.MemoryStore();
  app2.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "vascan-dev-fallback-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1e3,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
      }
    })
  );
  if (process.env.DB_MODE !== "totem") {
    await autoSeed();
    await ensureSuperAdmin();
    await backfillRutPasswords();
  }
  if (process.env.DB_MODE !== "totem") {
    app2.get("/admin", (_req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      const filePath = path2.resolve(process.cwd(), "web", "src", "admin.html");
      res.sendFile(filePath);
    });
  } else {
    app2.get("/admin", (_req, res) => {
      res.status(403).send("Panel administrativo no disponible en t\xF3tem. Use el panel cloud.");
    });
  }
  if (process.env.DB_MODE === "totem") {
    const TOTEM_READONLY_PREFIXES = [
      "/api/usuarios",
      "/api/casinos",
      "/api/minutas",
      "/api/familias",
      "/api/periodos",
      "/api/totems",
      "/api/totem-releases",
      "/api/plantillas",
      "/api/dashboard",
      "/api/reportes"
    ];
    app2.use((req, res, next) => {
      if (req.method === "GET") return next();
      if (req.path.startsWith("/api/pedidos")) return next();
      if (req.path.startsWith("/api/auth")) return next();
      if (req.path.startsWith("/api/totem/")) return next();
      if (TOTEM_READONLY_PREFIXES.some((p) => req.path.startsWith(p))) {
        return res.status(403).json({ message: "Operaci\xF3n no permitida en t\xF3tem (use panel cloud)" });
      }
      next();
    });
  }
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "RUT y contrase\xF1a son requeridos" });
      }
      const { rut, password } = parsed.data;
      const user = await storage.getUserByRut(rut);
      if (!user) {
        return res.status(401).json({ message: "Credenciales inv\xE1lidas" });
      }
      const isValid = await bcrypt2.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciales inv\xE1lidas" });
      }
      if (!user.activo) {
        return res.status(403).json({ message: "Usuario desactivado" });
      }
      req.session.userId = user.id;
      const { password: _, ...userWithoutPassword } = user;
      const casinoIds = await getAccessibleCasinoIds(user);
      return res.json({ user: { ...userWithoutPassword, casinoIds: casinoIds || [] } });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesi\xF3n" });
      }
      return res.json({ message: "Sesi\xF3n cerrada" });
    });
  });
  app2.get("/api/auth/me", async (req, res) => {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ message: "No autenticado" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }
    const { password: _, ...userWithoutPassword } = user;
    const casinoIds = await getAccessibleCasinoIds(user);
    return res.json({ user: { ...userWithoutPassword, casinoIds: casinoIds || [] } });
  });
  app2.post("/api/auth/change-password", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "No autenticado" });
      const { currentPassword, newPassword } = req.body || {};
      if (!newPassword || String(newPassword).length < 4) {
        return res.status(400).json({ message: "La nueva clave debe tener al menos 4 caracteres" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Usuario no encontrado" });
      if (!user.passwordChangeRequired) {
        if (!currentPassword) return res.status(400).json({ message: "Clave actual requerida" });
        const ok = await bcrypt2.compare(currentPassword, user.password);
        if (!ok) return res.status(401).json({ message: "Clave actual incorrecta" });
      }
      const hashed = await bcrypt2.hash(newPassword, 10);
      await storage.updateUser(user.id, { password: hashed, passwordChangeRequired: false });
      return res.json({ message: "Clave actualizada" });
    } catch (error) {
      console.error("Change password error:", error);
      return res.status(500).json({ message: "Error al cambiar la clave" });
    }
  });
  app2.post("/api/auth/reset-password-by-rut", async (req, res) => {
    try {
      const sessionUserId = req.session.userId;
      if (!sessionUserId) return res.status(401).json({ message: "No autenticado" });
      const actor = await storage.getUser(sessionUserId);
      if (!actor) return res.status(401).json({ message: "Usuario no encontrado" });
      const isStaff = actor.role === "admin" || actor.role === "interlocutor" || actor.role === "encargado_casino";
      if (!isStaff) return res.status(403).json({ message: "Solo staff puede resetear claves" });
      const { rut, newPassword } = req.body || {};
      if (!rut || !newPassword || String(newPassword).length < 4) {
        return res.status(400).json({ message: "RUT y nueva clave (\u22654 d\xEDgitos) son requeridos" });
      }
      const target = await storage.getUserByRut(rut);
      if (!target) return res.status(404).json({ message: "No se encontr\xF3 un usuario con ese RUT" });
      if (target.rut === SUPER_ADMIN_RUT) {
        return res.status(403).json({ message: "Este usuario no puede modificarse desde el t\xF3tem" });
      }
      const actorAccessible = await getAccessibleCasinoIds(actor);
      if (actorAccessible !== null) {
        const targetCasinos = new Set(await storage.getUserCasinoIds(target.id));
        if (target.casinoId) targetCasinos.add(target.casinoId);
        const overlap = Array.from(targetCasinos).some((cid) => actorAccessible.includes(cid));
        if (!overlap) return res.status(403).json({ message: "Sin acceso a este usuario" });
      }
      const hashed = await bcrypt2.hash(String(newPassword), 10);
      await storage.updateUser(target.id, { password: hashed, passwordChangeRequired: false });
      console.log(`[audit] reset-password-by-rut: actor=${actor.rut} (${actor.role}) \u2192 target=${target.rut}`);
      return res.json({ message: "Clave actualizada", user: { rut: target.rut, nombre: target.nombre, apellido: target.apellido } });
    } catch (error) {
      console.error("Reset password by rut error:", error);
      return res.status(500).json({ message: "Error al resetear la clave" });
    }
  });
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Datos inv\xE1lidos", errors: parsed.error.errors });
      }
      const existing = await storage.getUserByRut(parsed.data.rut);
      if (existing) {
        return res.status(409).json({ message: "El RUT ya est\xE1 registrado" });
      }
      const hashedPassword = await bcrypt2.hash(parsed.data.password, 10);
      const user = await storage.createUser({
        ...parsed.data,
        password: hashedPassword
      });
      const { password: _, ...userWithoutPassword } = user;
      return res.status(201).json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/usuarios", requireAdmin, async (req, res) => {
    try {
      const me = req.currentUser;
      const accessible = await getAccessibleCasinoIds(me);
      const allUsers = await storage.getAllUsers();
      const allUserCasinos = await Promise.all(
        allUsers.map(async (u) => ({ id: u.id, ids: await storage.getUserCasinoIds(u.id) }))
      );
      const userCasinoMap = new Map(allUserCasinos.map((x) => [x.id, x.ids]));
      let filtered = allUsers.filter((u) => u.rut !== SUPER_ADMIN_RUT);
      if (accessible !== null) {
        const set = new Set(accessible);
        filtered = filtered.filter((u) => {
          if (u.casinoId && set.has(u.casinoId)) return true;
          const extra = userCasinoMap.get(u.id) || [];
          return extra.some((cid) => set.has(cid));
        });
      }
      const reqCasino = req.query.casinoId?.trim();
      if (reqCasino && reqCasino !== "all") {
        filtered = filtered.filter((u) => {
          if (u.casinoId === reqCasino) return true;
          const extra = userCasinoMap.get(u.id) || [];
          return extra.includes(reqCasino);
        });
      }
      const result = filtered.map(({ password, ...u }) => ({
        ...u,
        casinoIds: userCasinoMap.get(u.id) || []
      }));
      return res.json(result);
    } catch (error) {
      console.error("Get users error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/usuarios", requireAdminOnly, async (req, res) => {
    try {
      const { rut, nombre, apellido, telefono, role, casinoId, casinoIds, fechaNacimiento, password: pwd } = req.body;
      if (!rut || !nombre || !apellido) {
        return res.status(400).json({ message: "RUT, nombre y apellido son requeridos" });
      }
      if (looksLikeRut(rut) && !validarRutChileno(rut)) {
        return res.status(400).json({ message: "El RUT ingresado no es v\xE1lido. Verifique el d\xEDgito verificador." });
      }
      const existing = await storage.getUserByRut(rut);
      if (existing) {
        return res.status(409).json({ message: "El RUT ya est\xE1 registrado en el sistema" });
      }
      const defaultPwd = pwd || rut.replace(/[^0-9]/g, "").slice(0, 4) || "1234";
      const hashedPassword = await bcrypt2.hash(defaultPwd, 10);
      const user = await storage.createUser({
        rut,
        nombre,
        apellido,
        telefono: telefono || null,
        password: hashedPassword,
        role: role || "comensal",
        casinoId: casinoId || null,
        fechaNacimiento: fechaNacimiento || null,
        passwordChangeRequired: false
      });
      if (Array.isArray(casinoIds) && casinoIds.length > 0) {
        await storage.setUserCasinos(user.id, casinoIds);
      }
      const { password: _, ...userWithoutPassword } = user;
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Create user error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.put("/api/usuarios/:id", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, apellido, telefono, role, casinoId, casinoIds, fechaNacimiento, activo, password: newPwd, passwordChangeRequired } = req.body;
      const updateData = {};
      if (nombre !== void 0) updateData.nombre = nombre;
      if (apellido !== void 0) updateData.apellido = apellido;
      if (telefono !== void 0) updateData.telefono = telefono || null;
      if (role !== void 0) updateData.role = role;
      if (casinoId !== void 0) updateData.casinoId = casinoId || null;
      if (fechaNacimiento !== void 0) updateData.fechaNacimiento = fechaNacimiento || null;
      if (activo !== void 0) updateData.activo = activo;
      if (newPwd) {
        updateData.password = await bcrypt2.hash(newPwd, 10);
        updateData.passwordChangeRequired = passwordChangeRequired === void 0 ? false : !!passwordChangeRequired;
      } else if (passwordChangeRequired !== void 0) {
        updateData.passwordChangeRequired = !!passwordChangeRequired;
      }
      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      if (Array.isArray(casinoIds)) {
        await storage.setUserCasinos(id, casinoIds);
      }
      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/usuarios/:id/casinos", requireAdmin, async (req, res) => {
    try {
      const me = req.currentUser;
      if (me.role !== "admin" && me.id !== req.params.id) {
        return res.status(403).json({ message: "Acceso restringido" });
      }
      const ids = await storage.getUserCasinoIds(req.params.id);
      return res.json({ casinoIds: ids });
    } catch {
      return res.status(500).json({ message: "Error" });
    }
  });
  app2.delete("/api/usuarios/:id", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      return res.json({ message: "Usuario eliminado" });
    } catch (error) {
      console.error("Delete user error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/casinos", async (_req, res) => {
    try {
      const casinosList = await storage.getCasinos();
      return res.json(casinosList);
    } catch (error) {
      console.error("Get casinos error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/casinos/all", requireAdmin, async (_req, res) => {
    try {
      const casinosList = await storage.getAllCasinos();
      return res.json(casinosList);
    } catch (error) {
      console.error("Get all casinos error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/casinos", requireAdminOnly, async (req, res) => {
    try {
      const parsed = insertCasinoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Datos inv\xE1lidos" });
      }
      const casino = await storage.createCasino(parsed.data);
      return res.status(201).json(casino);
    } catch (error) {
      console.error("Create casino error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.put("/api/casinos/:id", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, direccion, activo, comensalesDiarios, permitirCambioClaveTotem } = req.body;
      const updateData = {};
      if (nombre !== void 0) updateData.nombre = nombre;
      if (direccion !== void 0) updateData.direccion = direccion;
      if (activo !== void 0) updateData.activo = activo;
      if (comensalesDiarios !== void 0) updateData.comensalesDiarios = parseInt(comensalesDiarios) || 0;
      if (permitirCambioClaveTotem !== void 0) updateData.permitirCambioClaveTotem = !!permitirCambioClaveTotem;
      const casino = await storage.updateCasino(id, updateData);
      if (!casino) {
        return res.status(404).json({ message: "Casino no encontrado" });
      }
      return res.json(casino);
    } catch (error) {
      console.error("Update casino error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/casinos/:id/has-history", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const casinoMinutas = await storage.getAllMinutasByCasino(id);
      const allUsers = await storage.getAllUsers();
      const usersInCasino = allUsers.filter((u) => u.casinoId === id);
      const hasHistory = casinoMinutas.length > 0 || usersInCasino.length > 0;
      return res.json({ hasHistory, minutas: casinoMinutas.length, usuarios: usersInCasino.length });
    } catch (error) {
      return res.status(500).json({ message: "Error al verificar historial" });
    }
  });
  app2.delete("/api/casinos/:id", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const force = req.query.force === "true";
      const casinoMinutas = await storage.getAllMinutasByCasino(id);
      const allUsers = await storage.getAllUsers();
      const usersInCasino = allUsers.filter((u) => u.casinoId === id);
      const hasHistory = casinoMinutas.length > 0 || usersInCasino.length > 0;
      if (hasHistory && !force) {
        const deleted = await storage.deleteCasino(id);
        if (!deleted) return res.status(404).json({ message: "Casino no encontrado" });
        return res.json({ message: "Casino desactivado (tiene historial asociado)", action: "deactivated" });
      }
      if (!hasHistory || force) {
        const result = await storage.hardDeleteCasino(id);
        if (!result) return res.status(404).json({ message: "Casino no encontrado" });
        return res.json({ message: "Casino eliminado permanentemente", action: "deleted" });
      }
      return res.json({ message: "Casino desactivado" });
    } catch (error) {
      console.error("Delete casino error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/dashboard/stats", requireAdmin, async (req, res) => {
    try {
      const me = req.currentUser;
      const accessible = await getAccessibleCasinoIds(me);
      const allCasinos = await storage.getCasinos();
      const activeCasinos = allCasinos.filter((c) => c.activo && (accessible === null || accessible.includes(c.id)));
      const allUsers = await storage.getAllUsers();
      const allPedidos = await storage.getAllPedidos();
      const allMinutas = await storage.getAllMinutas();
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const now = /* @__PURE__ */ new Date();
      const casinoStats = await Promise.all(activeCasinos.map(async (casino) => {
        const casinoUsers = allUsers.filter((u) => u.casinoId === casino.id && u.activo && u.role === "comensal");
        const totalComensales = casinoUsers.length;
        const esperados = casino.comensalesDiarios || totalComensales;
        const periodos4 = await storage.getPeriodosByCasino(casino.id);
        const activo = periodos4.find((p) => p.activo && new Date(p.fechaInicio) <= now && new Date(p.fechaFin) >= now);
        const winStart = activo?.fechaServicioInicio || activo?.fechaInicio?.toString().split("T")[0] || today;
        const winEnd = activo?.fechaServicioFin || activo?.fechaFin?.toString().split("T")[0] || today;
        const todayMinutas = allMinutas.filter((m) => m.casinoId === casino.id && m.fecha === today && m.activo);
        const todayIds = todayMinutas.map((m) => m.id);
        const inscritosHoy = new Set(allPedidos.filter((p) => todayIds.includes(p.minutaId) && p.tipo !== "no_asiste").map((p) => p.userId)).size;
        const periodoMinutas = allMinutas.filter((m) => m.casinoId === casino.id && m.fecha >= winStart && m.fecha <= winEnd && m.activo);
        const periodoIds = periodoMinutas.map((m) => m.id);
        const periodoPedidos = allPedidos.filter((p) => periodoIds.includes(p.minutaId));
        const inscritosPeriodo = new Set(periodoPedidos.filter((p) => p.tipo !== "no_asiste").map((p) => p.userId)).size;
        const noAsistePeriodo = periodoPedidos.filter((p) => p.tipo === "no_asiste").length;
        const visitasPeriodo = periodoPedidos.filter((p) => p.tipo === "visita").length;
        const fechas = [...new Set(periodoMinutas.map((m) => m.fecha))].sort();
        const dailyBreakdown = fechas.map((fecha) => {
          const dayIds = periodoMinutas.filter((m) => m.fecha === fecha).map((m) => m.id);
          const inscritos = new Set(allPedidos.filter((p) => dayIds.includes(p.minutaId) && p.tipo !== "no_asiste").map((p) => p.userId)).size;
          return { fecha, inscritos, esperados, porcentaje: esperados > 0 ? Math.round(inscritos / esperados * 100) : 0 };
        });
        const porcentajeHoy = esperados > 0 ? Math.round(inscritosHoy / esperados * 100) : 0;
        const porcentajePeriodo = esperados > 0 ? Math.round(inscritosPeriodo / (esperados * Math.max(1, fechas.length)) * 100) : 0;
        return {
          casinoId: casino.id,
          casinoNombre: casino.nombre,
          totalComensales,
          comensalesDiarios: esperados,
          inscritosHoy,
          porcentajeHoy,
          inscritosSemana: inscritosPeriodo,
          porcentajeSemana: porcentajePeriodo,
          inscritosPeriodo,
          noAsistePeriodo,
          visitasPeriodo,
          periodoActivo: !!activo,
          ventanaServicio: activo ? { inicio: winStart, fin: winEnd } : null,
          estado: porcentajeHoy >= 80 ? "bueno" : porcentajeHoy >= 50 ? "regular" : "bajo",
          dailyBreakdown
        };
      }));
      const totalEsperados = activeCasinos.reduce((sum, c) => sum + (c.comensalesDiarios || 0), 0);
      const totalInscritosHoy = casinoStats.reduce((sum, s) => sum + s.inscritosHoy, 0);
      const totalComensalesRegistrados = allUsers.filter((u) => u.role === "comensal" && u.activo && (accessible === null || u.casinoId && accessible.includes(u.casinoId))).length;
      return res.json({
        resumen: {
          totalCasinos: activeCasinos.length,
          totalComensalesRegistrados,
          totalEsperados,
          totalInscritosHoy,
          porcentajeGlobal: totalEsperados > 0 ? Math.round(totalInscritosHoy / totalEsperados * 100) : 0
        },
        casinos: casinoStats
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      return res.status(500).json({ message: "Error al obtener estad\xEDsticas" });
    }
  });
  app2.get("/api/minutas", requireAdmin, async (req, res) => {
    try {
      const me = req.currentUser;
      const accessible = await getAccessibleCasinoIds(me);
      const minutasList = await storage.getAllMinutas();
      const filtered = accessible === null ? minutasList : minutasList.filter((m) => accessible.includes(m.casinoId));
      return res.json(filtered);
    } catch (error) {
      console.error("Get all minutas error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/minutas/:casinoId", async (req, res) => {
    try {
      const { casinoId } = req.params;
      const isAdmin = !!req.session.userId;
      const all = req.query.all === "true";
      const minutasList = isAdmin && all ? await storage.getAllMinutasByCasino(casinoId) : await storage.getMinutasByCasino(casinoId);
      return res.json(minutasList);
    } catch (error) {
      console.error("Get minutas error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/minutas/batch-toggle", requireAdminOnly, async (req, res) => {
    try {
      const { ids, activo } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Debe enviar una lista de IDs" });
      }
      let updated = 0;
      for (const id of ids) {
        const result = await storage.updateMinuta(id, { activo });
        if (result) updated++;
      }
      return res.json({ message: `${updated} minutas ${activo ? "activadas" : "desactivadas"}`, updated });
    } catch (error) {
      console.error("Batch toggle minutas error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/minutas", requireAdminOnly, async (req, res) => {
    try {
      const { casinoIds, ...rest } = req.body;
      const targetIds = casinoIds && Array.isArray(casinoIds) && casinoIds.length > 0 ? casinoIds : rest.casinoId ? [rest.casinoId] : [];
      if (targetIds.length === 0) {
        return res.status(400).json({ message: "Debe seleccionar al menos un casino" });
      }
      const created = [];
      for (const cid of targetIds) {
        const data = { ...rest, casinoId: cid };
        const parsed = insertMinutaSchema.safeParse(data);
        if (!parsed.success) {
          return res.status(400).json({ message: "Datos inv\xE1lidos", errors: parsed.error.errors });
        }
        const minuta = await storage.createMinuta(parsed.data);
        created.push(minuta);
      }
      return res.status(201).json(created.length === 1 ? created[0] : created);
    } catch (error) {
      console.error("Create minuta error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.put("/api/minutas/:id", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const { casinoId, fecha, familia, opcion1, opcion2, opcion3, opcion4, opcion5, activo, replicateToCasinoIds } = req.body;
      const updateData = {};
      if (casinoId !== void 0) updateData.casinoId = casinoId;
      if (fecha !== void 0) updateData.fecha = fecha;
      if (familia !== void 0) updateData.familia = familia;
      if (opcion1 !== void 0) updateData.opcion1 = opcion1;
      if (opcion2 !== void 0) updateData.opcion2 = opcion2;
      if (opcion3 !== void 0) updateData.opcion3 = opcion3;
      if (opcion4 !== void 0) updateData.opcion4 = opcion4;
      if (opcion5 !== void 0) updateData.opcion5 = opcion5;
      if (activo !== void 0) updateData.activo = activo;
      const minuta = await storage.updateMinuta(id, updateData);
      if (!minuta) {
        return res.status(404).json({ message: "Minuta no encontrada" });
      }
      if (Array.isArray(replicateToCasinoIds) && replicateToCasinoIds.length > 0) {
        const targetFecha = fecha !== void 0 ? fecha : minuta.fecha;
        for (const cid of replicateToCasinoIds) {
          if (!cid || cid === minuta.casinoId) continue;
          const existing = await storage.getMinutasByCasino(cid);
          const match = existing.find((m) => m.fecha === targetFecha);
          const payload = {
            familia: minuta.familia,
            opcion1: minuta.opcion1,
            opcion2: minuta.opcion2,
            opcion3: minuta.opcion3,
            opcion4: minuta.opcion4,
            opcion5: minuta.opcion5,
            activo: minuta.activo
          };
          if (match) {
            await storage.updateMinuta(match.id, payload);
          } else {
            await storage.createMinuta({
              casinoId: cid,
              fecha: targetFecha,
              ...payload
            });
          }
        }
      }
      return res.json(minuta);
    } catch (error) {
      console.error("Update minuta error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.delete("/api/minutas/:id", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteMinuta(id);
      if (!deleted) {
        return res.status(404).json({ message: "Minuta no encontrada" });
      }
      return res.json({ message: "Minuta desactivada" });
    } catch (error) {
      console.error("Delete minuta error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/minutas/:id/clonar", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const { fecha, casinoIds } = req.body;
      const original = await storage.getMinuta(id);
      if (!original) {
        return res.status(404).json({ message: "Minuta original no encontrada" });
      }
      const targetDate = fecha || original.fecha;
      const targetCasinos = casinoIds && Array.isArray(casinoIds) && casinoIds.length > 0 ? casinoIds : [original.casinoId];
      const created = [];
      for (const cid of targetCasinos) {
        const cloneData = {
          casinoId: cid,
          fecha: targetDate,
          familia: original.familia,
          opcion1: original.opcion1,
          opcion2: original.opcion2,
          opcion3: original.opcion3,
          opcion4: original.opcion4,
          opcion5: original.opcion5
        };
        const minuta = await storage.createMinuta(cloneData);
        created.push(minuta);
      }
      return res.status(201).json(created.length === 1 ? created[0] : created);
    } catch (error) {
      console.error("Clone minuta error:", error);
      return res.status(500).json({ message: "Error al clonar minuta" });
    }
  });
  app2.get("/api/familias", async (req, res) => {
    try {
      const allFamilias = await storage.getAllFamilias();
      return res.json(allFamilias);
    } catch (error) {
      console.error("Get familias error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/familias", requireAdminOnly, async (req, res) => {
    try {
      const { nombre, color } = req.body;
      if (!nombre) return res.status(400).json({ message: "El nombre es obligatorio" });
      const familia = await storage.createFamilia({ nombre, color: color || "#D4A843" });
      return res.status(201).json(familia);
    } catch (error) {
      if (error.code === "23505") return res.status(409).json({ message: "Ya existe una familia con ese nombre" });
      console.error("Create familia error:", error);
      return res.status(500).json({ message: "Error al crear familia" });
    }
  });
  app2.put("/api/familias/:id", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, color, activo } = req.body;
      const updateData = {};
      if (nombre !== void 0) updateData.nombre = nombre;
      if (color !== void 0) updateData.color = color;
      if (activo !== void 0) updateData.activo = activo;
      const familia = await storage.updateFamilia(id, updateData);
      if (!familia) return res.status(404).json({ message: "Familia no encontrada" });
      return res.json(familia);
    } catch (error) {
      console.error("Update familia error:", error);
      return res.status(500).json({ message: "Error al actualizar familia" });
    }
  });
  app2.delete("/api/familias/:id", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteFamilia(id);
      if (!deleted) return res.status(404).json({ message: "Familia no encontrada" });
      return res.json({ message: "Familia desactivada" });
    } catch (error) {
      console.error("Delete familia error:", error);
      return res.status(500).json({ message: "Error al eliminar familia" });
    }
  });
  app2.get("/api/periodos", requireAdmin, async (req, res) => {
    try {
      const allPeriodos = await storage.getAllPeriodos();
      return res.json(allPeriodos);
    } catch (error) {
      console.error("Get periodos error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/periodos/casino/:casinoId", async (req, res) => {
    try {
      const { casinoId } = req.params;
      const periodosList = await storage.getPeriodosByCasino(casinoId);
      return res.json(periodosList);
    } catch (error) {
      console.error("Get periodos by casino error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/periodos", requireAdminOnly, async (req, res) => {
    try {
      const { casinoId, nombre, fechaInicio, fechaFin, fechaServicioInicio, fechaServicioFin } = req.body;
      if (!casinoId || !nombre || !fechaInicio || !fechaFin) {
        return res.status(400).json({ message: "Todos los campos son obligatorios" });
      }
      if (new Date(fechaFin) <= new Date(fechaInicio)) {
        return res.status(400).json({ message: "La fecha/hora de fin debe ser posterior a la de inicio" });
      }
      if (fechaServicioInicio && fechaServicioFin) {
        if (fechaServicioFin < fechaServicioInicio) {
          return res.status(400).json({ message: "La fecha de fin de servicio debe ser posterior a la de inicio" });
        }
        const insStart = new Date(fechaInicio).toISOString().split("T")[0];
        const insEnd = new Date(fechaFin).toISOString().split("T")[0];
        if (fechaServicioInicio < insStart || fechaServicioFin < insEnd) {
          return res.status(400).json({ message: "La ventana de servicio debe ser posterior o igual a la ventana de inscripci\xF3n" });
        }
      }
      const periodo = await storage.createPeriodo({
        casinoId,
        nombre,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        fechaServicioInicio: fechaServicioInicio || null,
        fechaServicioFin: fechaServicioFin || null
      });
      return res.status(201).json(periodo);
    } catch (error) {
      console.error("Create periodo error:", error);
      return res.status(500).json({ message: "Error al crear periodo" });
    }
  });
  app2.put("/api/periodos/:id", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, fechaInicio, fechaFin, fechaServicioInicio, fechaServicioFin, activo } = req.body;
      const updateData = {};
      if (nombre !== void 0) updateData.nombre = nombre;
      if (fechaInicio !== void 0) updateData.fechaInicio = new Date(fechaInicio);
      if (fechaFin !== void 0) updateData.fechaFin = new Date(fechaFin);
      if (fechaServicioInicio !== void 0) updateData.fechaServicioInicio = fechaServicioInicio || null;
      if (fechaServicioFin !== void 0) updateData.fechaServicioFin = fechaServicioFin || null;
      if (activo !== void 0) updateData.activo = activo;
      if (updateData.fechaInicio && updateData.fechaFin && new Date(updateData.fechaFin) <= new Date(updateData.fechaInicio)) {
        return res.status(400).json({ message: "La fecha/hora de fin debe ser posterior a la de inicio" });
      }
      if (updateData.fechaServicioInicio && updateData.fechaServicioFin) {
        if (updateData.fechaServicioFin < updateData.fechaServicioInicio) {
          return res.status(400).json({ message: "La fecha de fin de servicio debe ser posterior a la de inicio" });
        }
        const fi = updateData.fechaInicio || (await storage.getPeriodo(id))?.fechaInicio;
        const ff = updateData.fechaFin || (await storage.getPeriodo(id))?.fechaFin;
        if (fi && ff) {
          const insStart = new Date(fi).toISOString().split("T")[0];
          const insEnd = new Date(ff).toISOString().split("T")[0];
          if (updateData.fechaServicioInicio < insStart || updateData.fechaServicioFin < insEnd) {
            return res.status(400).json({ message: "La ventana de servicio debe ser posterior o igual a la ventana de inscripci\xF3n" });
          }
        }
      }
      const periodo = await storage.updatePeriodo(id, updateData);
      if (!periodo) return res.status(404).json({ message: "Periodo no encontrado" });
      return res.json(periodo);
    } catch (error) {
      console.error("Update periodo error:", error);
      return res.status(500).json({ message: "Error al actualizar periodo" });
    }
  });
  app2.delete("/api/periodos/:id", requireAdminOnly, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deletePeriodo(id);
      if (!deleted) return res.status(404).json({ message: "Periodo no encontrado" });
      return res.json({ message: "Periodo desactivado" });
    } catch (error) {
      console.error("Delete periodo error:", error);
      return res.status(500).json({ message: "Error al eliminar periodo" });
    }
  });
  app2.get("/api/pedidos/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const pedidosList = await storage.getPedidosByUser(userId);
      return res.json(pedidosList);
    } catch (error) {
      console.error("Get pedidos error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/pedidos/:id/marcar-impreso", async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "No autenticado" });
      const { id } = req.params;
      const pedido = await storage.getPedidoById(id);
      if (!pedido) return res.status(404).json({ message: "Pedido no encontrado" });
      const requester = await storage.getUser(userId);
      if (!requester) return res.status(401).json({ message: "Usuario no encontrado" });
      const isOwner = pedido.userId === requester.id;
      const isStaff = ["admin", "interlocutor", "encargado_casino"].includes(requester.role);
      if (!isOwner && !isStaff) return res.status(403).json({ message: "Sin permisos" });
      if (!isOwner && isStaff) {
        const accessible = await getAccessibleCasinoIds(requester);
        if (accessible !== null) {
          const minuta = await storage.getMinuta(pedido.minutaId);
          if (!minuta || !accessible.includes(minuta.casinoId)) {
            return res.status(403).json({ message: "Sin acceso a este casino" });
          }
        }
      }
      const updated = await storage.markPedidoImpreso(id);
      if (!updated) return res.status(404).json({ message: "Pedido no encontrado" });
      return res.json({ ok: true, impresoEn: updated.impresoEn });
    } catch (error) {
      console.error("Mark impreso error:", error);
      return res.status(500).json({ message: "Error al marcar impreso" });
    }
  });
  app2.delete("/api/pedidos/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const pedido = await storage.getPedidoById(id);
      if (!pedido) return res.status(404).json({ message: "Pedido no encontrado" });
      if (pedido.deletedAt) return res.status(410).json({ message: "Pedido ya estaba anulado" });
      const me = req.currentUser;
      if (me?.role === "interlocutor") {
        const minuta = await storage.getMinuta(pedido.minutaId);
        if (!minuta || minuta.casinoId !== me.casinoId) {
          return res.status(403).json({ message: "Sin acceso a este casino" });
        }
      }
      const ok = await storage.deletePedido(id);
      if (!ok) return res.status(500).json({ message: "No se pudo anular el pedido" });
      console.log(`[audit] Pedido ${id} anulado por ${me?.rut || "?"} (${me?.role}) \u2014 comensal=${pedido.userId} minuta=${pedido.minutaId} tipo=${pedido.tipo}`);
      return res.json({ ok: true, message: "Pedido anulado. El comensal puede inscribirse nuevamente." });
    } catch (error) {
      console.error("Delete pedido error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/historial/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const sessionUserId = req.session.userId;
      if (!sessionUserId) return res.status(401).json({ message: "No autenticado" });
      const pedidosList = await storage.getPedidosByUser(userId);
      const allMinutas = await storage.getAllMinutas();
      const minutaMap = {};
      for (const m of allMinutas) minutaMap[m.id] = m;
      const enriched = pedidosList.map((p) => {
        const m = minutaMap[p.minutaId];
        const opts = {};
        if (m) {
          opts[1] = m.opcion1;
          opts[2] = m.opcion2;
          opts[3] = m.opcion3;
          if (m.opcion4) opts[4] = m.opcion4;
          if (m.opcion5) opts[5] = m.opcion5;
        }
        return {
          ...p,
          fecha: m?.fecha ?? null,
          familia: m?.familia ?? null,
          opcionTexto: p.opcionSeleccionada > 0 ? opts[p.opcionSeleccionada] ?? null : null
        };
      });
      enriched.sort((a, b) => {
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });
      return res.json(enriched);
    } catch (error) {
      console.error("Historial error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/pedidos", async (req, res) => {
    try {
      const parsed = insertPedidoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Datos inv\xE1lidos" });
      }
      const user = await storage.getUser(parsed.data.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      const minuta = await storage.getMinuta(parsed.data.minutaId);
      if (!minuta) {
        return res.status(404).json({ message: "Minuta no encontrada" });
      }
      const sessionUserId = req.session.userId;
      const actor = sessionUserId ? await storage.getUser(sessionUserId) : null;
      const isStaff = !!actor && (actor.role === "admin" || actor.role === "interlocutor" || actor.role === "encargado_casino");
      if (!isStaff && (!actor || actor.id !== parsed.data.userId)) {
        return res.status(403).json({ message: "Solo puedes registrar tu propio pedido" });
      }
      if (!isStaff) {
        const casinoPeriodos = await storage.getPeriodosByCasino(minuta.casinoId);
        const now = /* @__PURE__ */ new Date();
        const activePeriodos = casinoPeriodos.filter((p) => p.activo && new Date(p.fechaInicio) <= now && new Date(p.fechaFin) >= now);
        if (casinoPeriodos.filter((p) => p.activo).length > 0 && activePeriodos.length === 0) {
          return res.status(403).json({ message: "La inscripci\xF3n no est\xE1 disponible en este momento. Fuera del horario de inscripci\xF3n." });
        }
      }
      const tipo = req.body.tipo || "seleccion";
      const nombreVisita = req.body.nombreVisita || null;
      if (tipo === "visita" && user.role !== "interlocutor" && user.role !== "admin" && user.role !== "encargado_casino") {
        return res.status(403).json({ message: "Solo staff puede emitir vales de visita" });
      }
      let opcionFinal = parsed.data.opcionSeleccionada;
      if (tipo === "no_asiste") {
        opcionFinal = 0;
      } else if ((user.role === "interlocutor" || user.role === "encargado_casino") && tipo !== "visita") {
        opcionFinal = 1;
      }
      if (user.role === "comensal" && tipo === "seleccion") {
        const existing = await storage.getPedidoByUserAndMinuta(parsed.data.userId, parsed.data.minutaId);
        if (existing) {
          return res.status(409).json({ message: "Ya tienes un pedido registrado para esta fecha. Solo puedes emitir 1 vale por comida." });
        }
      }
      const codigoQr = tipo === "no_asiste" ? null : `VASCAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const pedido = await storage.createPedido({
        userId: parsed.data.userId,
        minutaId: parsed.data.minutaId,
        opcionSeleccionada: opcionFinal,
        codigoQr,
        tipo,
        nombreVisita
      });
      return res.status(201).json(pedido);
    } catch (error) {
      console.error("Create pedido error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.post("/api/pedidos/auto-totem", async (req, res) => {
    try {
      const sessionUserId = req.session.userId;
      if (!sessionUserId) return res.status(401).json({ message: "No autenticado" });
      const { userId, minutaId, fecha: clientFecha } = req.body || {};
      if (!userId || !minutaId) return res.status(400).json({ message: "userId y minutaId requeridos" });
      if (userId !== sessionUserId) return res.status(403).json({ message: "Solo puedes emitir tu propio vale" });
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
      const minuta = await storage.getMinuta(minutaId);
      if (!minuta) return res.status(404).json({ message: "Minuta no encontrada" });
      const staffRoles = ["admin", "interlocutor", "encargado_casino"];
      if (!staffRoles.includes(user.role)) {
        const accessible = await getAccessibleCasinoIds(user);
        if (accessible !== null && !accessible.includes(minuta.casinoId)) {
          return res.status(403).json({ message: "Esta minuta no pertenece a tu casino" });
        }
      }
      const checkFecha = clientFecha || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      if (minuta.fecha !== checkFecha) {
        return res.status(403).json({ message: "Solo se puede emitir vale para el men\xFA de hoy" });
      }
      if (!minuta.activo) {
        return res.status(403).json({ message: "Minuta inactiva" });
      }
      const existing = await storage.getPedidoByUserAndMinuta(userId, minutaId);
      if (existing && existing.opcionSeleccionada > 0) {
        if (!existing.impresoEn) {
          const marked2 = await storage.markPedidoImpreso(existing.id);
          return res.json({ ...marked2 || existing, action: "marked_existing" });
        }
        return res.json({ ...existing, action: "already_printed" });
      }
      if (existing && existing.opcionSeleccionada === 0) {
        const codigoQr2 = `VASCAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const updated = await storage.updatePedido(existing.id, {
          opcionSeleccionada: 1,
          codigoQr: codigoQr2,
          tipo: "seleccion"
        });
        const marked2 = updated ? await storage.markPedidoImpreso(updated.id) : null;
        return res.json({ ...marked2 || updated || existing, action: "created" });
      }
      const codigoQr = `VASCAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const pedido = await storage.createPedido({
        userId,
        minutaId,
        opcionSeleccionada: 1,
        codigoQr,
        tipo: "seleccion"
      });
      const marked = await storage.markPedidoImpreso(pedido.id);
      return res.status(201).json({ ...marked || pedido, action: "created" });
    } catch (error) {
      console.error("auto-totem error:", error);
      return res.status(500).json({ message: "Error al emitir vale" });
    }
  });
  app2.get("/api/periodo-activo/:casinoId", async (req, res) => {
    try {
      const { casinoId } = req.params;
      const periodosList = await storage.getPeriodosByCasino(casinoId);
      const now = /* @__PURE__ */ new Date();
      const activo = periodosList.find((p) => p.activo && new Date(p.fechaInicio) <= now && new Date(p.fechaFin) >= now);
      return res.json({
        activo: !!activo,
        periodo: activo || null,
        fechaServicioInicio: activo?.fechaServicioInicio || null,
        fechaServicioFin: activo?.fechaServicioFin || null
      });
    } catch (error) {
      return res.status(500).json({ message: "Error al verificar periodo" });
    }
  });
  app2.get("/api/minutas-disponibles/:casinoId", async (req, res) => {
    try {
      const { casinoId } = req.params;
      const periodosList = await storage.getPeriodosByCasino(casinoId);
      const now = /* @__PURE__ */ new Date();
      const activo = periodosList.find((p) => p.activo && new Date(p.fechaInicio) <= now && new Date(p.fechaFin) >= now);
      if (!activo) {
        return res.json({ minutas: [], periodo: null });
      }
      const all = await storage.getMinutasByCasino(casinoId);
      let filtered = [];
      if (activo.fechaServicioInicio && activo.fechaServicioFin) {
        filtered = all.filter((m) => m.fecha >= activo.fechaServicioInicio && m.fecha <= activo.fechaServicioFin);
      } else {
        const fi = activo.fechaInicio.toString().split("T")[0];
        const ff = activo.fechaFin.toString().split("T")[0];
        filtered = all.filter((m) => m.fecha >= fi && m.fecha <= ff);
      }
      return res.json({
        minutas: filtered.sort((a, b) => a.fecha.localeCompare(b.fecha)),
        periodo: activo
      });
    } catch (error) {
      console.error("minutas-disponibles error:", error);
      return res.status(500).json({ message: "Error al obtener minutas disponibles" });
    }
  });
  app2.get("/api/pedidos/buscar/por-rut", requireAdmin, async (req, res) => {
    try {
      const rut = (req.query.rut || "").replace(/[^0-9kK]/g, "").toUpperCase();
      const fecha = req.query.fecha || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      if (!rut) return res.status(400).json({ message: "RUT requerido" });
      const allUsers = await storage.getAllUsers();
      const norm = (s) => s.replace(/[^0-9kK]/g, "").toUpperCase();
      const target = allUsers.find((u) => norm(u.rut) === rut);
      if (!target) return res.json({ user: null, pedidos: [], minutas: [] });
      const pedidos4 = await storage.getPedidosByUser(target.id);
      const allMinutas = await storage.getAllMinutas();
      const minutasByDate = allMinutas.filter((m) => m.fecha === fecha);
      const minutaIds = new Set(minutasByDate.map((m) => m.id));
      const pedidosDia = pedidos4.filter((p) => minutaIds.has(p.minutaId));
      return res.json({
        user: { id: target.id, rut: target.rut, nombre: target.nombre, apellido: target.apellido },
        pedidos: pedidosDia,
        minutas: minutasByDate
      });
    } catch (error) {
      console.error("buscar pedidos por rut:", error);
      return res.status(500).json({ message: "Error" });
    }
  });
  app2.get("/api/reportes/resumen-dia/:casinoId", requireAdmin, async (req, res) => {
    try {
      const { casinoId } = req.params;
      const fecha = req.query.fecha || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const minutas4 = await storage.getAllMinutasByCasino(casinoId);
      const dayMinutas = minutas4.filter((m) => m.fecha === fecha && m.activo);
      const casinoPeriodos = await storage.getPeriodosByCasino(casinoId);
      const fechaDate = /* @__PURE__ */ new Date(fecha + "T12:00:00Z");
      const activePeriodo = casinoPeriodos.find(
        (p) => p.activo && new Date(p.fechaInicio) <= fechaDate && new Date(p.fechaFin) >= fechaDate
      ) || null;
      const periodoOut = activePeriodo ? { fechaInicio: activePeriodo.fechaInicio.toISOString(), fechaFin: activePeriodo.fechaFin.toISOString() } : null;
      if (dayMinutas.length === 0) {
        return res.json({ fecha, casinoId, periodo: periodoOut, minuta: null, opciones: [], totalSeleccion: 0, totalNoAsiste: 0, totalVisitas: 0 });
      }
      const pedidosByMinuta = await Promise.all(dayMinutas.map((m) => storage.getPedidosByMinuta(m.id)));
      const allPedidos = pedidosByMinuta.flat();
      const sel = allPedidos.filter((p) => p.tipo !== "no_asiste" && p.tipo !== "visita");
      const noAsiste = allPedidos.filter((p) => p.tipo === "no_asiste").length;
      const visitas = allPedidos.filter((p) => p.tipo === "visita").length;
      const opcionesMap = /* @__PURE__ */ new Map();
      for (let mi = 0; mi < dayMinutas.length; mi++) {
        const m = dayMinutas[mi];
        const pedidosOfM = pedidosByMinuta[mi].filter((p) => p.tipo !== "no_asiste" && p.tipo !== "visita");
        const opts = [m.opcion1, m.opcion2, m.opcion3, m.opcion4, m.opcion5];
        for (let i = 0; i < opts.length; i++) {
          const d = opts[i];
          if (!d) continue;
          const numero = i + 1;
          const key = `${m.familia || "\u2014"}|${numero}|${d}`;
          const prev = opcionesMap.get(key);
          const cantidad = pedidosOfM.filter((p) => p.opcionSeleccionada === numero).length;
          if (prev) {
            prev.cantidad += cantidad;
          } else {
            opcionesMap.set(key, { familia: m.familia ?? null, numero, descripcion: d, cantidad });
          }
        }
      }
      const opciones = Array.from(opcionesMap.values()).sort((a, b) => {
        const fa = a.familia || "";
        const fb = b.familia || "";
        if (fa !== fb) return fa.localeCompare(fb);
        return a.numero - b.numero;
      });
      return res.json({
        fecha,
        casinoId,
        periodo: periodoOut,
        minuta: { id: dayMinutas[0].id, familia: dayMinutas.map((m) => m.familia).filter(Boolean).join(" + ") || null },
        opciones,
        totalSeleccion: sel.length,
        totalNoAsiste: noAsiste,
        totalVisitas: visitas
      });
    } catch (error) {
      console.error("Resumen dia error:", error);
      return res.status(500).json({ message: "Error al obtener resumen" });
    }
  });
  app2.post("/api/pedidos/semanal", async (req, res) => {
    try {
      const sessionUserId = req.session.userId;
      if (!sessionUserId) return res.status(401).json({ message: "No autenticado" });
      const sessionUser = await storage.getUser(sessionUserId);
      if (!sessionUser) return res.status(401).json({ message: "Usuario no encontrado" });
      const { selecciones } = req.body;
      let { userId } = req.body;
      if (!userId || userId === sessionUserId) {
        userId = sessionUserId;
      } else if (sessionUser.role === "comensal") {
        return res.status(403).json({ message: "No puede inscribir a otro usuario" });
      }
      if (!selecciones || !Array.isArray(selecciones)) {
        return res.status(400).json({ message: "selecciones son requeridas" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
      const userAccessible = await getAccessibleCasinoIds(user);
      const userCasinos = userAccessible === null ? null : new Set(userAccessible);
      const actorAccessible = userId === sessionUserId ? null : await getAccessibleCasinoIds(sessionUser);
      const actorCasinos = actorAccessible === null ? null : new Set(actorAccessible);
      const now = /* @__PURE__ */ new Date();
      const periodosCache = /* @__PURE__ */ new Map();
      const results = [];
      const skipped = [];
      for (const sel of selecciones) {
        const { minutaId, opcionSeleccionada, tipo } = sel;
        if (!minutaId) continue;
        const minuta = await storage.getMinuta(minutaId);
        if (!minuta) {
          skipped.push({ minutaId, reason: "minuta no encontrada" });
          continue;
        }
        if (userCasinos !== null && !userCasinos.has(minuta.casinoId)) {
          skipped.push({ minutaId, reason: "usuario sin acceso a este casino" });
          continue;
        }
        if (actorCasinos !== null && !actorCasinos.has(minuta.casinoId)) {
          skipped.push({ minutaId, reason: "sin permiso para inscribir en este casino" });
          continue;
        }
        let periodos4 = periodosCache.get(minuta.casinoId);
        if (!periodos4) {
          periodos4 = await storage.getPeriodosByCasino(minuta.casinoId);
          periodosCache.set(minuta.casinoId, periodos4);
        }
        const periodoActivo = periodos4.find((p) => p.activo && new Date(p.fechaInicio) <= now && new Date(p.fechaFin) >= now);
        if (!periodoActivo) {
          skipped.push({ minutaId, reason: "fuera de horario de inscripci\xF3n" });
          continue;
        }
        const svcStart = periodoActivo.fechaServicioInicio || new Date(periodoActivo.fechaInicio).toISOString().split("T")[0];
        const svcEnd = periodoActivo.fechaServicioFin || new Date(periodoActivo.fechaFin).toISOString().split("T")[0];
        if (minuta.fecha < svcStart || minuta.fecha > svcEnd) {
          skipped.push({ minutaId, reason: "fuera de la ventana de servicio del periodo" });
          continue;
        }
        const existing = await storage.getPedidoByUserAndMinuta(userId, minutaId);
        let opcion = opcionSeleccionada || 1;
        const selTipo = tipo || "seleccion";
        if (selTipo === "no_asiste") opcion = 0;
        if (existing) {
          const updated = await storage.updatePedido(existing.id, {
            opcionSeleccionada: opcion,
            tipo: selTipo,
            codigoQr: selTipo === "no_asiste" ? null : existing.codigoQr || `VASCAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          });
          if (updated) results.push(updated);
          continue;
        }
        const codigoQr = selTipo === "no_asiste" ? null : `VASCAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const pedido = await storage.createPedido({
          userId,
          minutaId,
          opcionSeleccionada: opcion,
          codigoQr,
          tipo: selTipo
        });
        results.push(pedido);
      }
      return res.status(201).json({ results, skipped });
    } catch (error) {
      console.error("Create pedidos semanales error:", error);
      return res.status(500).json({ message: "Error al registrar selecciones semanales" });
    }
  });
  app2.post("/api/pedidos/visita", async (req, res) => {
    try {
      const sessionUserId = req.session.userId;
      if (!sessionUserId) return res.status(401).json({ message: "No autenticado" });
      const actor = await storage.getUser(sessionUserId);
      if (!actor) return res.status(401).json({ message: "Usuario no encontrado" });
      if (actor.role !== "interlocutor" && actor.role !== "admin" && actor.role !== "encargado_casino") {
        return res.status(403).json({ message: "Solo staff puede emitir vales de visita" });
      }
      const { minutaId } = req.body;
      const nombreVisita = req.body?.nombreVisita && String(req.body.nombreVisita).trim() || "Visita";
      if (!minutaId) {
        return res.status(400).json({ message: "minutaId requerido" });
      }
      const minuta = await storage.getMinuta(minutaId);
      if (!minuta) return res.status(404).json({ message: "Minuta no encontrada" });
      const accessible = await getAccessibleCasinoIds(actor);
      if (accessible !== null && !accessible.includes(minuta.casinoId)) {
        return res.status(403).json({ message: "Sin acceso al casino de esta minuta" });
      }
      const codigoQr = `VASCAN-VISITA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const pedido = await storage.createPedido({
        userId: actor.id,
        minutaId,
        opcionSeleccionada: 1,
        codigoQr,
        tipo: "visita",
        nombreVisita
      });
      return res.status(201).json(pedido);
    } catch (error) {
      console.error("Create vale visita error:", error);
      return res.status(500).json({ message: "Error al crear vale de visita" });
    }
  });
  app2.post("/api/reportes/diario", requireAdminOnly, async (req, res) => {
    try {
      const fecha = req.body?.fecha || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const entries = await generateDailyReport(fecha);
      console.log(`[reporte manual] Generado para ${fecha}:`, JSON.stringify(entries, null, 2));
      return res.json({ fecha, casinos: entries });
    } catch (error) {
      console.error("Error reporte diario manual:", error);
      return res.status(500).json({ message: "Error al generar reporte diario" });
    }
  });
  app2.get("/api/reportes/dashboard", requireAdminOnly, async (req, res) => {
    try {
      const allPedidos = await db.select().from(pedidos);
      const totalInscripciones = allPedidos.filter((p) => p.tipo === "seleccion" || !p.tipo).length;
      const totalNoAsiste = allPedidos.filter((p) => p.tipo === "no_asiste").length;
      const totalVisitas = allPedidos.filter((p) => p.tipo === "visita").length;
      return res.json({ totalInscripciones, totalNoAsiste, totalVisitas });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      return res.status(500).json({ message: "Error al obtener estad\xEDsticas" });
    }
  });
  app2.get("/api/reportes/consolidacion", requireAdmin, async (req, res) => {
    try {
      const { casinoId, fecha, fechaHasta } = req.query;
      if (!casinoId || !fecha) {
        return res.status(400).json({ message: "casinoId y fecha son requeridos" });
      }
      if (!await assertCasinoAccess(req, res, casinoId)) return;
      const isAllCasinos = casinoId === "all";
      const hasRange = !!(fechaHasta && fechaHasta !== fecha);
      const fechasToProcess = [];
      if (hasRange) {
        const start = /* @__PURE__ */ new Date(fecha + "T12:00:00");
        const end = /* @__PURE__ */ new Date(fechaHasta + "T12:00:00");
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          fechasToProcess.push(d.toISOString().split("T")[0]);
        }
      } else {
        fechasToProcess.push(fecha);
      }
      const casinosList = isAllCasinos ? await storage.getCasinos() : [await storage.getCasino(casinoId)].filter(Boolean);
      if (!isAllCasinos && casinosList.length === 0) {
        return res.status(404).json({ message: "Casino no encontrado" });
      }
      const opcionMap = {};
      let totalPedidos = 0;
      let totalNoAsiste = 0;
      let totalVisitas = 0;
      let totalAnulados = 0;
      const visitasList = [];
      const dailyRows = [];
      for (const casino of casinosList) {
        const allMinutasCasino = await storage.getAllMinutasByCasino(casino.id);
        for (const f of fechasToProcess) {
          const minuta = allMinutasCasino.find((m) => m.fecha === f);
          if (!minuta) continue;
          const [pedidosForMinuta, anuladosForMinuta] = await Promise.all([
            storage.getPedidosByMinuta(minuta.id),
            storage.getAnuladosByMinuta(minuta.id)
          ]);
          const selPedidos = pedidosForMinuta.filter((p) => p.tipo !== "no_asiste" && p.tipo !== "visita");
          const noAsPedidos = pedidosForMinuta.filter((p) => p.tipo === "no_asiste");
          const visPedidos = pedidosForMinuta.filter((p) => p.tipo === "visita");
          totalPedidos += selPedidos.length;
          totalNoAsiste += noAsPedidos.length;
          totalVisitas += visPedidos.length;
          totalAnulados += anuladosForMinuta.length;
          visPedidos.forEach((v) => visitasList.push({ nombreVisita: v.nombreVisita || null, codigoQr: v.codigoQr || null }));
          dailyRows.push({ fecha: f, casinoNombre: casino.nombre, total: selPedidos.length, noAsiste: noAsPedidos.length, anulados: anuladosForMinuta.length });
          const allOptions = [minuta.opcion1, minuta.opcion2, minuta.opcion3, minuta.opcion4, minuta.opcion5];
          for (let i = 0; i < allOptions.length; i++) {
            if (!allOptions[i]) continue;
            const num = i + 1;
            if (!opcionMap[num]) opcionMap[num] = { descripcion: allOptions[i], cantidad: 0 };
            opcionMap[num].cantidad += selPedidos.filter((p) => p.opcionSeleccionada === num).length;
          }
        }
      }
      const opciones = Object.entries(opcionMap).map(([num, v]) => ({
        numero: parseInt(num),
        descripcion: v.descripcion,
        cantidad: v.cantidad,
        porcentaje: totalPedidos > 0 ? Math.round(v.cantidad / totalPedidos * 100) : 0
      }));
      return res.json({
        casinoNombre: isAllCasinos ? "Todos los casinos" : casinosList[0]?.nombre,
        fecha,
        fechaHasta: fechaHasta || null,
        minuta: opciones.length > 0 ? { resumen: true } : null,
        opciones,
        totalPedidos,
        totalNoAsiste,
        totalVisitas,
        totalAnulados,
        visitas: visitasList,
        dailyRows: hasRange ? dailyRows : void 0
      });
    } catch (error) {
      console.error("Consolidacion error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  app2.get("/api/reportes/consolidacion-semanal", requireAdmin, async (req, res) => {
    try {
      const { casinoId, fecha } = req.query;
      if (!casinoId || !fecha) return res.status(400).json({ message: "casinoId y fecha requeridos" });
      if (!await assertCasinoAccess(req, res, casinoId)) return;
      const casino = await storage.getCasino(casinoId);
      if (!casino) return res.status(404).json({ message: "Casino no encontrado" });
      const d = /* @__PURE__ */ new Date(fecha + "T12:00:00");
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setDate(d.getDate() + mondayOffset);
      const weekDates = [];
      for (let i = 0; i < 5; i++) {
        const dd = new Date(monday);
        dd.setDate(monday.getDate() + i);
        weekDates.push(dd.toISOString().split("T")[0]);
      }
      const allMinutas = await storage.getAllMinutasByCasino(casinoId);
      const weekMinutas = weekDates.map((f) => allMinutas.find((m) => m.fecha === f) || null);
      const allUsers = await storage.getAllUsers();
      const casinoUsers = allUsers.filter((u) => u.casinoId === casinoId && u.role === "comensal" && u.activo);
      const allPedidos = await storage.getAllPedidos();
      const weekMinutaIds = weekMinutas.filter(Boolean).map((m) => m.id);
      const weekPedidos = allPedidos.filter((p) => weekMinutaIds.includes(p.minutaId));
      const dayNames = ["Lun", "Mar", "Mi\xE9", "Jue", "Vie"];
      const dias = weekDates.map((fecha2, i) => {
        const minuta = weekMinutas[i];
        if (!minuta) return { fecha: fecha2, dia: dayNames[i], opciones: [], total: 0, noAsiste: 0, noInscritos: casinoUsers.length };
        const pedidos4 = weekPedidos.filter((p) => p.minutaId === minuta.id);
        const seleccion = pedidos4.filter((p) => p.tipo !== "no_asiste" && p.tipo !== "visita");
        const noAsiste = pedidos4.filter((p) => p.tipo === "no_asiste").length;
        const inscritosIds = new Set(pedidos4.map((p) => p.userId));
        const noInscritos = casinoUsers.filter((u) => !inscritosIds.has(u.id)).length;
        const allOpts = [minuta.opcion1, minuta.opcion2, minuta.opcion3, minuta.opcion4, minuta.opcion5];
        const opciones = allOpts.filter(Boolean).map((desc, idx) => ({
          numero: idx + 1,
          descripcion: desc,
          cantidad: seleccion.filter((p) => p.opcionSeleccionada === idx + 1).length
        }));
        return { fecha: fecha2, dia: dayNames[i], opciones, total: seleccion.length, noAsiste, noInscritos };
      });
      return res.json({
        casinoNombre: casino.nombre,
        weekStart: weekDates[0],
        weekEnd: weekDates[4],
        totalComensales: casinoUsers.length,
        dias
      });
    } catch (error) {
      console.error("Consolidacion semanal error:", error);
      return res.status(500).json({ message: "Error interno" });
    }
  });
  app2.get("/api/reportes/programacion-semanal", requireAdmin, async (req, res) => {
    try {
      let formatDateHeader2 = function(fecha2, dayName, minuta) {
        const dd = /* @__PURE__ */ new Date(fecha2 + "T12:00:00");
        const dayNum = dd.getDate();
        const month = monthNames[dd.getMonth()];
        let header = `${dayName} ${dayNum} DE ${month}`;
        if (minuta) {
          const opts = [minuta.opcion1, minuta.opcion2, minuta.opcion3, minuta.opcion4, minuta.opcion5].filter(Boolean);
          header += " " + opts.map((o, i) => `OP${i + 1}: ${o}`).join(" ");
        }
        return header;
      };
      var formatDateHeader = formatDateHeader2;
      const { casinoId, fecha } = req.query;
      if (!casinoId || !fecha) {
        return res.status(400).json({ message: "casinoId y fecha son requeridos" });
      }
      if (!await assertCasinoAccess(req, res, casinoId)) return;
      const casino = await storage.getCasino(casinoId);
      if (!casino) return res.status(404).json({ message: "Casino no encontrado" });
      const d = /* @__PURE__ */ new Date(fecha + "T12:00:00");
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setDate(d.getDate() + mondayOffset);
      const weekDates = [];
      for (let i = 0; i < 5; i++) {
        const dd = new Date(monday);
        dd.setDate(monday.getDate() + i);
        weekDates.push(dd.toISOString().split("T")[0]);
      }
      const allMinutas = await storage.getAllMinutasByCasino(casinoId);
      const weekMinutas = weekDates.map((fecha2) => allMinutas.find((m) => m.fecha === fecha2) || null);
      const allUsers = await storage.getAllUsers();
      const casinoUsers = allUsers.filter((u) => u.casinoId === casinoId && u.role === "comensal" && u.activo).sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`));
      const allPedidos = await storage.getAllPedidos();
      const weekMinutaIds = weekMinutas.filter(Boolean).map((m) => m.id);
      const weekPedidos = allPedidos.filter((p) => weekMinutaIds.includes(p.minutaId));
      const dayNames = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];
      const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
      const ExcelJS2 = (await import("exceljs")).default;
      const wb = new ExcelJS2.Workbook();
      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B365D" } };
      const headerFont = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      const goldFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
      const borderThin = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      const wsDatos = wb.addWorksheet("Datos", { properties: { tabColor: { argb: "FFD4A843" } } });
      const datosHeaders = ["ID", "RUT", "Nombre completo"];
      weekDates.forEach((fecha2, i) => datosHeaders.push(formatDateHeader2(fecha2, dayNames[i], weekMinutas[i])));
      wsDatos.columns = datosHeaders.map((h, i) => ({
        header: h,
        key: `col${i}`,
        width: i === 0 ? 6 : i === 1 ? 16 : i === 2 ? 35 : 15
      }));
      const hRow = wsDatos.getRow(1);
      hRow.height = 80;
      hRow.eachCell((cell) => {
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = borderThin;
      });
      let rowIdx = 1;
      casinoUsers.forEach((user) => {
        const rowData = {
          col0: rowIdx,
          col1: user.rut,
          col2: `${user.apellido} ${user.nombre}`.toUpperCase()
        };
        weekMinutas.forEach((minuta, dayI) => {
          if (!minuta) {
            rowData[`col${dayI + 3}`] = "";
            return;
          }
          const pedido = weekPedidos.find((p) => p.minutaId === minuta.id && p.userId === user.id);
          if (!pedido) {
            rowData[`col${dayI + 3}`] = "NO INSCRITO";
            return;
          }
          if (pedido.tipo === "no_asiste") {
            rowData[`col${dayI + 3}`] = "VACACIONES/ADMINISTRATIVO";
            return;
          }
          rowData[`col${dayI + 3}`] = pedido.opcionSeleccionada;
        });
        wsDatos.addRow(rowData);
        rowIdx++;
      });
      for (let r = 2; r <= wsDatos.rowCount; r++) {
        const row = wsDatos.getRow(r);
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = borderThin;
          cell.alignment = { vertical: "middle", horizontal: "center" };
          if (cell.value === "VACACIONES/ADMINISTRATIVO") {
            cell.fill = goldFill;
            cell.font = { italic: true, size: 9, color: { argb: "FF996600" } };
          } else if (cell.value === "NO INSCRITO") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } };
            cell.font = { italic: true, size: 9, color: { argb: "FFCC0000" } };
          }
        });
      }
      const wsResumen = wb.addWorksheet("Resumen", { properties: { tabColor: { argb: "FF4472C4" } } });
      const resHeaders = ["Opci\xF3n"];
      weekDates.forEach((fecha2, i) => {
        const dd = /* @__PURE__ */ new Date(fecha2 + "T12:00:00");
        resHeaders.push(`${dayNames[i]} ${dd.getDate()}/${dd.getMonth() + 1}`);
      });
      wsResumen.columns = resHeaders.map((h, i) => ({ header: h, key: `col${i}`, width: i === 0 ? 12 : 18 }));
      const resHRow = wsResumen.getRow(1);
      resHRow.height = 30;
      resHRow.eachCell((cell) => {
        cell.font = headerFont;
        cell.fill = headerFill;
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = borderThin;
      });
      const maxOpts = Math.max(...weekMinutas.map((m) => m ? [m.opcion1, m.opcion2, m.opcion3, m.opcion4, m.opcion5].filter(Boolean).length : 0));
      for (let optIdx = 0; optIdx < maxOpts; optIdx++) {
        const descRow = { col0: `OP${optIdx + 1}` };
        weekMinutas.forEach((minuta, dayI) => {
          if (!minuta) {
            descRow[`col${dayI + 1}`] = "";
            return;
          }
          const opts = [minuta.opcion1, minuta.opcion2, minuta.opcion3, minuta.opcion4, minuta.opcion5].filter(Boolean);
          descRow[`col${dayI + 1}`] = opts[optIdx] || "";
        });
        const r = wsResumen.addRow(descRow);
        r.eachCell((cell) => {
          cell.border = borderThin;
          cell.alignment = { wrapText: true, vertical: "middle" };
          cell.font = { italic: true, size: 10 };
        });
      }
      wsResumen.addRow({});
      for (let optIdx = 0; optIdx < maxOpts; optIdx++) {
        const countRow = { col0: `Opci\xF3n ${optIdx + 1}` };
        weekMinutas.forEach((minuta, dayI) => {
          if (!minuta) {
            countRow[`col${dayI + 1}`] = 0;
            return;
          }
          const pedidos4 = weekPedidos.filter((p) => p.minutaId === minuta.id && p.tipo !== "no_asiste" && p.tipo !== "visita" && p.opcionSeleccionada === optIdx + 1);
          countRow[`col${dayI + 1}`] = pedidos4.length;
        });
        const r = wsResumen.addRow(countRow);
        r.eachCell((cell) => {
          cell.border = borderThin;
          cell.alignment = { horizontal: "center", vertical: "middle" };
        });
      }
      const totalRow = { col0: "TOTAL" };
      weekMinutas.forEach((minuta, dayI) => {
        if (!minuta) {
          totalRow[`col${dayI + 1}`] = 0;
          return;
        }
        const pedidos4 = weekPedidos.filter((p) => p.minutaId === minuta.id && p.tipo !== "no_asiste" && p.tipo !== "visita");
        totalRow[`col${dayI + 1}`] = pedidos4.length;
      });
      const tRow = wsResumen.addRow(totalRow);
      tRow.eachCell((cell) => {
        cell.font = { bold: true, size: 12 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
        cell.border = borderThin;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      const vacRow = { col0: "No asisten" };
      weekMinutas.forEach((minuta, dayI) => {
        if (!minuta) {
          vacRow[`col${dayI + 1}`] = 0;
          return;
        }
        vacRow[`col${dayI + 1}`] = weekPedidos.filter((p) => p.minutaId === minuta.id && p.tipo === "no_asiste").length;
      });
      const vRow = wsResumen.addRow(vacRow);
      vRow.eachCell((cell) => {
        cell.border = borderThin;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = goldFill;
      });
      const noInscRow = { col0: "No inscritos" };
      weekMinutas.forEach((minuta, dayI) => {
        if (!minuta) {
          noInscRow[`col${dayI + 1}`] = 0;
          return;
        }
        const inscritosIds = new Set(weekPedidos.filter((p) => p.minutaId === minuta.id).map((p) => p.userId));
        noInscRow[`col${dayI + 1}`] = casinoUsers.filter((u) => !inscritosIds.has(u.id)).length;
      });
      const niRow = wsResumen.addRow(noInscRow);
      niRow.eachCell((cell) => {
        cell.border = borderThin;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } };
      });
      const startDate = /* @__PURE__ */ new Date(weekDates[0] + "T12:00:00");
      const endDate = /* @__PURE__ */ new Date(weekDates[4] + "T12:00:00");
      const fileName = `PROGRAMACION_${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, "0")}_${startDate.getDate()}_al_${endDate.getDate()}_${casino.nombre.replace(/\s+/g, "_").toUpperCase()}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      await wb.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Programacion semanal error:", error);
      return res.status(500).json({ message: "Error al generar reporte" });
    }
  });
  app2.post("/api/usuarios/upload", requireAdminOnly, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se recibi\xF3 archivo" });
      }
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet);
      let created = 0;
      let skipped = 0;
      let errors = 0;
      const errorDetails = [];
      for (let i = 0; i < rows.length; i++) {
        const rawRow = rows[i];
        const row = {};
        for (const k of Object.keys(rawRow)) row[k.toUpperCase().trim()] = rawRow[k];
        const rowNum = i + 2;
        try {
          const rut = String(row["RUT"] || "").trim();
          const nombre = String(row["NOMBRE"] || "").trim();
          const apellido = String(row["APELLIDO"] || "").trim();
          const telefonoRaw = String(row["TELEFONO"] || row["CELULAR"] || row["TEL\xC9FONO"] || "").trim();
          const rolRaw = String(row["ROL"] || "comensal").trim().toLowerCase();
          const casinoRaw = String(row["CASINO_ID"] || row["CASINOID"] || row["CASINO"] || "").trim();
          if (!rut || !nombre) {
            errorDetails.push({ row: rowNum, error: "RUT o Nombre vac\xEDo" });
            errors++;
            continue;
          }
          if (looksLikeRut(rut) && !validarRutChileno(rut)) {
            errorDetails.push({ row: rowNum, error: `RUT ${rut} inv\xE1lido \u2014 d\xEDgito verificador incorrecto` });
            errors++;
            continue;
          }
          const rol = rolRaw === "interlocutor" ? "interlocutor" : rolRaw === "admin" ? "admin" : "comensal";
          let casinoId = "";
          if (casinoRaw) {
            if (casinoRaw.includes("-") && casinoRaw.length > 20) {
              casinoId = casinoRaw;
            } else {
              const allCasinos = await storage.getCasinos();
              const match = allCasinos.find((c) => c.nombre.toLowerCase() === casinoRaw.toLowerCase());
              if (match) casinoId = match.id;
            }
          }
          const existing = await storage.getUserByRut(rut);
          if (existing) {
            skipped++;
            continue;
          }
          const digits = rut.replace(/[^0-9]/g, "");
          const defaultPassword = digits.slice(0, 4) || "1234";
          const hashedPassword = await bcrypt2.hash(defaultPassword, 10);
          await storage.createUser({ rut, nombre, apellido, telefono: telefonoRaw || null, password: hashedPassword, role: rol, casinoId: casinoId || null, passwordChangeRequired: false });
          created++;
        } catch (err) {
          errorDetails.push({ row: rowNum, error: err.message || "Error desconocido" });
          errors++;
        }
      }
      try {
        fs2.unlinkSync(req.file.path);
      } catch {
      }
      return res.json({ created, skipped, errors, errorDetails });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ message: "Error al procesar el archivo" });
    }
  });
  const EX = {
    darkFill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A2E" } },
    navyFill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF16213E" } },
    headerBlueFill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F3460" } },
    goldLightFill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } },
    greenFill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } },
    orangeFill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } },
    redLightFill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCDD2" } },
    whiteFill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } },
    grayFill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } },
    optFills: [
      { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } },
      { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } },
      { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E0" } },
      { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E5F5" } },
      { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBEE" } }
    ],
    fontTitle: { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } },
    fontSubGold: { name: "Calibri", size: 11, color: { argb: "FFD4A843" } },
    fontSubtitle: { name: "Calibri", size: 12, bold: true, color: { argb: "FFD4A843" } },
    fontHeader: { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } },
    fontNormal: { name: "Calibri", size: 11, color: { argb: "FF333333" } },
    fontSmall: { name: "Calibri", size: 10, color: { argb: "FF666666" } },
    fontGold: { name: "Calibri", size: 11, bold: true, color: { argb: "FFB8902E" } },
    fontBoldDark: { name: "Calibri", size: 11, bold: true, color: { argb: "FF1A1A2E" } },
    borderThin: {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } }
    },
    borderGold: {
      top: { style: "medium", color: { argb: "FFD4A843" } },
      bottom: { style: "medium", color: { argb: "FFD4A843" } },
      left: { style: "medium", color: { argb: "FFD4A843" } },
      right: { style: "medium", color: { argb: "FFD4A843" } }
    },
    center: { horizontal: "center", vertical: "middle" },
    left: { horizontal: "left", vertical: "middle", wrapText: true },
    right: { horizontal: "right", vertical: "middle" }
  };
  app2.get("/api/plantillas/usuarios", async (_req, res) => {
    try {
      const casinosList = await storage.getCasinos();
      const wb = new ExcelJS.Workbook();
      wb.creator = "Vascan SPA";
      wb.created = /* @__PURE__ */ new Date();
      const wsInst = wb.addWorksheet("Instrucciones", { properties: { tabColor: { argb: "FF1A1A2E" } } });
      wsInst.columns = [{ width: 26 }, { width: 68 }];
      wsInst.mergeCells("A1:B1");
      wsInst.getCell("A1").value = "PLANTILLA DE CARGA DE USUARIOS";
      wsInst.getCell("A1").font = EX.fontTitle;
      wsInst.getCell("A1").fill = EX.darkFill;
      wsInst.getCell("A1").alignment = EX.center;
      wsInst.getRow(1).height = 36;
      wsInst.mergeCells("A2:B2");
      wsInst.getCell("A2").value = "VASCAN SPA \u2014 Sistema de Inscripci\xF3n de Comensales";
      wsInst.getCell("A2").font = EX.fontSubGold;
      wsInst.getCell("A2").fill = EX.navyFill;
      wsInst.getCell("A2").alignment = EX.center;
      wsInst.getRow(2).height = 24;
      wsInst.getCell("A4").value = "INSTRUCCIONES";
      wsInst.getCell("A4").font = EX.fontSubtitle;
      wsInst.getCell("A4").fill = EX.goldLightFill;
      wsInst.getCell("B4").fill = EX.goldLightFill;
      wsInst.getRow(4).height = 28;
      const instructions = [
        "Complete los datos en la hoja 'Usuarios' respetando el formato indicado.",
        "El campo RUT debe incluir gui\xF3n y d\xEDgito verificador (ej: 12345678-9).",
        "El campo ROL tiene un men\xFA desplegable: comensal, interlocutor, admin.",
        "El campo CASINO tiene un men\xFA desplegable con los casinos disponibles.",
        "La contrase\xF1a por defecto ser\xE1n los primeros 4 d\xEDgitos del RUT.",
        "Los usuarios con RUT duplicado ser\xE1n omitidos autom\xE1ticamente."
      ];
      instructions.forEach((text3, i) => {
        const row = 6 + i;
        wsInst.getCell(`A${row}`).value = `${i + 1}.`;
        wsInst.getCell(`A${row}`).font = EX.fontGold;
        wsInst.getCell(`A${row}`).alignment = EX.right;
        wsInst.getCell(`B${row}`).value = text3;
        wsInst.getCell(`B${row}`).font = EX.fontNormal;
      });
      const obRow = 13;
      wsInst.getCell(`A${obRow}`).value = "CAMPOS OBLIGATORIOS:";
      wsInst.getCell(`A${obRow}`).font = EX.fontBoldDark;
      wsInst.getCell(`A${obRow}`).fill = EX.greenFill;
      wsInst.getCell(`A${obRow}`).border = EX.borderThin;
      wsInst.getCell(`B${obRow}`).value = "RUT, Nombre, Apellido";
      wsInst.getCell(`B${obRow}`).font = EX.fontNormal;
      wsInst.getCell(`B${obRow}`).fill = EX.greenFill;
      wsInst.getCell(`B${obRow}`).border = EX.borderThin;
      wsInst.getCell(`A${obRow + 1}`).value = "CAMPOS OPCIONALES:";
      wsInst.getCell(`A${obRow + 1}`).font = EX.fontBoldDark;
      wsInst.getCell(`A${obRow + 1}`).fill = EX.orangeFill;
      wsInst.getCell(`A${obRow + 1}`).border = EX.borderThin;
      wsInst.getCell(`B${obRow + 1}`).value = "Rol (default: comensal), Casino (seleccionar del desplegable)";
      wsInst.getCell(`B${obRow + 1}`).font = EX.fontNormal;
      wsInst.getCell(`B${obRow + 1}`).fill = EX.orangeFill;
      wsInst.getCell(`B${obRow + 1}`).border = EX.borderThin;
      const wsUsers = wb.addWorksheet("Usuarios", { properties: { tabColor: { argb: "FFD4A843" } } });
      wsUsers.columns = [
        { header: "RUT", key: "rut", width: 18 },
        { header: "NOMBRE", key: "nombre", width: 22 },
        { header: "APELLIDO", key: "apellido", width: 22 },
        { header: "TELEFONO", key: "telefono", width: 18 },
        { header: "ROL", key: "rol", width: 18 },
        { header: "CASINO", key: "casino", width: 32 }
      ];
      const headerRowU = wsUsers.getRow(1);
      headerRowU.height = 30;
      headerRowU.eachCell((cell) => {
        cell.font = EX.fontHeader;
        cell.fill = EX.headerBlueFill;
        cell.alignment = EX.center;
        cell.border = EX.borderGold;
      });
      const casinoNames = casinosList.map((c) => c.nombre);
      const casinoMap = {};
      casinosList.forEach((c) => {
        casinoMap[c.nombre] = c.id;
      });
      const examples = [
        { rut: "12345678-9", nombre: "Juan", apellido: "P\xE9rez", telefono: "+56912345678", rol: "comensal", casino: casinoNames[0] || "" },
        { rut: "98765432-1", nombre: "Mar\xEDa", apellido: "Gonz\xE1lez", telefono: "+56987654321", rol: "interlocutor", casino: casinoNames[0] || "" },
        { rut: "11223344-5", nombre: "Carlos", apellido: "Mu\xF1oz", telefono: "", rol: "comensal", casino: "" }
      ];
      examples.forEach((ex) => wsUsers.addRow(ex));
      for (let i = 0; i < 97; i++) wsUsers.addRow({ rut: "", nombre: "", apellido: "", telefono: "", rol: "", casino: "" });
      const DATA_ROWS = 100;
      for (let r = 2; r <= DATA_ROWS + 1; r++) {
        const row = wsUsers.getRow(r);
        const isExample = r <= 4;
        const isEven = r % 2 === 0;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = isExample ? { ...EX.fontSmall, italic: true } : EX.fontNormal;
          cell.fill = isExample ? EX.goldLightFill : isEven ? EX.grayFill : EX.whiteFill;
          cell.border = EX.borderThin;
          cell.alignment = colNumber === 1 ? EX.center : EX.left;
        });
        wsUsers.getCell(`E${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"comensal,interlocutor,admin"'],
          showErrorMessage: true,
          errorTitle: "Rol inv\xE1lido",
          error: "Seleccione: comensal, interlocutor o admin",
          promptTitle: "Seleccionar Rol",
          prompt: "Elija el rol del usuario",
          showInputMessage: true
        };
        if (casinoNames.length > 0) {
          wsUsers.getCell(`F${r}`).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [`"${casinoNames.join(",")}"`],
            showErrorMessage: true,
            errorTitle: "Casino inv\xE1lido",
            error: "Seleccione un casino de la lista",
            promptTitle: "Seleccionar Casino",
            prompt: "Elija el casino asignado",
            showInputMessage: true
          };
        }
      }
      const wsCasinos = wb.addWorksheet("Casinos (Referencia)", { properties: { tabColor: { argb: "FF0F3460" } } });
      wsCasinos.columns = [
        { header: "NOMBRE", key: "nombre", width: 35 },
        { header: "DIRECCI\xD3N", key: "direccion", width: 40 },
        { header: "ID (UUID)", key: "id", width: 42 },
        { header: "ESTADO", key: "estado", width: 12 }
      ];
      const headerRowC = wsCasinos.getRow(1);
      headerRowC.height = 28;
      headerRowC.eachCell((cell) => {
        cell.font = EX.fontHeader;
        cell.fill = EX.headerBlueFill;
        cell.alignment = EX.center;
        cell.border = EX.borderGold;
      });
      casinosList.forEach((c) => {
        const row = wsCasinos.addRow({ nombre: c.nombre, direccion: c.direccion || "\u2014", id: c.id, estado: c.activo ? "Activo" : "Inactivo" });
        row.eachCell((cell) => {
          cell.font = EX.fontNormal;
          cell.border = EX.borderThin;
          cell.alignment = EX.left;
        });
      });
      wsCasinos.state = "visible";
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=Plantilla_Usuarios_Vascan.xlsx");
      return res.send(Buffer.from(buf));
    } catch (error) {
      console.error("Template error:", error);
      return res.status(500).json({ message: "Error al generar plantilla" });
    }
  });
  app2.get("/api/plantillas/minutas", async (_req, res) => {
    try {
      const casinosList = await storage.getCasinos();
      const wb = new ExcelJS.Workbook();
      wb.creator = "Vascan SPA";
      wb.created = /* @__PURE__ */ new Date();
      const wsInst = wb.addWorksheet("Instrucciones", { properties: { tabColor: { argb: "FF1A1A2E" } } });
      wsInst.columns = [{ width: 22 }, { width: 72 }];
      wsInst.mergeCells("A1:B1");
      wsInst.getCell("A1").value = "PLANTILLA DE PLANIFICACI\xD3N DE MINUTAS";
      wsInst.getCell("A1").font = EX.fontTitle;
      wsInst.getCell("A1").fill = EX.darkFill;
      wsInst.getCell("A1").alignment = EX.center;
      wsInst.getRow(1).height = 36;
      wsInst.mergeCells("A2:B2");
      wsInst.getCell("A2").value = "VASCAN SPA \u2014 Sistema de Inscripci\xF3n de Comensales";
      wsInst.getCell("A2").font = EX.fontSubGold;
      wsInst.getCell("A2").fill = EX.navyFill;
      wsInst.getCell("A2").alignment = EX.center;
      wsInst.getRow(2).height = 24;
      wsInst.getCell("A4").value = "INSTRUCCIONES";
      wsInst.getCell("A4").font = EX.fontSubtitle;
      wsInst.getCell("A4").fill = EX.goldLightFill;
      wsInst.getCell("B4").fill = EX.goldLightFill;
      const minInstructions = [
        "Complete las minutas en la hoja correspondiente a cada casino.",
        "Cada semana tiene 5 columnas (Lunes a Viernes) y hasta 5 opciones de men\xFA por d\xEDa.",
        "La fila FECHA contiene las fechas en formato AAAA-MM-DD. No modificar el formato.",
        "Las opciones 4 y 5 son opcionales (dejar en blanco si no aplica).",
        "Para importar, suba este archivo en el panel de administraci\xF3n > Carga Masiva.",
        "La secci\xF3n CONSOLIDACI\xD3N se llena autom\xE1ticamente con los datos de inscripci\xF3n."
      ];
      minInstructions.forEach((text3, i) => {
        const row = 6 + i;
        wsInst.getCell(`A${row}`).value = `${i + 1}.`;
        wsInst.getCell(`A${row}`).font = EX.fontGold;
        wsInst.getCell(`A${row}`).alignment = EX.right;
        wsInst.getCell(`B${row}`).value = text3;
        wsInst.getCell(`B${row}`).font = EX.fontNormal;
      });
      wsInst.getCell("A13").value = "IMPORTANTE:";
      wsInst.getCell("A13").font = EX.fontBoldDark;
      wsInst.getCell("A13").fill = EX.redLightFill;
      wsInst.getCell("A13").border = EX.borderThin;
      wsInst.getCell("B13").value = "No modificar la estructura de las hojas ni las filas de FECHA / ID Casino.";
      wsInst.getCell("B13").font = EX.fontNormal;
      wsInst.getCell("B13").fill = EX.redLightFill;
      wsInst.getCell("B13").border = EX.borderThin;
      const today = /* @__PURE__ */ new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1);
      const DIAS = ["Lunes", "Martes", "Mi\xE9rcoles", "Jueves", "Viernes"];
      for (const casino of casinosList) {
        const safeSheetName = casino.nombre.substring(0, 28).replace(/[\\\/\?\*\[\]]/g, "");
        const ws = wb.addWorksheet(safeSheetName, { properties: { tabColor: { argb: "FFD4A843" } } });
        ws.columns = [
          { width: 20 },
          { width: 20 },
          { width: 30 },
          { width: 30 },
          { width: 30 },
          { width: 30 },
          { width: 30 }
        ];
        ws.mergeCells("A1:G1");
        ws.getCell("A1").value = "PLANIFICACI\xD3N SEMANAL DE MINUTAS";
        ws.getCell("A1").font = EX.fontTitle;
        ws.getCell("A1").fill = EX.darkFill;
        ws.getCell("A1").alignment = EX.center;
        ws.getRow(1).height = 32;
        ws.getCell("A2").value = "Casino:";
        ws.getCell("A2").font = EX.fontGold;
        ws.getCell("B2").value = casino.nombre;
        ws.getCell("B2").font = EX.fontBoldDark;
        ws.getCell("A3").value = "Direcci\xF3n:";
        ws.getCell("A3").font = EX.fontSmall;
        ws.getCell("B3").value = casino.direccion || "\u2014";
        ws.getCell("B3").font = EX.fontSmall;
        ws.getCell("A4").value = "ID Casino:";
        ws.getCell("A4").font = { ...EX.fontSmall, size: 8 };
        ws.getCell("B4").value = casino.id;
        ws.getCell("B4").font = { ...EX.fontSmall, size: 8 };
        let currentRow = 6;
        for (let week = 0; week < 4; week++) {
          const weekStart = new Date(monday);
          weekStart.setDate(monday.getDate() + week * 7);
          const dates = [];
          const dateLabels = [];
          for (let d = 0; d < 5; d++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + d);
            dates.push(day.toISOString().split("T")[0]);
            dateLabels.push(`${DIAS[d]} ${day.getDate()}/${day.getMonth() + 1}`);
          }
          const weekHeaderRow = ws.getRow(currentRow);
          weekHeaderRow.values = [`SEMANA ${week + 1}`, `${dates[0]} al ${dates[4]}`, ...dateLabels];
          weekHeaderRow.height = 26;
          weekHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = EX.fontHeader;
            cell.fill = EX.headerBlueFill;
            cell.alignment = EX.center;
            cell.border = EX.borderGold;
          });
          currentRow++;
          const dateRow = ws.getRow(currentRow);
          dateRow.values = ["", "FECHA", ...dates];
          dateRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { ...EX.fontSmall, bold: true, color: { argb: "FF0F3460" } };
            cell.fill = EX.goldLightFill;
            cell.alignment = EX.center;
            cell.border = EX.borderThin;
            cell.numFmt = "@";
          });
          currentRow++;
          for (let opt = 0; opt < 5; opt++) {
            const optRow = ws.getRow(currentRow);
            optRow.values = [opt === 0 ? "" : "", `OPCI\xD3N ${opt + 1}`, "", "", "", "", ""];
            optRow.height = 24;
            const optFill = EX.optFills[opt];
            optRow.getCell(1).font = EX.fontSmall;
            optRow.getCell(1).fill = optFill;
            optRow.getCell(1).border = EX.borderThin;
            optRow.getCell(2).font = EX.fontGold;
            optRow.getCell(2).fill = optFill;
            optRow.getCell(2).alignment = EX.left;
            optRow.getCell(2).border = EX.borderThin;
            for (let c = 3; c <= 7; c++) {
              const cell = optRow.getCell(c);
              cell.font = EX.fontNormal;
              cell.fill = EX.whiteFill;
              cell.alignment = EX.left;
              cell.border = EX.borderThin;
            }
            currentRow++;
          }
          currentRow++;
          const consHeaderRow = ws.getRow(currentRow);
          consHeaderRow.values = ["", "CONSOLIDACI\xD3N", ...dateLabels];
          consHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { ...EX.fontHeader, color: { argb: "FFB8902E" } };
            cell.fill = EX.goldLightFill;
            cell.alignment = EX.center;
            cell.border = EX.borderThin;
          });
          currentRow++;
          for (let i = 0; i < 5; i++) {
            const consRow = ws.getRow(currentRow);
            consRow.values = ["", `Inscritos Op.${i + 1}`, 0, 0, 0, 0, 0];
            consRow.getCell(2).font = EX.fontSmall;
            consRow.getCell(2).fill = EX.optFills[i];
            consRow.getCell(2).alignment = EX.left;
            consRow.getCell(2).border = EX.borderThin;
            for (let c = 3; c <= 7; c++) {
              consRow.getCell(c).font = EX.fontNormal;
              consRow.getCell(c).fill = EX.optFills[i];
              consRow.getCell(c).alignment = EX.center;
              consRow.getCell(c).border = EX.borderThin;
            }
            currentRow++;
          }
          const extraLabels = ["Sin inscripci\xF3n", "Visitas"];
          for (const label of extraLabels) {
            const row = ws.getRow(currentRow);
            row.values = ["", label, "", "", "", "", ""];
            row.getCell(2).font = EX.fontSmall;
            row.getCell(2).fill = EX.grayFill;
            row.getCell(2).alignment = EX.left;
            row.getCell(2).border = EX.borderThin;
            for (let c = 3; c <= 7; c++) {
              row.getCell(c).font = EX.fontNormal;
              row.getCell(c).fill = EX.grayFill;
              row.getCell(c).alignment = EX.center;
              row.getCell(c).border = EX.borderThin;
            }
            currentRow++;
          }
          const totalRow = ws.getRow(currentRow);
          totalRow.values = ["", "TOTAL COMENSALES", 0, 0, 0, 0, 0];
          totalRow.height = 26;
          totalRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = EX.fontHeader;
            cell.fill = EX.darkFill;
            cell.alignment = EX.center;
            cell.border = EX.borderGold;
          });
          currentRow += 3;
        }
      }
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=Plantilla_Minutas_Vascan.xlsx");
      return res.send(Buffer.from(buf));
    } catch (error) {
      console.error("Template minutas error:", error);
      return res.status(500).json({ message: "Error al generar plantilla" });
    }
  });
  app2.post("/api/minutas/upload", requireAdminOnly, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se recibi\xF3 archivo" });
      }
      const workbook = XLSX.readFile(req.file.path, { cellDates: true });
      let created = 0;
      let skipped = 0;
      let errors = 0;
      const errorDetails = [];
      const toIsoDate = (v) => {
        if (v == null || v === "") return null;
        if (v instanceof Date && !isNaN(v.getTime())) {
          const y = v.getFullYear();
          const m2 = String(v.getMonth() + 1).padStart(2, "0");
          const d = String(v.getDate()).padStart(2, "0");
          return `${y}-${m2}-${d}`;
        }
        const s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        const n = Number(s);
        if (!isNaN(n) && n > 25569 && n < 6e4) {
          const ms = (n - 25569) * 86400 * 1e3;
          const d = new Date(ms);
          const y = d.getUTCFullYear();
          const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(d.getUTCDate()).padStart(2, "0");
          return `${y}-${mo}-${dd}`;
        }
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) {
          return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }
        return null;
      };
      for (const sheetName of workbook.SheetNames) {
        if (sheetName === "Instrucciones") continue;
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
        let casinoId = "";
        for (const row of rows) {
          if (row && row[0] && String(row[0]).trim() === "ID Casino:" && row[1]) {
            casinoId = String(row[1]).trim();
            break;
          }
        }
        if (!casinoId) {
          errorDetails.push({ sheet: sheetName, row: 0, error: `No se encontr\xF3 "ID Casino:" en la hoja. Use la plantilla descargada.` });
          errors++;
          continue;
        }
        const casino = await storage.getCasino(casinoId);
        if (!casino) {
          errorDetails.push({ sheet: sheetName, row: 0, error: `Casino ID "${casinoId}" no encontrado` });
          errors++;
          continue;
        }
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[1] || String(row[1]).trim() !== "FECHA") continue;
          const fechas = [row[2], row[3], row[4], row[5], row[6]].map(toIsoDate);
          for (let dayIdx = 0; dayIdx < fechas.length; dayIdx++) {
            const fecha = fechas[dayIdx];
            if (!fecha) continue;
            try {
              const opciones = [];
              for (let optRow = 1; optRow <= 5; optRow++) {
                const optionRow = rows[i + optRow];
                const cell = optionRow ? optionRow[dayIdx + 2] : null;
                const txt = cell != null ? String(cell).trim() : "";
                if (txt) opciones.push(txt);
              }
              if (opciones.length < 3) {
                errorDetails.push({ sheet: sheetName, row: i + 1, error: `Fecha ${fecha}: se requieren al menos 3 opciones (encontradas: ${opciones.length})` });
                errors++;
                continue;
              }
              const existingMinutas = await storage.getMinutasByCasino(casinoId);
              const existing = existingMinutas.find((m) => m.fecha === fecha);
              if (existing) {
                skipped++;
                continue;
              }
              await storage.createMinuta({
                casinoId,
                fecha,
                opcion1: opciones[0],
                opcion2: opciones[1],
                opcion3: opciones[2],
                opcion4: opciones[3] || null,
                opcion5: opciones[4] || null
              });
              created++;
            } catch (err) {
              errorDetails.push({ sheet: sheetName, row: i, error: err.message });
              errors++;
            }
          }
        }
      }
      try {
        fs2.unlinkSync(req.file.path);
      } catch {
      }
      return res.json({ created, skipped, errors, errorDetails });
    } catch (error) {
      console.error("Upload minutas error:", error);
      return res.status(500).json({ message: "Error al procesar el archivo" });
    }
  });
  function buildHeader(ws, title) {
    ws.mergeCells("A1:F1");
    ws.getCell("A1").value = title;
    ws.getCell("A1").font = EX.fontTitle;
    ws.getCell("A1").fill = EX.darkFill;
    ws.getCell("A1").alignment = EX.center;
    ws.getRow(1).height = 30;
    ws.mergeCells("A2:F2");
    ws.getCell("A2").value = "BUENAMEZCLA \u2014 Sistema de Comensales";
    ws.getCell("A2").font = EX.fontSubGold;
    ws.getCell("A2").fill = EX.navyFill;
    ws.getCell("A2").alignment = EX.center;
  }
  function scopedCasinoId(req, requested) {
    const sUser = req.currentUser;
    if (sUser?.role === "interlocutor") {
      return sUser.casinoId || null;
    }
    return requested;
  }
  async function getScopedCasinoFilter(req, requested) {
    const sUser = req.currentUser;
    const accessible = await getAccessibleCasinoIds(sUser);
    const specific = requested && requested !== "all" ? requested : null;
    if (accessible === null) {
      return { allowedIds: specific ? /* @__PURE__ */ new Set([specific]) : null };
    }
    if (!specific) {
      return { allowedIds: new Set(accessible) };
    }
    if (!accessible.includes(specific)) {
      return { allowedIds: /* @__PURE__ */ new Set() };
    }
    return { allowedIds: /* @__PURE__ */ new Set([specific]) };
  }
  app2.get("/api/reportes/inscripciones-live", requireAdmin, async (req, res) => {
    try {
      const { fechaDesde, fechaHasta } = req.query;
      const scope = await getScopedCasinoFilter(req, req.query.casinoId);
      if (scope.allowedIds && scope.allowedIds.size === 0) {
        return res.status(403).json({ message: "Sin acceso al casino solicitado" });
      }
      if (!fechaDesde || !fechaHasta) return res.status(400).json({ message: "fechaDesde y fechaHasta requeridos" });
      const [allPedidos, allMinutas, allUsers, allCasinos, allFamilias] = await Promise.all([
        storage.getAllPedidos(),
        storage.getAllMinutas(),
        storage.getAllUsers(),
        storage.getCasinos(),
        storage.getAllFamilias().catch(() => [])
      ]);
      const minutaById = new Map(allMinutas.map((m) => [m.id, m]));
      const userById = new Map(allUsers.map((u) => [u.id, u]));
      const casinoById = new Map(allCasinos.map((c) => [c.id, c]));
      const familiaByName = new Map(allFamilias.map((f) => [String(f.nombre || "").toLowerCase(), f]));
      const start = /* @__PURE__ */ new Date(fechaDesde + "T00:00:00");
      const end = /* @__PURE__ */ new Date(fechaHasta + "T23:59:59");
      const filtered = allPedidos.filter((p) => {
        if (p.deletedAt) return false;
        const created = p.createdAt ? new Date(p.createdAt) : null;
        if (!created || created < start || created > end) return false;
        if (scope.allowedIds) {
          const m = minutaById.get(p.minutaId);
          if (!m || !scope.allowedIds.has(m.casinoId)) return false;
        }
        return true;
      });
      const rows = filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((p) => {
        const m = minutaById.get(p.minutaId);
        const u = userById.get(p.userId);
        const c = m ? casinoById.get(m.casinoId) : null;
        const opciones = m ? [m.opcion1, m.opcion2, m.opcion3, m.opcion4, m.opcion5] : [];
        const opcionTexto = p.tipo === "no_asiste" ? "(no asiste)" : opciones[p.opcionSeleccionada - 1] || `Opci\xF3n ${p.opcionSeleccionada}`;
        const famName = m ? String(m.familia || "").toLowerCase() : "";
        const fam = famName ? familiaByName.get(famName) : null;
        return {
          id: p.id,
          createdAt: p.createdAt,
          tipo: p.tipo || "seleccion",
          rut: p.tipo === "visita" ? "" : u?.rut || "",
          comensal: p.tipo === "visita" ? p.nombreVisita || "VISITA" : u ? `${u.nombre} ${u.apellido}` : "\u2014",
          casinoId: m?.casinoId || "",
          casino: c?.nombre || "\u2014",
          familia: fam?.nombre || m?.familia || "\u2014",
          familiaColor: fam?.color || null,
          opcionNumero: p.opcionSeleccionada,
          opcionTexto,
          fechaServicio: m?.fecha || "\u2014",
          codigoQr: p.codigoQr || null,
          origenTotemId: p.origenTotemId || null
        };
      });
      res.json({ rows, total: rows.length, generatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (error) {
      console.error("Inscripciones live error:", error);
      res.status(500).json({ message: "Error al cargar inscripciones" });
    }
  });
  app2.get("/api/reportes/inscripcion-detalle", requireAdmin, async (req, res) => {
    try {
      const { fechaDesde, fechaHasta } = req.query;
      const scope = await getScopedCasinoFilter(req, req.query.casinoId);
      if (scope.allowedIds && scope.allowedIds.size === 0) {
        return res.status(403).json({ message: "Sin acceso al casino solicitado" });
      }
      if (!fechaDesde || !fechaHasta) return res.status(400).json({ message: "fechaDesde y fechaHasta requeridos" });
      const allPedidos = await storage.getAllPedidos();
      const allMinutas = await storage.getAllMinutas();
      const allUsers = await storage.getAllUsers();
      const allCasinos = await storage.getCasinos();
      const minutaById = new Map(allMinutas.map((m) => [m.id, m]));
      const userById = new Map(allUsers.map((u) => [u.id, u]));
      const casinoById = new Map(allCasinos.map((c) => [c.id, c]));
      const start = /* @__PURE__ */ new Date(fechaDesde + "T00:00:00");
      const end = /* @__PURE__ */ new Date(fechaHasta + "T23:59:59");
      const filtered = allPedidos.filter((p) => {
        const created = p.createdAt ? new Date(p.createdAt) : null;
        if (!created || created < start || created > end) return false;
        if (scope.allowedIds) {
          const m = minutaById.get(p.minutaId);
          if (!m || !scope.allowedIds.has(m.casinoId)) return false;
        }
        return true;
      });
      const wb = new ExcelJS.Workbook();
      wb.creator = "BuenaMezcla";
      const ws = wb.addWorksheet("Inscripciones", { properties: { tabColor: { argb: "FFD4A843" } } });
      ws.columns = [
        { header: "D\xEDa Inscripci\xF3n", key: "fechaInsc", width: 22 },
        { header: "Comensal (RUT - Nombre)", key: "comensal", width: 38 },
        { header: "Casino", key: "casino", width: 26 },
        { header: "Tipo", key: "tipo", width: 14 },
        { header: "Opci\xF3n", key: "opcion", width: 36 },
        { header: "D\xEDa Servicio", key: "fechaServ", width: 16 }
      ];
      buildHeader(ws, "INSCRIPCIONES POR RANGO DE FECHAS");
      const headerRow = ws.getRow(4);
      headerRow.values = ["D\xEDa Inscripci\xF3n", "Comensal", "Casino", "Tipo", "Opci\xF3n", "D\xEDa Servicio"];
      headerRow.height = 26;
      headerRow.eachCell((c) => {
        c.font = EX.fontHeader;
        c.fill = EX.headerBlueFill;
        c.alignment = EX.center;
        c.border = EX.borderGold;
      });
      const sorted = filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      sorted.forEach((p, idx) => {
        const m = minutaById.get(p.minutaId);
        const u = userById.get(p.userId);
        const c = m ? casinoById.get(m.casinoId) : null;
        const opciones = m ? [m.opcion1, m.opcion2, m.opcion3, m.opcion4, m.opcion5] : [];
        const opcionTexto = p.tipo === "no_asiste" ? "(no asiste)" : opciones[p.opcionSeleccionada - 1] || `Opci\xF3n ${p.opcionSeleccionada}`;
        const tipoLabel = p.tipo === "visita" ? `Visita: ${p.nombreVisita || ""}` : p.tipo === "no_asiste" ? "No asiste" : "Selecci\xF3n";
        const created = p.createdAt ? new Date(p.createdAt) : null;
        const fechaInscStr = created ? `${created.toLocaleDateString("es-CL")} ${String(created.getHours()).padStart(2, "0")}:${String(created.getMinutes()).padStart(2, "0")}` : "\u2014";
        const r = ws.addRow({
          fechaInsc: fechaInscStr,
          comensal: u ? `${u.rut} \u2014 ${u.nombre} ${u.apellido}` : "\u2014",
          casino: c?.nombre || "\u2014",
          tipo: tipoLabel,
          opcion: opcionTexto,
          fechaServ: m?.fecha || "\u2014"
        });
        const isEven = idx % 2 === 0;
        r.eachCell((cell) => {
          cell.font = EX.fontNormal;
          cell.fill = isEven ? EX.whiteFill : EX.grayFill;
          cell.border = EX.borderThin;
          cell.alignment = EX.left;
        });
      });
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=Inscripciones_${fechaDesde}_a_${fechaHasta}.xlsx`);
      return res.send(Buffer.from(buf));
    } catch (error) {
      console.error("Inscripcion detalle error:", error);
      return res.status(500).json({ message: "Error al generar reporte" });
    }
  });
  app2.get("/api/reportes/consumo-detalle", requireAdmin, async (req, res) => {
    try {
      const { fechaDesde, fechaHasta } = req.query;
      const scope = await getScopedCasinoFilter(req, req.query.casinoId);
      if (scope.allowedIds && scope.allowedIds.size === 0) {
        return res.status(403).json({ message: "Sin acceso al casino solicitado" });
      }
      if (!fechaDesde || !fechaHasta) return res.status(400).json({ message: "fechaDesde y fechaHasta requeridos" });
      const allPedidos = await storage.getAllPedidos();
      const allMinutas = await storage.getAllMinutas();
      const allUsers = await storage.getAllUsers();
      const allCasinos = await storage.getCasinos();
      const minutaById = new Map(allMinutas.map((m) => [m.id, m]));
      const userById = new Map(allUsers.map((u) => [u.id, u]));
      const casinoById = new Map(allCasinos.map((c) => [c.id, c]));
      const start = /* @__PURE__ */ new Date(fechaDesde + "T00:00:00");
      const end = /* @__PURE__ */ new Date(fechaHasta + "T23:59:59");
      const filtered = allPedidos.filter((p) => {
        if (p.tipo === "no_asiste") return false;
        if (!p.impresoEn) return false;
        const m = minutaById.get(p.minutaId);
        if (!m) return false;
        const fechaServ = /* @__PURE__ */ new Date(m.fecha + "T12:00:00");
        if (fechaServ < start || fechaServ > end) return false;
        if (scope.allowedIds && !scope.allowedIds.has(m.casinoId)) return false;
        return true;
      });
      const wb = new ExcelJS.Workbook();
      wb.creator = "BuenaMezcla";
      const ws = wb.addWorksheet("Consumo", { properties: { tabColor: { argb: "FFD4A843" } } });
      ws.columns = [
        { header: "Fecha y hora vale", key: "fechaConsumo", width: 22 },
        { header: "Comensal", key: "comensal", width: 38 },
        { header: "Casino", key: "casino", width: 26 },
        { header: "Opci\xF3n", key: "opcion", width: 36 },
        { header: "D\xEDa Servicio", key: "fechaServ", width: 16 },
        { header: "C\xF3digo QR", key: "qr", width: 28 }
      ];
      buildHeader(ws, "CONSUMO POR RANGO DE FECHAS");
      const headerRow = ws.getRow(4);
      headerRow.values = ["Fecha y hora vale", "Comensal", "Casino", "Opci\xF3n", "D\xEDa Servicio", "C\xF3digo QR"];
      headerRow.height = 26;
      headerRow.eachCell((c) => {
        c.font = EX.fontHeader;
        c.fill = EX.headerBlueFill;
        c.alignment = EX.center;
        c.border = EX.borderGold;
      });
      const sorted = filtered.sort((a, b) => {
        const ma = minutaById.get(a.minutaId);
        const mb = minutaById.get(b.minutaId);
        return ma.fecha.localeCompare(mb.fecha);
      });
      sorted.forEach((p, idx) => {
        const m = minutaById.get(p.minutaId);
        const u = userById.get(p.userId);
        const c = m ? casinoById.get(m.casinoId) : null;
        const opciones = m ? [m.opcion1, m.opcion2, m.opcion3, m.opcion4, m.opcion5] : [];
        const opcionTexto = opciones[p.opcionSeleccionada - 1] || `Opci\xF3n ${p.opcionSeleccionada}`;
        const stamp = p.impresoEn ? new Date(p.impresoEn) : p.createdAt ? new Date(p.createdAt) : null;
        const fechaConsumoStr = stamp ? `${stamp.toLocaleDateString("es-CL")} ${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}` : "\u2014";
        const comensalLabel = p.tipo === "visita" ? `VISITA \u2014 ${p.nombreVisita || ""}` : u ? `${u.rut} \u2014 ${u.nombre} ${u.apellido}` : "\u2014";
        const r = ws.addRow({
          fechaConsumo: fechaConsumoStr,
          comensal: comensalLabel,
          casino: c?.nombre || "\u2014",
          opcion: opcionTexto,
          fechaServ: m?.fecha || "\u2014",
          qr: p.codigoQr || "\u2014"
        });
        const isEven = idx % 2 === 0;
        r.eachCell((cell) => {
          cell.font = EX.fontNormal;
          cell.fill = isEven ? EX.whiteFill : EX.grayFill;
          cell.border = EX.borderThin;
          cell.alignment = EX.left;
        });
      });
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=Consumo_${fechaDesde}_a_${fechaHasta}.xlsx`);
      return res.send(Buffer.from(buf));
    } catch (error) {
      console.error("Consumo detalle error:", error);
      return res.status(500).json({ message: "Error al generar reporte" });
    }
  });
  app2.get("/api/reportes/minutas-detalle", requireAdmin, async (req, res) => {
    try {
      const { mes } = req.query;
      const scope = await getScopedCasinoFilter(req, req.query.casinoId);
      if (scope.allowedIds && scope.allowedIds.size === 0) {
        return res.status(403).json({ message: "Sin acceso al casino solicitado" });
      }
      if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ message: "mes requerido (YYYY-MM)" });
      const allMinutas = await storage.getAllMinutas();
      const allCasinos = await storage.getCasinos();
      const casinoById = new Map(allCasinos.map((c) => [c.id, c]));
      const filtered = allMinutas.filter((m) => {
        if (!m.fecha.startsWith(mes)) return false;
        if (scope.allowedIds && !scope.allowedIds.has(m.casinoId)) return false;
        return true;
      }).sort((a, b) => a.fecha.localeCompare(b.fecha));
      const wb = new ExcelJS.Workbook();
      wb.creator = "BuenaMezcla";
      const ws = wb.addWorksheet("Minutas del mes", { properties: { tabColor: { argb: "FFD4A843" } } });
      ws.columns = [
        { header: "D\xEDa Servicio", key: "fecha", width: 14 },
        { header: "Casino", key: "casino", width: 26 },
        { header: "Familia", key: "familia", width: 16 },
        { header: "Opci\xF3n N\xB0", key: "num", width: 12 },
        { header: "Preparaci\xF3n", key: "prep", width: 60 }
      ];
      buildHeader(ws, `MINUTAS DETALLE DEL MES \u2014 ${mes}`);
      const headerRow = ws.getRow(4);
      headerRow.values = ["D\xEDa Servicio", "Casino", "Familia", "Opci\xF3n N\xB0", "Preparaci\xF3n"];
      headerRow.height = 26;
      headerRow.eachCell((c) => {
        c.font = EX.fontHeader;
        c.fill = EX.headerBlueFill;
        c.alignment = EX.center;
        c.border = EX.borderGold;
      });
      let idx = 0;
      filtered.forEach((m) => {
        const opts = [m.opcion1, m.opcion2, m.opcion3, m.opcion4, m.opcion5];
        const c = casinoById.get(m.casinoId);
        opts.forEach((op, i) => {
          if (!op) return;
          const r = ws.addRow({
            fecha: m.fecha,
            casino: c?.nombre || "\u2014",
            familia: m.familia || "\u2014",
            num: i + 1,
            prep: op
          });
          const isEven = idx % 2 === 0;
          r.eachCell((cell, col) => {
            cell.font = EX.fontNormal;
            cell.fill = isEven ? EX.whiteFill : EX.grayFill;
            cell.border = EX.borderThin;
            cell.alignment = col === 4 ? EX.center : EX.left;
          });
          idx++;
        });
      });
      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=Minutas_${mes}.xlsx`);
      return res.send(Buffer.from(buf));
    } catch (error) {
      console.error("Minutas detalle error:", error);
      return res.status(500).json({ message: "Error al generar reporte" });
    }
  });
  app2.get("/api/seed", async (_req, res) => {
    try {
      await autoSeed();
      return res.json({ message: "Seed ejecutado" });
    } catch (error) {
      console.error("Seed error:", error);
      return res.status(500).json({ message: "Error al crear datos de prueba" });
    }
  });
  registerSyncRoutes(app2);
  function requireAdminStrict(req, res, next) {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    storage.getUser(userId).then((u) => {
      if (!u || u.role !== "admin") return res.status(403).json({ message: "Solo administradores" });
      req.currentUser = u;
      next();
    }).catch(() => res.status(500).json({ message: "Error de autenticaci\xF3n" }));
  }
  app2.get("/api/totems", requireAdminStrict, async (_req, res) => {
    try {
      const list = await db.select().from(totems);
      const now = Date.now();
      const enriched = list.map((t) => {
        const last = t.ultimaConexion ? new Date(t.ultimaConexion).getTime() : 0;
        const ageMs = now - last;
        let estado = "offline";
        if (last && ageMs < 2 * 60 * 1e3) estado = "online";
        else if (last && ageMs < 10 * 60 * 1e3) estado = "intermitente";
        return { ...t, estado, secretHash: void 0 };
      });
      res.json(enriched);
    } catch (err) {
      console.error("list totems error", err);
      res.status(500).json({ message: "Error al listar t\xF3tems" });
    }
  });
  app2.put("/api/totems/:id", requireAdminStrict, async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, notas, activo } = req.body;
      const updateData = {};
      if (nombre !== void 0) updateData.nombre = nombre;
      if (notas !== void 0) updateData.notas = notas;
      if (activo !== void 0) updateData.activo = activo;
      const [updated] = await db.update(totems).set(updateData).where(eqOp(totems.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "No encontrado" });
      res.json({ ...updated, secretHash: void 0 });
    } catch (err) {
      res.status(500).json({ message: "Error al actualizar t\xF3tem" });
    }
  });
  app2.delete("/api/totems/:id", requireAdminStrict, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(totems).where(eqOp(totems.id, id));
      res.json({ message: "T\xF3tem eliminado" });
    } catch (err) {
      res.status(500).json({ message: "Error al eliminar t\xF3tem" });
    }
  });
  app2.post("/api/totems/bootstrap-token", requireAdminStrict, async (req, res) => {
    try {
      const u = req.currentUser;
      const { casinoId } = req.body;
      if (!casinoId) return res.status(400).json({ message: "casinoId requerido" });
      const casino = await storage.getCasino(casinoId);
      if (!casino) return res.status(404).json({ message: "Casino no existe" });
      const token = issueBootstrapToken(u?.rut || "admin", casinoId);
      res.json({
        token,
        casino: { id: casino.id, nombre: casino.nombre },
        expiresInfo: "V\xE1lido por 1 hora. Se invalida al usarse (single-use)."
      });
    } catch (err) {
      res.status(500).json({ message: "Error al generar token" });
    }
  });
  app2.get("/api/totem-releases", requireAdminStrict, async (_req, res) => {
    try {
      const list = await db.select().from(totemReleases).orderBy(sqlOp`created_at DESC`);
      res.json(list);
    } catch (err) {
      res.status(500).json({ message: "Error al listar versiones" });
    }
  });
  app2.post("/api/totem-releases", requireAdminStrict, async (req, res) => {
    try {
      const { version, url, sha256, notas, obligatoria, publicada } = req.body;
      if (!version || !url || !sha256) return res.status(400).json({ message: "Faltan campos" });
      const [r] = await db.insert(totemReleases).values({
        version,
        url,
        sha256,
        notas: notas ?? null,
        obligatoria: !!obligatoria,
        publicada: publicada !== false
      }).returning();
      res.status(201).json(r);
    } catch (err) {
      if (err?.code === "23505") return res.status(409).json({ message: "Versi\xF3n duplicada" });
      res.status(500).json({ message: "Error al crear versi\xF3n" });
    }
  });
  app2.put("/api/totem-releases/:id", requireAdminStrict, async (req, res) => {
    try {
      const { id } = req.params;
      const { publicada, obligatoria, notas, url, sha256 } = req.body;
      const upd = {};
      if (publicada !== void 0) upd.publicada = publicada;
      if (obligatoria !== void 0) upd.obligatoria = obligatoria;
      if (notas !== void 0) upd.notas = notas;
      if (url !== void 0) upd.url = url;
      if (sha256 !== void 0) upd.sha256 = sha256;
      const [r] = await db.update(totemReleases).set(upd).where(eqOp(totemReleases.id, id)).returning();
      if (!r) return res.status(404).json({ message: "No encontrado" });
      res.json(r);
    } catch (err) {
      res.status(500).json({ message: "Error al actualizar versi\xF3n" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs3 from "fs";
import * as path3 from "path";
var app = express();
var log = console.log;
function setupNoCache(app2) {
  app2.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.set("Surrogate-Control", "no-store");
    next();
  });
}
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path4 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    const SENSITIVE = [
      "/api/totems/bootstrap-token",
      "/api/totem/register",
      "/api/auth/login"
    ];
    res.on("finish", () => {
      if (!path4.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      const isSensitive = SENSITIVE.some((p) => path4.startsWith(p));
      if (capturedJsonResponse && !isSensitive) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      } else if (isSensitive) {
        logLine += ` :: [redacted]`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path3.resolve(process.cwd(), "app.json");
    const appJsonContent = fs3.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path3.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs3.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs3.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const pwaDist = path3.resolve(process.cwd(), "pwa", "dist");
  const pwaBuild = path3.join(pwaDist, "index.html");
  const pwaBuildExists = fs3.existsSync(pwaBuild);
  if (pwaBuildExists) {
    log("Serving PWA from pwa/dist");
    const noCacheFiles = /* @__PURE__ */ new Set(["index.html", "sw.js", "manifest.json", "manifest.webmanifest"]);
    app2.use(express.static(pwaDist, {
      setHeaders(res, filePath) {
        const base = path3.basename(filePath);
        if (noCacheFiles.has(base) || filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      }
    }));
    app2.use("/assets", express.static(path3.resolve(process.cwd(), "assets")));
    app2.use(express.static(path3.resolve(process.cwd(), "public")));
    app2.use(express.static(path3.resolve(process.cwd(), "static-build")));
    app2.use((req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/admin") || req.path.startsWith("/totem/")) {
        return next();
      }
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(pwaBuild);
    });
    return;
  }
  const templatePath = path3.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs3.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", express.static(path3.resolve(process.cwd(), "assets")));
  app2.use(express.static(path3.resolve(process.cwd(), "public")));
  app2.use(express.static(path3.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  app.set("trust proxy", 1);
  setupCors(app);
  setupNoCache(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      log(`express server serving on port ${port}`);
      startCronJobs();
    }
  );
})();
