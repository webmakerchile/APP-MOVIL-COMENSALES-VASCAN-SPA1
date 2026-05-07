import { eq, and } from "drizzle-orm";
import { db, DB_MODE, sqlite } from "./db";

// In totem mode, every local write of a pedido must be enqueued in the
// sync_outbox so the background worker can push it to the cloud.
// Synchronous version (used inside SQLite transactions). Throws on failure
// so the surrounding transaction rolls back — guaranteeing no orphan pedidos.
function enqueuePedidoOutboxSync(p: any, op: "insert" | "update") {
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
  };
  sqlite.prepare(
    "INSERT INTO sync_outbox(table_name, record_id, op, payload, created_at) VALUES(?, ?, ?, ?, ?)"
  ).run("pedidos", p.id, op, JSON.stringify(payload), Date.now());
}
import {
  users,
  casinos,
  familias,
  minutas,
  pedidos,
  periodos,
  type User,
  type InsertUser,
  type Casino,
  type InsertCasino,
  type Familia,
  type InsertFamilia,
  type Minuta,
  type InsertMinuta,
  type Pedido,
  type InsertPedido,
  type Periodo,
  type InsertPeriodo,
} from "@shared/schema";

// ── Sync metadata helpers ──────────────────────────────────────────────────
// Every write to a syncable table must bump updatedAt + syncVersion so the
// totem pull-sync can detect changes.
function touch<T extends Record<string, any>>(data: T): T & { updatedAt: Date; syncVersion: number } {
  return { ...data, updatedAt: new Date(), syncVersion: Date.now() };
}

