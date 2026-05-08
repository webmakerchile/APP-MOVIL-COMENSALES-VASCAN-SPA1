-- DDL bootstrap for the totem's local SQLite database.
-- Mirrors shared/schema-sqlite.ts. Idempotent: uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS casinos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  comensales_diarios INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS familias (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#D4A843',
  activo INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  rut TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  telefono TEXT,
  role TEXT NOT NULL DEFAULT 'comensal',
  casino_id TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS minutas (
  id TEXT PRIMARY KEY,
  casino_id TEXT NOT NULL,
  fecha TEXT NOT NULL,
  familia TEXT NOT NULL DEFAULT 'almuerzo',
  opcion_1 TEXT NOT NULL,
  opcion_2 TEXT NOT NULL,
  opcion_3 TEXT NOT NULL,
  opcion_4 TEXT,
  opcion_5 TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS periodos (
  id TEXT PRIMARY KEY,
  casino_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  fecha_inicio INTEGER NOT NULL,
  fecha_fin INTEGER NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pedidos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  minuta_id TEXT NOT NULL,
  opcion_seleccionada INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'seleccion',
  nombre_visita TEXT,
  asignado_por_defecto INTEGER NOT NULL DEFAULT 0,
  codigo_qr TEXT,
  origen_totem_id TEXT,
  created_at INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  sync_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  op TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  acked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_outbox_unacked ON sync_outbox(acked, id);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS totem_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_minutas_casino_fecha ON minutas(casino_id, fecha);
CREATE INDEX IF NOT EXISTS idx_pedidos_minuta ON pedidos(minuta_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_user ON pedidos(user_id);
