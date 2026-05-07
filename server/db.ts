// Dual-mode database layer.
//   DB_MODE=cloud  → Postgres (Replit / Neon)        [default]
//   DB_MODE=totem  → local SQLite file at TOTEM_DB_PATH
//
// The two backends export the same `db` query builder API thanks to drizzle's
// uniform interface. Storage code that uses select/insert/update/delete plus
// `eq`/`and` from `drizzle-orm` works on both with no changes.
import * as fs from "fs";
import * as path from "path";

export type DbMode = "cloud" | "totem";
export const DB_MODE: DbMode = (process.env.DB_MODE === "totem" ? "totem" : "cloud");

let _db: any;
let _pool: any;
let _schema: any;
let _sqlite: any;

if (DB_MODE === "cloud") {
  const { Pool } = require("pg");
  const { drizzle } = require("drizzle-orm/node-postgres");
  const schema = require("@shared/schema");
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in cloud mode");
  }
  _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  _db = drizzle(_pool, { schema });
  _schema = schema;
} else {
  const Database = require("better-sqlite3");
  const { drizzle } = require("drizzle-orm/better-sqlite3");
  const schema = require("@shared/schema-sqlite");

  const dbPath = process.env.TOTEM_DB_PATH || path.resolve(process.cwd(), "totem-data", "totem.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  _sqlite = new Database(dbPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _sqlite.pragma("synchronous = NORMAL");

  // Bootstrap tables on first run (no drizzle-kit on totems).
  const ddl = fs.readFileSync(path.resolve(__dirname, "../shared/schema-sqlite.sql"), "utf-8");
  _sqlite.exec(ddl);

  _db = drizzle(_sqlite, { schema });
  _schema = schema;
}

export const db = _db;
export const pool = _pool; // undefined in totem mode
export const sqlite = _sqlite; // undefined in cloud mode
export const schema = _schema;
