import { eq, and, isNull, isNotNull, ne } from "drizzle-orm";
import {
  db,
  DB_MODE,
  sqlite,
  users,
  casinos,
  familias,
  minutas,
  pedidos,
  periodos,
  usuarioCasinos,
} from "./db";

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
    // impresoEn: timestamp en ms cuando el comensal retiró el vale impreso.
    // Sin esto el cloud no aprende que el vale ya se entregó y permitiría
    // que un re-login en otro dispositivo del mismo casino vuelva a imprimir.
    impresoEn: p.impresoEn == null ? null : (typeof p.impresoEn === "number" ? p.impresoEn : new Date(p.impresoEn).getTime()),
  };
  sqlite.prepare(
    "INSERT INTO sync_outbox(table_name, record_id, op, payload, created_at) VALUES(?, ?, ?, ?, ?)"
  ).run("pedidos", p.id, op, JSON.stringify(payload), Date.now());
}
import {
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
  getComensalesByCasino(casinoId: string): Promise<User[]>;
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
  setGestionEstado(id: string, estado: string | null): Promise<Pedido | undefined>;
  getPedidoById(id: string): Promise<Pedido | undefined>;
  deletePedido(id: string): Promise<boolean>;
  getPedidosByMinuta(minutaId: string): Promise<Pedido[]>;
  getAnuladosByMinuta(minutaId: string): Promise<Pedido[]>;
  markPedidoImpreso(id: string): Promise<Pedido | undefined>;
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
  // Convierte cualquier RUT a su forma canónica "12345678-5" / "12345678-K":
  // sin puntos, con guion y dígito verificador en MAYÚSCULA. Si la entrada no
  // parece un RUT, la devuelve tal cual (trim). Única fuente de verdad para
  // guardar y comparar RUTs en el backend.
  private canonRut(raw: string): string {
    const cleaned = (raw || "").replace(/[^0-9kK]/g, "").toUpperCase();
    const looks = cleaned.length > 1 && /^[0-9]+[0-9K]$/.test(cleaned);
    return looks ? cleaned.slice(0, -1) + "-" + cleaned.slice(-1) : (raw || "").trim();
  }
  async getUserByRut(rut: string): Promise<User | undefined> {
    // Búsqueda tolerante a formato: acepta con/sin puntos, con/sin guion y
    // dígito verificador en cualquier caja (k/K). Evita que un comensal cargado
    // con un RUT mal formateado (ej. desde Excel con "k" minúscula o con puntos)
    // no pueda iniciar sesión ni inscribirse.
    const raw = (rut || "").trim();
    const cleaned = raw.replace(/[^0-9kK]/g, "").toUpperCase();
    const looks = cleaned.length > 1 && /^[0-9]+[0-9K]$/.test(cleaned);
    const normalized = looks ? cleaned.slice(0, -1) + "-" + cleaned.slice(-1) : raw;
    // 1) match canónico exacto (caso normal, datos ya normalizados)
    let [user] = await db.select().from(users).where(eq(users.rut, normalized));
    if (user) return user;
    // 2) match crudo exacto (por si quedó almacenado idéntico a la entrada)
    [user] = await db.select().from(users).where(eq(users.rut, raw));
    if (user) return user;
    // 3) fallback auto-sanador: compara dígitos+DV ignorando formato/caja
    //    contra todos los usuarios (tabla chica). Resuelve filas legadas en
    //    formato no canónico sin migrar la BD.
    if (looks) {
      const all = await db.select().from(users);
      const matches = all.filter(
        (u) => (u.rut || "").replace(/[^0-9kK]/g, "").toUpperCase() === cleaned,
      );
      // Ante datos legados duplicados (mismo RUT en distinto formato) NO elegimos
      // "el primero": sería autenticación ambigua. Mejor fallar explícito para
      // que un admin sanee los duplicados antes de permitir el acceso.
      if (matches.length > 1) {
        throw new Error(
          `RUT ambiguo: existen ${matches.length} usuarios con el RUT ${normalized}. Contacta al administrador para corregir el duplicado.`,
        );
      }
      return matches[0];
    }
    return undefined;
  }
  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const v: any = touch(insertUser);
    if (!v.id) v.id = require("crypto").randomUUID();
    // Guardamos SIEMPRE el RUT canónico para que login/inscripción lo encuentren.
    if (v.rut) v.rut = this.canonRut(v.rut);
    const [user] = await db.insert(users).values(v).returning();
    return user;
  }
  async updateUser(id: string, data: Partial<InsertUser & { activo?: boolean }>): Promise<User | undefined> {
    const d: any = touch(data);
    if (d.rut) d.rut = this.canonRut(d.rut);
    const [user] = await db.update(users).set(d).where(eq(users.id, id)).returning();
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
    const v: any = touch(insertCasino);
    if (!v.id) v.id = require("crypto").randomUUID();
    const [casino] = await db.insert(casinos).values(v).returning();
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
    const v: any = touch(insertMinuta);
    if (!v.id) v.id = require("crypto").randomUUID();
    const [minuta] = await db.insert(minutas).values(v).returning();
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
    // Excluir tombstones (pedidos anulados). Para contar anulados usar getAnuladosByMinuta.
    return db.select().from(pedidos).where(isNull(pedidos.deletedAt));
  }
  async getPedidosByUser(userId: string): Promise<Pedido[]> {
    // Excluir tombstones (pedidos anulados por admin) — el comensal puede volver a inscribirse.
    return db.select().from(pedidos).where(and(eq(pedidos.userId, userId), isNull(pedidos.deletedAt)));
  }
  async getPedidoByUserAndMinuta(userId: string, minutaId: string): Promise<Pedido | undefined> {
    // Excluir tombstones para que admin pueda anular y permitir nueva inscripción.
    // IMPORTANTE: excluimos también pedidos de tipo "visita" — un staff puede
    // emitir múltiples vales de visita en la misma minuta, y este lookup
    // (usado por auto-totem y POST /api/pedidos para detectar "ya hay pedido
    // propio") debe ignorarlos. El "vale propio" del staff/comensal SIEMPRE
    // es tipo "seleccion" o "no_asiste".
    const [pedido] = await db
      .select()
      .from(pedidos)
      .where(and(
        eq(pedidos.userId, userId),
        eq(pedidos.minutaId, minutaId),
        isNull(pedidos.deletedAt),
        ne(pedidos.tipo, "visita"),
      ));
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
    // Excluir tombstones — un pedido anulado no debe contarse como inscripción activa.
    return db.select().from(pedidos).where(and(eq(pedidos.minutaId, minutaId), isNull(pedidos.deletedAt)));
  }
  async markPedidoImpreso(id: string): Promise<Pedido | undefined> {
    // Marca el pedido como impreso (vale ya entregado al comensal). Bloquea
    // re-impresiones no autorizadas: el comensal no puede sacar otro vale,
    // solo el staff puede reimprimir vía el flujo Reimpresión.
    // En modo tótem se enqueua en sync_outbox dentro de la misma transacción
    // para que el cloud aprenda del estado impreso (offline-first).
    if (DB_MODE === "totem" && sqlite) {
      const tx = sqlite.transaction(() => {
        const data = touch({ impresoEn: new Date() } as any);
        const [p] = (db.update(pedidos).set(data).where(eq(pedidos.id, id)).returning() as any).all
          ? (db.update(pedidos).set(data).where(eq(pedidos.id, id)).returning() as any).all()
          : [];
        const updated = p ?? (sqlite!.prepare("SELECT * FROM pedidos WHERE id = ?").get(id) as any);
        if (updated) enqueuePedidoOutboxSync(updated, "update");
        return updated;
      });
      return tx() as Pedido | undefined;
    }
    const [pedido] = await db.update(pedidos).set(touch({ impresoEn: new Date() } as any)).where(eq(pedidos.id, id)).returning();
    return pedido;
  }
  async setGestionEstado(id: string, estado: string | null): Promise<Pedido | undefined> {
    // Gestión diaria (admin cloud): marca delivery/baja o limpia (null) sobre un
    // pedido inscrito que no pasó por el tótem. No es una operación del tótem.
    const [pedido] = await db.update(pedidos).set(touch({ gestionEstado: estado } as any)).where(eq(pedidos.id, id)).returning();
    return pedido;
  }
  async getAnuladosByMinuta(minutaId: string): Promise<Pedido[]> {
    // Devuelve solo pedidos anulados (tombstones) para mostrar el conteo en reportes.
    return db.select().from(pedidos).where(and(eq(pedidos.minutaId, minutaId), isNotNull(pedidos.deletedAt)));
  }
  async getPedidoById(id: string): Promise<Pedido | undefined> {
    const [p] = await db.select().from(pedidos).where(eq(pedidos.id, id));
    return p;
  }
  async deletePedido(id: string): Promise<boolean> {
    if (DB_MODE === "totem" && sqlite) {
      const tx = sqlite.transaction(() => {
        const [p] = (db.update(pedidos).set(tombstone()).where(eq(pedidos.id, id)).returning() as any).all
          ? (db.update(pedidos).set(tombstone()).where(eq(pedidos.id, id)).returning() as any).all()
          : [];
        const updated = p ?? (sqlite!.prepare("SELECT * FROM pedidos WHERE id = ?").get(id) as any);
        if (updated) enqueuePedidoOutboxSync(updated, "delete");
        return !!updated;
      });
      return tx();
    }
    const [pedido] = await db.update(pedidos).set(tombstone()).where(eq(pedidos.id, id)).returning();
    return !!pedido;
  }

  // ── Familias ──
  async getAllFamilias(): Promise<Familia[]> {
    return db.select().from(familias);
  }
  async createFamilia(insertFamilia: InsertFamilia): Promise<Familia> {
    const v: any = touch(insertFamilia);
    if (!v.id) v.id = require("crypto").randomUUID();
    const [familia] = await db.insert(familias).values(v).returning();
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
    const v: any = touch(insertPeriodo);
    if (!v.id) v.id = require("crypto").randomUUID();
    const [periodo] = await db.insert(periodos).values(v).returning();
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

  // Comensales (activos) de un casino: por casino base O por relación
  // usuario_casinos (multi-casino). Usado por "Preparar marcha blanca" para
  // normalizar las claves de todos los comensales de un casino.
  async getComensalesByCasino(casinoId: string): Promise<User[]> {
    const linkRows = await db
      .select()
      .from(usuarioCasinos)
      .where(eq(usuarioCasinos.casinoId, casinoId));
    const linkedIds = new Set(linkRows.map(r => r.userId));
    const all = await db
      .select()
      .from(users)
      .where(and(eq(users.role, "comensal"), eq(users.activo, true), isNull(users.deletedAt)));
    return all.filter(u => u.casinoId === casinoId || linkedIds.has(u.id));
  }

  // ── Usuario ↔ Casinos (multi-casino interlocutor / encargado) ──
  async getUserCasinoIds(userId: string): Promise<string[]> {
    const rows = await db.select().from(usuarioCasinos).where(eq(usuarioCasinos.userId, userId));
    return rows.map(r => r.casinoId);
  }
  async setUserCasinos(userId: string, casinoIds: string[]): Promise<void> {
    await db.delete(usuarioCasinos).where(eq(usuarioCasinos.userId, userId));
    if (casinoIds.length === 0) return;
    const rows = casinoIds.map(cid => ({ userId, casinoId: cid }));
    await db.insert(usuarioCasinos).values(rows).onConflictDoNothing();
  }
}

export const storage = new DatabaseStorage();
