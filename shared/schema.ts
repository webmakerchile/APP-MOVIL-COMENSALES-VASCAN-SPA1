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
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "comensal",
  "interlocutor",
]);

// Sync helper columns shared by all syncable tables.
// updatedAt: last modification timestamp (used as sync cursor).
// deletedAt: tombstone marker (null = alive).
// syncVersion: monotonic ms counter, bumped on every write (used for ordering).
const syncCols = {
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  syncVersion: bigint("sync_version", { mode: "number" }).notNull().default(0),
};

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  rut: text("rut").notNull().unique(),
  password: text("password").notNull(),
  nombre: text("nombre").notNull(),
  apellido: text("apellido").notNull(),
  telefono: text("telefono"),
  role: userRoleEnum("role").notNull().default("comensal"),
  casinoId: varchar("casino_id").references(() => casinos.id),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  ...syncCols,
});

export const casinos = pgTable("casinos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nombre: text("nombre").notNull(),
  direccion: text("direccion"),
  comensalesDiarios: integer("comensales_diarios").notNull().default(0),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  ...syncCols,
});

export const familias = pgTable("familias", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nombre: text("nombre").notNull().unique(),
  color: text("color").notNull().default("#D4A843"),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  ...syncCols,
});

export const minutas = pgTable("minutas", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  casinoId: varchar("casino_id")
    .notNull()
    .references(() => casinos.id),
  fecha: date("fecha").notNull(),
  familia: text("familia").notNull().default("almuerzo"),
  opcion1: text("opcion_1").notNull(),
  opcion2: text("opcion_2").notNull(),
  opcion3: text("opcion_3").notNull(),
  opcion4: text("opcion_4"),
  opcion5: text("opcion_5"),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  ...syncCols,
});

export const periodos = pgTable("periodos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  casinoId: varchar("casino_id")
    .notNull()
    .references(() => casinos.id),
  nombre: text("nombre").notNull(),
  fechaInicio: timestamp("fecha_inicio").notNull(),
  fechaFin: timestamp("fecha_fin").notNull(),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  ...syncCols,
});

export const pedidos = pgTable("pedidos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  minutaId: varchar("minuta_id")
    .notNull()
    .references(() => minutas.id),
  opcionSeleccionada: integer("opcion_seleccionada").notNull(),
  tipo: text("tipo").notNull().default("seleccion"),
  nombreVisita: text("nombre_visita"),
  asignadoPorDefecto: boolean("asignado_por_defecto")
    .notNull()
    .default(false),
  codigoQr: text("codigo_qr"),
  origenTotemId: varchar("origen_totem_id"),
  createdAt: timestamp("created_at").defaultNow(),
  ...syncCols,
});

// ── Fleet management (cloud-only) ──────────────────────────────────────────
export const totems = pgTable("totems", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const totemReleases = pgTable("totem_releases", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  version: text("version").notNull().unique(),
  url: text("url").notNull(),
  sha256: text("sha256").notNull(),
  notas: text("notas"),
  obligatoria: boolean("obligatoria").notNull().default(false),
  publicada: boolean("publicada").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Schemas / types ────────────────────────────────────────────────────────
export const insertUserSchema = createInsertSchema(users).pick({
  rut: true,
  password: true,
  nombre: true,
  apellido: true,
  telefono: true,
  role: true,
  casinoId: true,
});

export const loginSchema = z.object({
  rut: z.string().min(1),
  password: z.string().min(1),
});

export const insertCasinoSchema = createInsertSchema(casinos).pick({
  nombre: true,
  direccion: true,
  comensalesDiarios: true,
});

export const insertFamiliaSchema = createInsertSchema(familias).pick({
  nombre: true,
  color: true,
});

export const insertMinutaSchema = createInsertSchema(minutas).pick({
  casinoId: true,
  fecha: true,
  familia: true,
  opcion1: true,
  opcion2: true,
  opcion3: true,
  opcion4: true,
  opcion5: true,
});

export const insertPedidoSchema = createInsertSchema(pedidos).pick({
  userId: true,
  minutaId: true,
  opcionSeleccionada: true,
  codigoQr: true,
  tipo: true,
  nombreVisita: true,
});

export const insertPeriodoSchema = createInsertSchema(periodos).pick({
  casinoId: true,
  nombre: true,
  fechaInicio: true,
  fechaFin: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Casino = typeof casinos.$inferSelect;
export type InsertCasino = z.infer<typeof insertCasinoSchema>;
export type Familia = typeof familias.$inferSelect;
export type InsertFamilia = z.infer<typeof insertFamiliaSchema>;
export type Minuta = typeof minutas.$inferSelect;
export type InsertMinuta = z.infer<typeof insertMinutaSchema>;
export type Pedido = typeof pedidos.$inferSelect;
export type InsertPedido = z.infer<typeof insertPedidoSchema>;
export type Periodo = typeof periodos.$inferSelect;
export type InsertPeriodo = z.infer<typeof insertPeriodoSchema>;
export type Totem = typeof totems.$inferSelect;
export type TotemRelease = typeof totemReleases.$inferSelect;

// List of syncable tables in canonical order (master-first; pedidos last because of FKs)
export const SYNC_TABLES = ["casinos", "familias", "users", "minutas", "periodos", "pedidos"] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];
