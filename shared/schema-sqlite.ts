// SQLite mirror of shared/schema.ts used by the totem (offline) backend.
// Same column names + same value types as the Postgres schema, so the storage
// layer can be written generically. Booleans are stored as INTEGER 0/1, dates
// as ISO strings, timestamps as ms epoch integers.
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

const syncCols = {
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  syncVersion: integer("sync_version").notNull().default(0),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  rut: text("rut").notNull().unique(),
  password: text("password").notNull(),
  nombre: text("nombre").notNull(),
  apellido: text("apellido").notNull(),
  telefono: text("telefono"),
  role: text("role").notNull().default("comensal"),
  casinoId: text("casino_id"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  ...syncCols,
});

export const casinos = sqliteTable("casinos", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  direccion: text("direccion"),
  comensalesDiarios: integer("comensales_diarios").notNull().default(0),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  ...syncCols,
});

export const familias = sqliteTable("familias", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  color: text("color").notNull().default("#D4A843"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  ...syncCols,
});

export const minutas = sqliteTable("minutas", {
  id: text("id").primaryKey(),
  casinoId: text("casino_id").notNull(),
  fecha: text("fecha").notNull(), // YYYY-MM-DD
  familia: text("familia").notNull().default("almuerzo"),
  opcion1: text("opcion_1").notNull(),
  opcion2: text("opcion_2").notNull(),
  opcion3: text("opcion_3").notNull(),
  opcion4: text("opcion_4"),
  opcion5: text("opcion_5"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  ...syncCols,
});

export const periodos = sqliteTable("periodos", {
  id: text("id").primaryKey(),
  casinoId: text("casino_id").notNull(),
  nombre: text("nombre").notNull(),
  fechaInicio: integer("fecha_inicio", { mode: "timestamp_ms" }).notNull(),
  fechaFin: integer("fecha_fin", { mode: "timestamp_ms" }).notNull(),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  ...syncCols,
});

export const pedidos = sqliteTable("pedidos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  minutaId: text("minuta_id").notNull(),
  opcionSeleccionada: integer("opcion_seleccionada").notNull(),
  tipo: text("tipo").notNull().default("seleccion"),
  nombreVisita: text("nombre_visita"),
  asignadoPorDefecto: integer("asignado_por_defecto", { mode: "boolean" }).notNull().default(false),
  codigoQr: text("codigo_qr"),
  origenTotemId: text("origen_totem_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  ...syncCols,
});

// ── Totem-only metadata ────────────────────────────────────────────────────
// Outbox: every local write to a syncable table (CREATE/UPDATE/DELETE) appends
// here so the sync worker can push it up when internet returns.
export const syncOutbox = sqliteTable("sync_outbox", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  op: text("op").notNull(), // upsert | delete
  payload: text("payload").notNull(), // JSON of the full row
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  acked: integer("acked", { mode: "boolean" }).notNull().default(false),
});

// Per-table cursor for the pull side (last seen updatedAt).
export const syncState = sqliteTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Local config bound to the totem identity (set once during registration).
export const totemConfig = sqliteTable("totem_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Mirror types so storage and routes can use the same shapes
export type SqliteUser = typeof users.$inferSelect;
export type SqliteCasino = typeof casinos.$inferSelect;
export type SqliteFamilia = typeof familias.$inferSelect;
export type SqliteMinuta = typeof minutas.$inferSelect;
export type SqlitePedido = typeof pedidos.$inferSelect;
export type SqlitePeriodo = typeof periodos.$inferSelect;
export type SyncOutboxRow = typeof syncOutbox.$inferSelect;
