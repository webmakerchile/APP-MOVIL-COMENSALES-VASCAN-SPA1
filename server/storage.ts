import { eq, and } from "drizzle-orm";
import { db } from "./db";
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
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser & { activo?: boolean }>): Promise<User | undefined> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

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
    const [casino] = await db.insert(casinos).values(insertCasino).returning();
    return casino;
  }

  async updateCasino(id: string, data: Partial<InsertCasino & { activo?: boolean }>): Promise<Casino | undefined> {
    const [casino] = await db.update(casinos).set(data).where(eq(casinos.id, id)).returning();
    return casino;
  }

  async deleteCasino(id: string): Promise<boolean> {
    const [casino] = await db.update(casinos).set({ activo: false }).where(eq(casinos.id, id)).returning();
    return !!casino;
  }

  async hardDeleteCasino(id: string): Promise<boolean> {
    const [casino] = await db.delete(casinos).where(eq(casinos.id, id)).returning();
    return !!casino;
  }

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
    const [minuta] = await db.insert(minutas).values(insertMinuta).returning();
    return minuta;
  }

  async updateMinuta(id: string, data: Partial<InsertMinuta & { activo?: boolean }>): Promise<Minuta | undefined> {
    const [minuta] = await db.update(minutas).set(data).where(eq(minutas.id, id)).returning();
    return minuta;
  }

  async deleteMinuta(id: string): Promise<boolean> {
    const [minuta] = await db.update(minutas).set({ activo: false }).where(eq(minutas.id, id)).returning();
    return !!minuta;
  }

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

  async createPedido(insertPedido: InsertPedido & { codigoQr?: string }): Promise<Pedido> {
    const [pedido] = await db.insert(pedidos).values(insertPedido).returning();
    return pedido;
  }

  async updatePedido(id: string, data: Partial<InsertPedido & { codigoQr?: string | null }>): Promise<Pedido | undefined> {
    const [pedido] = await db.update(pedidos).set(data).where(eq(pedidos.id, id)).returning();
    return pedido;
  }

  async getPedidosByMinuta(minutaId: string): Promise<Pedido[]> {
    return db.select().from(pedidos).where(eq(pedidos.minutaId, minutaId));
  }

  async getAllFamilias(): Promise<Familia[]> {
    return db.select().from(familias);
  }

  async createFamilia(insertFamilia: InsertFamilia): Promise<Familia> {
    const [familia] = await db.insert(familias).values(insertFamilia).returning();
    return familia;
  }

  async updateFamilia(id: string, data: Partial<InsertFamilia & { activo?: boolean }>): Promise<Familia | undefined> {
    const [familia] = await db.update(familias).set(data).where(eq(familias.id, id)).returning();
    return familia;
  }

  async deleteFamilia(id: string): Promise<boolean> {
    const [familia] = await db.update(familias).set({ activo: false }).where(eq(familias.id, id)).returning();
    return !!familia;
  }

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
    const [periodo] = await db.insert(periodos).values(insertPeriodo).returning();
    return periodo;
  }

  async updatePeriodo(id: string, data: Partial<InsertPeriodo & { activo?: boolean }>): Promise<Periodo | undefined> {
    const [periodo] = await db.update(periodos).set(data).where(eq(periodos.id, id)).returning();
    return periodo;
  }

  async deletePeriodo(id: string): Promise<boolean> {
    const [periodo] = await db.update(periodos).set({ activo: false }).where(eq(periodos.id, id)).returning();
    return !!periodo;
  }
}

export const storage = new DatabaseStorage();