function tombstone() {
  return { activo: false as const, deletedAt: new Date(), updatedAt: new Date(), syncVersion: Date.now() };
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByRut(rut: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser & { activo?: boolean }>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getCasinos(): Promise<Casino[]>;
  getAllCasinos(): Promise<Casino[]>;
  getCasino(id: string): Promise<Casino | undefined>;
  createCasino(casino: InsertCasino): Promise<Casino>;
  updateCasino(id: string, data: Partial<InsertCasino & { activo?: boolean }>): Promise<Casino | undefined>;
  deleteCasino(id: string): Promise<boolean>;
  getMinutasByCasino(casinoId: string): Promise<Minuta[]>;
  getAllMinutas(): Promise<Minuta[]>;
  getMinuta(id: string): Promise<Minuta | undefined>;
  createMinuta(minuta: InsertMinuta): Promise<Minuta>;
  updateMinuta(id: string, data: Partial<InsertMinuta & { activo?: boolean }>): Promise<Minuta | undefined>;
  deleteMinuta(id: string): Promise<boolean>;
  getPedidosByUser(userId: string): Promise<Pedido[]>;
  getPedidoByUserAndMinuta(userId: string, minutaId: string): Promise<Pedido | undefined>;
  createPedido(pedido: InsertPedido & { codigoQr?: string }): Promise<Pedido>;
  updatePedido(id: string, data: Partial<InsertPedido & { codigoQr?: string | null }>): Promise<Pedido | undefined>;
  getPedidosByMinuta(minutaId: string): Promise<Pedido[]>;
  getAllFamilias(): Promise<Familia[]>;
  createFamilia(familia: InsertFamilia): Promise<Familia>;
  updateFamilia(id: string, data: Partial<InsertFamilia & { activo?: boolean }>): Promise<Familia | undefined>;
  deleteFamilia(id: string): Promise<boolean>;
  getPeriodosByCasino(casinoId: string): Promise<Periodo[]>;
  getAllPeriodos(): Promise<Periodo[]>;
  getPeriodo(id: string): Promise<Periodo | undefined>;
  createPeriodo(periodo: InsertPeriodo): Promise<Periodo>;
  updatePeriodo(id: string, data: Partial<InsertPeriodo & { activo?: boolean }>): Promise<Periodo | undefined>;
  deletePeriodo(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // ── Users ──
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByRut(rut: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.rut, rut));
    return user;
  }
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(touch(insertUser)).returning();
    return user;
  }
  async updateUser(id: string, data: Partial<InsertUser & { activo?: boolean }>): Promise<User | undefined> {
    const [user] = await db.update(users).set(touch(data)).where(eq(users.id, id)).returning();
    return user;
  }
  async deleteUser(id: string): Promise<boolean> {
    // Soft-delete: tombstone so totems can mirror the deletion via pull-sync.
    const [u] = await db.update(users).set(tombstone()).where(eq(users.id, id)).returning();
    return !!u;
  }

  // ── Casinos ──
  async getCasinos(): Promise<Casino[]> {
    return db.select().from(casinos).where(eq(casinos.activo, true));
  }
  async getAllCasinos(): Promise<Casino[]> {
    return db.select().from(casinos);
  }
  async getCasino(id: string): Promise<Casino | undefined> {
    const [casino] = await db.select().from(casinos).where(eq(casinos.id, id));
    return casino;
  }
  async createCasino(insertCasino: InsertCasino): Promise<Casino> {
    const [casino] = await db.insert(casinos).values(touch(insertCasino)).returning();
    return casino;
  }
  async updateCasino(id: string, data: Partial<InsertCasino & { activo?: boolean }>): Promise<Casino | undefined> {
    const [casino] = await db.update(casinos).set(touch(data)).where(eq(casinos.id, id)).returning();
    return casino;
  }
  async deleteCasino(id: string): Promise<boolean> {
    const [casino] = await db.update(casinos).set(tombstone()).where(eq(casinos.id, id)).returning();
    return !!casino;
  }
  async hardDeleteCasino(id: string): Promise<boolean> {
    const [casino] = await db.delete(casinos).where(eq(casinos.id, id)).returning();
    return !!casino;
  }

  // ── Minutas ──
  async getMinutasByCasino(casinoId: string): Promise<Minuta[]> {
    return db.select().from(minutas).where(and(eq(minutas.casinoId, casinoId), eq(minutas.activo, true)));
  }
  async getAllMinutasByCasino(casinoId: string): Promise<Minuta[]> {
    return db.select().from(minutas).where(eq(minutas.casinoId, casinoId));
  }
  async getAllMinutas(): Promise<Minuta[]> {
    return db.select().from(minutas);
  }
  async getMinuta(id: string): Promise<Minuta | undefined> {
    const [minuta] = await db.select().from(minutas).where(eq(minutas.id, id));
    return minuta;
  }
  async createMinuta(insertMinuta: InsertMinuta): Promise<Minuta> {
    const [minuta] = await db.insert(minutas).values(touch(insertMinuta)).returning();
    return minuta;
  }
  async updateMinuta(id: string, data: Partial<InsertMinuta & { activo?: boolean }>): Promise<Minuta | undefined> {
    const [minuta] = await db.update(minutas).set(touch(data)).where(eq(minutas.id, id)).returning();
    return minuta;
  }
  async deleteMinuta(id: string): Promise<boolean> {
    const [minuta] = await db.update(minutas).set(tombstone()).where(eq(minutas.id, id)).returning();
    return !!minuta;
  }

  // ── Pedidos ──
  async getAllPedidos(): Promise<Pedido[]> {
    return db.select().from(pedidos);
  }
  async getPedidosByUser(userId: string): Promise<Pedido[]> {
    return db.select().from(pedidos).where(eq(pedidos.userId, userId));
  }
  async getPedidoByUserAndMinuta(userId: string, minutaId: string): Promise<Pedido | undefined> {
    const [pedido] = await db.select().from(pedidos).where(and(eq(pedidos.userId, userId), eq(pedidos.minutaId, minutaId)));
    return pedido;
  }
  async createPedido(insertPedido: InsertPedido & { codigoQr?: string; id?: string; origenTotemId?: string; createdAt?: Date }): Promise<Pedido> {
    const values: any = touch(insertPedido);
    // Totem mode: SQLite has no auto uuid default; generate one and stamp origin.
    if (DB_MODE === "totem" && !values.id) values.id = require("crypto").randomUUID();
    if (DB_MODE === "totem" && !values.origenTotemId) {
      try {
        const row = sqlite!.prepare("SELECT value FROM totem_config WHERE key = ?").get("totem_id") as any;
        if (row?.value) values.origenTotemId = row.value;
      } catch {}
    }

    // In totem mode, write pedido + outbox enqueue inside a single SQLite
    // transaction. If either fails the whole operation is rolled back so we
    // can never have a local pedido without its outbox row (which would cause
    // permanent cloud divergence).
    if (DB_MODE === "totem" && sqlite) {
      const tx = sqlite.transaction((v: any) => {
        const [p] = (db.insert(pedidos).values(v).returning() as any).all
          ? (db.insert(pedidos).values(v).returning() as any).all()
          : [];
        // Drizzle better-sqlite3 returns sync results; if the above pattern
        // doesn't yield rows we fall back to a manual select.
        const inserted = p ?? (sqlite!.prepare("SELECT * FROM pedidos WHERE id = ?").get(v.id) as any);
        enqueuePedidoOutboxSync(inserted, "insert");
        return inserted;
      });
      const pedido = tx(values);
      return pedido as Pedido;
    }

    const [pedido] = await db.insert(pedidos).values(values).returning();
    return pedido;
  }
  async updatePedido(id: string, data: Partial<InsertPedido & { codigoQr?: string | null }>): Promise<Pedido | undefined> {
    if (DB_MODE === "totem" && sqlite) {
      const tx = sqlite.transaction((d: any) => {
        const [p] = (db.update(pedidos).set(d).where(eq(pedidos.id, id)).returning() as any).all
          ? (db.update(pedidos).set(d).where(eq(pedidos.id, id)).returning() as any).all()
          : [];
        const updated = p ?? (sqlite!.prepare("SELECT * FROM pedidos WHERE id = ?").get(id) as any);
        if (updated) enqueuePedidoOutboxSync(updated, "update");
        return updated;
      });
      return tx(touch(data));
    }
    const [pedido] = await db.update(pedidos).set(touch(data)).where(eq(pedidos.id, id)).returning();
    return pedido;
  }
  async getPedidosByMinuta(minutaId: string): Promise<Pedido[]> {
    return db.select().from(pedidos).where(eq(pedidos.minutaId, minutaId));
  }

  // ── Familias ──
  async getAllFamilias(): Promise<Familia[]> {
    return db.select().from(familias);
  }
  async createFamilia(insertFamilia: InsertFamilia): Promise<Familia> {
    const [familia] = await db.insert(familias).values(touch(insertFamilia)).returning();
    return familia;
  }
  async updateFamilia(id: string, data: Partial<InsertFamilia & { activo?: boolean }>): Promise<Familia | undefined> {
    const [familia] = await db.update(familias).set(touch(data)).where(eq(familias.id, id)).returning();
    return familia;
  }
  async deleteFamilia(id: string): Promise<boolean> {
    const [familia] = await db.update(familias).set(tombstone()).where(eq(familias.id, id)).returning();
    return !!familia;
  }

  // ── Periodos ──
  async getPeriodosByCasino(casinoId: string): Promise<Periodo[]> {
    return db.select().from(periodos).where(eq(periodos.casinoId, casinoId));
  }
  async getAllPeriodos(): Promise<Periodo[]> {
    return db.select().from(periodos);
  }
  async getPeriodo(id: string): Promise<Periodo | undefined> {
    const [periodo] = await db.select().from(periodos).where(eq(periodos.id, id));
    return periodo;
  }
  async createPeriodo(insertPeriodo: InsertPeriodo): Promise<Periodo> {
    const [periodo] = await db.insert(periodos).values(touch(insertPeriodo)).returning();
    return periodo;
  }
  async updatePeriodo(id: string, data: Partial<InsertPeriodo & { activo?: boolean }>): Promise<Periodo | undefined> {
    const [periodo] = await db.update(periodos).set(touch(data)).where(eq(periodos.id, id)).returning();
    return periodo;
  }
  async deletePeriodo(id: string): Promise<boolean> {
    const [periodo] = await db.update(periodos).set(tombstone()).where(eq(periodos.id, id)).returning();
    return !!periodo;
  }
}

export const storage = new DatabaseStorage();
