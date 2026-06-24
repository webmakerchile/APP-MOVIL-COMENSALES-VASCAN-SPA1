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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "comensal",
  "interlocutor",
  "encargado_casino",
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
  fechaNacimiento: date("fecha_nacimiento"),
  passwordChangeRequired: boolean("password_change_required").notNull().default(true),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  ...syncCols,
});

export const usuarioCasinos = pgTable("usuario_casinos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  casinoId: varchar("casino_id")
    .notNull()
    .references(() => casinos.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const casinos = pgTable("casinos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nombre: text("nombre").notNull(),
  direccion: text("direccion"),
  comensalesDiarios: integer("comensales_diarios").notNull().default(0),
  permitirCambioClaveTotem: boolean("permitir_cambio_clave_totem").notNull().default(false),
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
  fechaServicioInicio: date("fecha_servicio_inicio"),
  fechaServicioFin: date("fecha_servicio_fin"),
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
  impresoEn: timestamp("impreso_en"),
  // Gestión diaria (módulo admin): acción tomada sobre un inscrito que NO pasó
  // por el tótem a la hora de corte. null = sin gestión; 'delivery' = se envía
  // a domicilio/puesto; 'baja' = se da de baja (no consume, descontar del conteo).
  gestionEstado: text("gestion_estado"),
  createdAt: timestamp("created_at").defaultNow(),
  ...syncCols,
}, (t) => ({
  // Defensa a nivel BD: un comensal NO puede tener dos pedidos vivos para la
  // misma minuta. Garantiza unicidad incluso si una ruta de aplicación falla
  // o si el tótem Windows offline crea un duplicado por race condition.
  // Partial index sobre deleted_at IS NULL para permitir tombstones múltiples.
  // Se excluyen los vales de visita (tipo='visita'): un mismo interlocutor/staff
  // emite MÚLTIPLES visitas el mismo día sobre la misma minuta (todas quedan
  // bajo su userId), por lo que NO deben colisionar contra esta restricción.
  uniqUserMinutaActive: uniqueIndex("uniq_pedidos_user_minuta_active")
    .on(t.userId, t.minutaId)
    .where(sql`deleted_at IS NULL AND tipo <> 'visita'`),
}));

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
  fechaNacimiento: true,
  passwordChangeRequired: true,
});

export const loginSchema = z.object({
  rut: z.string().min(1),
  password: z.string().min(1),
});

export const insertCasinoSchema = createInsertSchema(casinos).pick({
  nombre: true,
  direccion: true,
  comensalesDiarios: true,
  permitirCambioClaveTotem: true,
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
  fechaServicioInicio: true,
  fechaServicioFin: true,
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
export type UsuarioCasino = typeof usuarioCasinos.$inferSelect;

// List of syncable tables in canonical order (master-first; pedidos last because of FKs)
export const SYNC_TABLES = ["casinos", "familias", "users", "usuario_casinos", "minutas", "periodos", "pedidos"] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];
