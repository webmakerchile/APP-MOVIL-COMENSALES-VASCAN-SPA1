import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcryptjs";
import multer from "multer";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import * as path from "path";
import * as fs from "fs";
import { storage } from "./storage";
import { pool, db } from "./db";
import { loginSchema, insertUserSchema, insertMinutaSchema, insertPedidoSchema, insertCasinoSchema, pedidos as pedidosTable, totems as totemsTable, totemReleases as totemReleasesTable } from "@shared/schema";
import { generateDailyReport } from "./cron";
import { registerSyncRoutes, issueBootstrapToken } from "./sync-cloud";
import { eq as eqOp, sql as sqlOp } from "drizzle-orm";

const PgSession = connectPgSimple(session);
const upload = multer({ dest: "/tmp/uploads/" });

const SUPER_ADMIN_RUT = "21212011-1";

function validarRutChileno(rutCompleto: string): boolean {
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

function looksLikeRut(val: string): boolean {
  return /\d/.test(val) && /^[\d.\-kK]+$/.test(val.trim());
}

async function ensureSuperAdmin() {
  try {
    const existing = await storage.getUserByRut(SUPER_ADMIN_RUT);
    if (!existing) {
      const hashed = await bcrypt.hash("peseta832", 10);
      await storage.createUser({
        rut: SUPER_ADMIN_RUT,
        password: hashed,
        nombre: "Super",
        apellido: "Admin",
        role: "admin",
        casinoId: null,
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
      const hashed = await bcrypt.hash(oliverPassword, 10);
      await storage.createUser({
        rut: "olivervasquez",
        password: hashed,
        nombre: "Oliver",
        apellido: "Vasquez",
        role: "admin",
        casinoId: null,
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
      const casinos = await storage.getCasinos();
      const hashed = await bcrypt.hash(password, 10);
      await storage.createUser({
        rut: "9876543-3",
        password: hashed,
        nombre: "Oliver (Demo)",
        apellido: "Comensal",
        role: "comensal",
        casinoId: casinos[0]?.id ?? null,
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
      const casinos = await storage.getCasinos();
      const hashed = await bcrypt.hash(password, 10);
      await storage.createUser({
        rut: "7654321-6",
        password: hashed,
        nombre: "Oliver (Demo)",
        apellido: "Interlocutor",
        role: "interlocutor",
        casinoId: casinos[0]?.id ?? null,
      });
      console.log("Oliver interlocutor demo created.");
    }
  } catch (err) {
    console.error("Oliver interlocutor init error:", err);
  }
}

function requireAdmin(req: Request, res: Response, next: Function) {
  const userId = (req.session as any).userId;
  if (!userId) {
    return res.status(401).json({ message: "No autenticado" });
  }
  storage.getUser(userId).then((user) => {
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }
    if (user.role !== "admin" && user.role !== "interlocutor") {
      return res.status(403).json({ message: "Acceso restringido" });
    }
    (req as any).currentUser = user;
    next();
  }).catch(() => {
    return res.status(500).json({ message: "Error de autenticación" });
  });
}

async function autoSeed() {
  try {
    const existingCasinos = await storage.getCasinos();
    if (existingCasinos.length > 0) return;

    console.log("Auto-seeding database...");

    const casino = await storage.createCasino({
      nombre: "Casino Central Santiago",
      direccion: "Av. Providencia 1234, Santiago",
    });

    const casino2 = await storage.createCasino({
      nombre: "Casino Planta Rancagua",
      direccion: "Calle Industrial 567, Rancagua",
    });

    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }

    const menus1 = [
      { o1: "Pollo al horno con arroz y ensalada", o2: "Pescado frito con puré de papas", o3: "Pasta boloñesa con parmesano", o4: "Ensalada César con pollo grillado" },
      { o1: "Lomo saltado con arroz", o2: "Cazuela de vacuno", o3: "Tortilla española con ensalada", o4: "Wrap de pollo teriyaki" },
      { o1: "Chuleta de cerdo con arroz", o2: "Merluza al horno con verduras", o3: "Lasaña de carne", o4: "Bowl de quinoa con pollo" },
      { o1: "Estofado de res con papas", o2: "Salmón grillado con espárragos", o3: "Risotto de champiñones", o4: null },
      { o1: "Pollo a la plancha con ensalada", o2: "Albóndigas en salsa con arroz", o3: "Tacos de carne", o4: "Sopa de verduras con pan" },
      { o1: "Milanesa de pollo con puré", o2: "Pescado al vapor con arroz", o3: "Empanadas de pino", o4: null },
      { o1: "Asado alemán con puré", o2: "Carbonada", o3: "Pastel de choclo", o4: "Ensalada mediterránea" },
    ];

    for (let i = 0; i < dates.length; i++) {
      const menu = menus1[i % menus1.length];
      await storage.createMinuta({
        casinoId: casino.id,
        fecha: dates[i],
        opcion1: menu.o1,
        opcion2: menu.o2,
        opcion3: menu.o3,
        opcion4: menu.o4,
      });

      await storage.createMinuta({
        casinoId: casino2.id,
        fecha: dates[i],
        opcion1: "Cazuela de vacuno con verduras",
        opcion2: "Lomo saltado con arroz",
        opcion3: "Tortilla española con ensalada",
      });
    }

    const hashedPassword = await bcrypt.hash("123456", 10);
    await storage.createUser({
      rut: "12345678-9",
      password: hashedPassword,
      nombre: "Juan",
      apellido: "Pérez",
      role: "comensal",
      casinoId: casino.id,
    });

    await storage.createUser({
      rut: "11111111-1",
      password: hashedPassword,
      nombre: "Admin",
      apellido: "Sistema",
      role: "admin",
      casinoId: null,
    });

    await storage.createUser({
      rut: "22222222-2",
      password: hashedPassword,
      nombre: "María",
      apellido: "González",
      role: "interlocutor",
      casinoId: casino.id,
    });

    console.log("Auto-seed complete.");
  } catch (err) {
    console.error("Auto-seed error:", err);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // In totem mode there is no Postgres pool, fall back to in-memory session
  // store. The totem only has one logged-in operator at a time so memory is fine.
  const sessionStore = pool
    ? new PgSession({ pool, tableName: "session", createTableIfMissing: true })
    : new (session as any).MemoryStore();
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "vascan-dev-fallback-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    }),
  );

  // Seed/super-admin solo en cloud. Un tótem nunca debe crear datos sintéticos
  // ni un super-admin global; sus datos llegan exclusivamente vía sync-pull.
  if (process.env.DB_MODE !== "totem") {
    await autoSeed();
    await ensureSuperAdmin();
  }

  // ── Admin Panel ──
  // En modo tótem el panel admin no se expone: el tótem es un kiosko, la
  // administración solo ocurre en la nube y baja por sync.
  if (process.env.DB_MODE !== "totem") {
    app.get("/admin", (_req: Request, res: Response) => {
      const filePath = path.resolve(process.cwd(), "web", "src", "admin.html");
      res.sendFile(filePath);
    });
  } else {
    app.get("/admin", (_req: Request, res: Response) => {
      res.status(403).send("Panel administrativo no disponible en tótem. Use el panel cloud.");
    });
  }

  // Bloqueo central: en modo tótem, todas las mutaciones administrativas
  // (POST/PUT/DELETE sobre catálogos) se rechazan. El tótem es read-only para
  // catálogos; solo puede crear pedidos. Esto garantiza el "casino lock":
  // no se pueden crear/editar usuarios, casinos, minutas, periodos ni familias
  // localmente — siempre vienen del cloud filtrados por su casinoId asignado.
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
      "/api/reportes",
    ];
    app.use((req: Request, res: Response, next) => {
      if (req.method === "GET") return next();
      // Permitir explícitamente: pedidos (incluido visita/semanal), auth, sync, seed, login.
      if (req.path.startsWith("/api/pedidos")) return next();
      if (req.path.startsWith("/api/auth")) return next();
      if (req.path.startsWith("/api/totem/")) return next(); // sync endpoints
      if (TOTEM_READONLY_PREFIXES.some(p => req.path.startsWith(p))) {
        return res.status(403).json({ message: "Operación no permitida en tótem (use panel cloud)" });
      }
      next();
    });
  }

  // ── Auth Routes ──
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "RUT y contraseña son requeridos" });
      }

      const { rut, password } = parsed.data;
      const user = await storage.getUserByRut(rut);

      if (!user) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }

      if (!user.activo) {
        return res.status(403).json({ message: "Usuario desactivado" });
      }

      (req.session as any).userId = user.id;

      const { password: _, ...userWithoutPassword } = user;
      return res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Error al cerrar sesión" });
      }
      return res.json({ message: "Sesión cerrada" });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const userId = (req.session as any).userId;
    if (!userId) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    const { password: _, ...userWithoutPassword } = user;
    return res.json({ user: userWithoutPassword });
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Datos inválidos", errors: parsed.error.errors });
      }

      const existing = await storage.getUserByRut(parsed.data.rut);
      if (existing) {
        return res.status(409).json({ message: "El RUT ya está registrado" });
      }

      const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
      const user = await storage.createUser({
        ...parsed.data,
        password: hashedPassword,
      });

      const { password: _, ...userWithoutPassword } = user;
      return res.status(201).json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Register error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // ── Usuarios CRUD (admin-only) ──
  app.get("/api/usuarios", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithoutPasswords = allUsers
        .filter(u => u.rut !== SUPER_ADMIN_RUT)
        .map(({ password, ...u }) => u);
      return res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Get users error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/usuarios", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { rut, nombre, apellido, telefono, role, casinoId, password: pwd } = req.body;
      if (!rut || !nombre || !apellido) {
        return res.status(400).json({ message: "RUT, nombre y apellido son requeridos" });
      }

      if (looksLikeRut(rut) && !validarRutChileno(rut)) {
        return res.status(400).json({ message: "El RUT ingresado no es válido. Verifique el dígito verificador." });
      }

      const existing = await storage.getUserByRut(rut);
      if (existing) {
        return res.status(409).json({ message: "El RUT ya está registrado en el sistema" });
      }

      const defaultPwd = pwd || rut.replace(/[^0-9]/g, "").slice(0, 4) || "1234";
      const hashedPassword = await bcrypt.hash(defaultPwd, 10);
      const user = await storage.createUser({
        rut,
        nombre,
        apellido,
        telefono: telefono || null,
        password: hashedPassword,
        role: role || "comensal",
        casinoId: casinoId || null,
      });

      const { password: _, ...userWithoutPassword } = user;
      return res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Create user error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/usuarios/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nombre, apellido, telefono, role, casinoId, activo, password: newPwd } = req.body;

      const updateData: any = {};
      if (nombre !== undefined) updateData.nombre = nombre;
      if (apellido !== undefined) updateData.apellido = apellido;
      if (telefono !== undefined) updateData.telefono = telefono || null;
      if (role !== undefined) updateData.role = role;
      if (casinoId !== undefined) updateData.casinoId = casinoId || null;
      if (activo !== undefined) updateData.activo = activo;
      if (newPwd) updateData.password = await bcrypt.hash(newPwd, 10);

      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const { password: _, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Update user error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.delete("/api/usuarios/:id", requireAdmin, async (req: Request, res: Response) => {
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

  // ── Casinos CRUD ──
  app.get("/api/casinos", async (_req: Request, res: Response) => {
    try {
      const casinosList = await storage.getCasinos();
      return res.json(casinosList);
    } catch (error) {
      console.error("Get casinos error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/casinos/all", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const casinosList = await storage.getAllCasinos();
      return res.json(casinosList);
    } catch (error) {
      console.error("Get all casinos error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/casinos", async (req: Request, res: Response) => {
    try {
      const parsed = insertCasinoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Datos inválidos" });
      }
      const casino = await storage.createCasino(parsed.data);
      return res.status(201).json(casino);
    } catch (error) {
      console.error("Create casino error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.put("/api/casinos/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nombre, direccion, activo, comensalesDiarios } = req.body;
      const updateData: any = {};
      if (nombre !== undefined) updateData.nombre = nombre;
      if (direccion !== undefined) updateData.direccion = direccion;
      if (activo !== undefined) updateData.activo = activo;
      if (comensalesDiarios !== undefined) updateData.comensalesDiarios = parseInt(comensalesDiarios) || 0;

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

  app.get("/api/casinos/:id/has-history", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const casinoMinutas = await storage.getAllMinutasByCasino(id);
      const allUsers = await storage.getAllUsers();
      const usersInCasino = allUsers.filter(u => u.casinoId === id);
      const hasHistory = casinoMinutas.length > 0 || usersInCasino.length > 0;
      return res.json({ hasHistory, minutas: casinoMinutas.length, usuarios: usersInCasino.length });
    } catch (error) {
      return res.status(500).json({ message: "Error al verificar historial" });
    }
  });

  app.delete("/api/casinos/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const force = req.query.force === "true";

      const casinoMinutas = await storage.getAllMinutasByCasino(id);
      const allUsers = await storage.getAllUsers();
      const usersInCasino = allUsers.filter(u => u.casinoId === id);
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

  // ── Dashboard Stats ──
  app.get("/api/dashboard/stats", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const allCasinos = await storage.getCasinos();
      const activeCasinos = allCasinos.filter(c => c.activo);
      const allUsers = await storage.getAllUsers();
      const allPedidos = await storage.getAllPedidos();
      const allMinutas = await storage.getAllMinutas();

      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const weekStart = monday.toISOString().split('T')[0];
      const weekEnd = sunday.toISOString().split('T')[0];

      const casinoStats = activeCasinos.map(casino => {
        const casinoUsers = allUsers.filter(u => u.casinoId === casino.id && u.activo && u.role === 'comensal');
        const totalComensales = casinoUsers.length;
        const esperados = casino.comensalesDiarios || totalComensales;

        const todayMinutas = allMinutas.filter(m => m.casinoId === casino.id && m.fecha === today && m.activo);
        const todayMinutaIds = todayMinutas.map(m => m.id);
        const todayPedidos = allPedidos.filter(p => todayMinutaIds.includes(p.minutaId));
        const inscritosHoy = new Set(todayPedidos.map(p => p.userId)).size;

        const weekMinutas = allMinutas.filter(m => m.casinoId === casino.id && m.fecha >= weekStart && m.fecha <= weekEnd && m.activo);
        const weekMinutaIds = weekMinutas.map(m => m.id);
        const weekPedidos = allPedidos.filter(p => weekMinutaIds.includes(p.minutaId));
        const inscritosSemana = new Set(weekPedidos.map(p => p.userId)).size;

        const weekDates = [...new Set(weekMinutas.map(m => m.fecha))].sort();
        const dailyBreakdown = weekDates.map(fecha => {
          const dayMinutas = weekMinutas.filter(m => m.fecha === fecha);
          const dayMinutaIds = dayMinutas.map(m => m.id);
          const dayPedidos = allPedidos.filter(p => dayMinutaIds.includes(p.minutaId));
          const inscritos = new Set(dayPedidos.map(p => p.userId)).size;
          return { fecha, inscritos, esperados, porcentaje: esperados > 0 ? Math.round((inscritos / esperados) * 100) : 0 };
        });

        const porcentajeHoy = esperados > 0 ? Math.round((inscritosHoy / esperados) * 100) : 0;
        const porcentajeSemana = esperados > 0 ? Math.round((inscritosSemana / esperados) * 100) : 0;

        return {
          casinoId: casino.id,
          casinoNombre: casino.nombre,
          totalComensales,
          comensalesDiarios: esperados,
          inscritosHoy,
          porcentajeHoy,
          inscritosSemana,
          porcentajeSemana,
          estado: porcentajeHoy >= 80 ? 'bueno' : porcentajeHoy >= 50 ? 'regular' : 'bajo',
          dailyBreakdown
        };
      });

      const totalEsperados = activeCasinos.reduce((sum, c) => sum + (c.comensalesDiarios || 0), 0);
      const totalInscritosHoy = casinoStats.reduce((sum, s) => sum + s.inscritosHoy, 0);
      const totalComensalesRegistrados = allUsers.filter(u => u.role === 'comensal' && u.activo).length;

      return res.json({
        resumen: {
          totalCasinos: activeCasinos.length,
          totalComensalesRegistrados,
          totalEsperados,
          totalInscritosHoy,
          porcentajeGlobal: totalEsperados > 0 ? Math.round((totalInscritosHoy / totalEsperados) * 100) : 0
        },
        casinos: casinoStats
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      return res.status(500).json({ message: "Error al obtener estadísticas" });
    }
  });

  // ── Minutas CRUD ──
  app.get("/api/minutas", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const minutasList = await storage.getAllMinutas();
      return res.json(minutasList);
    } catch (error) {
      console.error("Get all minutas error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/minutas/:casinoId", async (req: Request, res: Response) => {
    try {
      const { casinoId } = req.params;
      const isAdmin = !!(req.session as any).userId;
      const all = req.query.all === "true";
      const minutasList = (isAdmin && all)
        ? await storage.getAllMinutasByCasino(casinoId)
        : await storage.getMinutasByCasino(casinoId);
      return res.json(minutasList);
    } catch (error) {
      console.error("Get minutas error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/minutas/batch-toggle", requireAdmin, async (req: Request, res: Response) => {
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
      return res.json({ message: `${updated} minutas ${activo ? 'activadas' : 'desactivadas'}`, updated });
    } catch (error) {
      console.error("Batch toggle minutas error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/minutas", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { casinoIds, ...rest } = req.body;
      const targetIds: string[] = casinoIds && Array.isArray(casinoIds) && casinoIds.length > 0
        ? casinoIds
        : rest.casinoId ? [rest.casinoId] : [];

      if (targetIds.length === 0) {
        return res.status(400).json({ message: "Debe seleccionar al menos un casino" });
      }

      const created: any[] = [];
      for (const cid of targetIds) {
        const data = { ...rest, casinoId: cid };
        const parsed = insertMinutaSchema.safeParse(data);
        if (!parsed.success) {
          return res.status(400).json({ message: "Datos inválidos", errors: parsed.error.errors });
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

  app.put("/api/minutas/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { casinoId, fecha, familia, opcion1, opcion2, opcion3, opcion4, opcion5, activo, replicateToCasinoIds } = req.body;
      const updateData: any = {};
      if (casinoId !== undefined) updateData.casinoId = casinoId;
      if (fecha !== undefined) updateData.fecha = fecha;
      if (familia !== undefined) updateData.familia = familia;
      if (opcion1 !== undefined) updateData.opcion1 = opcion1;
      if (opcion2 !== undefined) updateData.opcion2 = opcion2;
      if (opcion3 !== undefined) updateData.opcion3 = opcion3;
      if (opcion4 !== undefined) updateData.opcion4 = opcion4;
      if (opcion5 !== undefined) updateData.opcion5 = opcion5;
      if (activo !== undefined) updateData.activo = activo;

      const minuta = await storage.updateMinuta(id, updateData);
      if (!minuta) {
        return res.status(404).json({ message: "Minuta no encontrada" });
      }

      // Replicate same content to other casinos (create or update by fecha)
      if (Array.isArray(replicateToCasinoIds) && replicateToCasinoIds.length > 0) {
        const targetFecha = fecha !== undefined ? fecha : minuta.fecha;
        for (const cid of replicateToCasinoIds) {
          if (!cid || cid === minuta.casinoId) continue;
          const existing = await storage.getMinutasByCasino(cid);
          const match = existing.find(m => m.fecha === targetFecha);
          const payload: any = {
            familia: minuta.familia,
            opcion1: minuta.opcion1,
            opcion2: minuta.opcion2,
            opcion3: minuta.opcion3,
            opcion4: minuta.opcion4,
            opcion5: minuta.opcion5,
            activo: minuta.activo,
          };
          if (match) {
            await storage.updateMinuta(match.id, payload);
          } else {
            await storage.createMinuta({
              casinoId: cid,
              fecha: targetFecha,
              ...payload,
            } as any);
          }
        }
      }
      return res.json(minuta);
    } catch (error) {
      console.error("Update minuta error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.delete("/api/minutas/:id", requireAdmin, async (req: Request, res: Response) => {
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

  app.post("/api/minutas/:id/clonar", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { fecha, casinoIds } = req.body;
      const original = await storage.getMinuta(id);
      if (!original) {
        return res.status(404).json({ message: "Minuta original no encontrada" });
      }
      const targetDate = fecha || original.fecha;
      const targetCasinos: string[] = casinoIds && Array.isArray(casinoIds) && casinoIds.length > 0
        ? casinoIds
        : [original.casinoId];

      const created: any[] = [];
      for (const cid of targetCasinos) {
        const cloneData: any = {
          casinoId: cid,
          fecha: targetDate,
          familia: original.familia,
          opcion1: original.opcion1,
          opcion2: original.opcion2,
          opcion3: original.opcion3,
          opcion4: original.opcion4,
          opcion5: original.opcion5,
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

  // ── Familias CRUD ──
  app.get("/api/familias", async (req: Request, res: Response) => {
    try {
      const allFamilias = await storage.getAllFamilias();
      return res.json(allFamilias);
    } catch (error) {
      console.error("Get familias error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/familias", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { nombre, color } = req.body;
      if (!nombre) return res.status(400).json({ message: "El nombre es obligatorio" });
      const familia = await storage.createFamilia({ nombre, color: color || "#D4A843" });
      return res.status(201).json(familia);
    } catch (error: any) {
      if (error.code === "23505") return res.status(409).json({ message: "Ya existe una familia con ese nombre" });
      console.error("Create familia error:", error);
      return res.status(500).json({ message: "Error al crear familia" });
    }
  });

  app.put("/api/familias/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nombre, color, activo } = req.body;
      const updateData: any = {};
      if (nombre !== undefined) updateData.nombre = nombre;
      if (color !== undefined) updateData.color = color;
      if (activo !== undefined) updateData.activo = activo;
      const familia = await storage.updateFamilia(id, updateData);
      if (!familia) return res.status(404).json({ message: "Familia no encontrada" });
      return res.json(familia);
    } catch (error) {
      console.error("Update familia error:", error);
      return res.status(500).json({ message: "Error al actualizar familia" });
    }
  });

  app.delete("/api/familias/:id", requireAdmin, async (req: Request, res: Response) => {
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

  // ── Periodos (time windows for minuta availability) ──
  app.get("/api/periodos", requireAdmin, async (req: Request, res: Response) => {
    try {
      const allPeriodos = await storage.getAllPeriodos();
      return res.json(allPeriodos);
    } catch (error) {
      console.error("Get periodos error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/periodos/casino/:casinoId", async (req: Request, res: Response) => {
    try {
      const { casinoId } = req.params;
      const periodosList = await storage.getPeriodosByCasino(casinoId);
      return res.json(periodosList);
    } catch (error) {
      console.error("Get periodos by casino error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.post("/api/periodos", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { casinoId, nombre, fechaInicio, fechaFin } = req.body;
      if (!casinoId || !nombre || !fechaInicio || !fechaFin) {
        return res.status(400).json({ message: "Todos los campos son obligatorios" });
      }
      if (new Date(fechaFin) <= new Date(fechaInicio)) {
        return res.status(400).json({ message: "La fecha/hora de fin debe ser posterior a la de inicio" });
      }
      const periodo = await storage.createPeriodo({
        casinoId,
        nombre,
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
      });
      return res.status(201).json(periodo);
    } catch (error) {
      console.error("Create periodo error:", error);
      return res.status(500).json({ message: "Error al crear periodo" });
    }
  });

  app.put("/api/periodos/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { nombre, fechaInicio, fechaFin, activo } = req.body;
      const updateData: any = {};
      if (nombre !== undefined) updateData.nombre = nombre;
      if (fechaInicio !== undefined) updateData.fechaInicio = new Date(fechaInicio);
      if (fechaFin !== undefined) updateData.fechaFin = new Date(fechaFin);
      if (activo !== undefined) updateData.activo = activo;
      if (updateData.fechaInicio && updateData.fechaFin && new Date(updateData.fechaFin) <= new Date(updateData.fechaInicio)) {
        return res.status(400).json({ message: "La fecha/hora de fin debe ser posterior a la de inicio" });
      }
      const periodo = await storage.updatePeriodo(id, updateData);
      if (!periodo) return res.status(404).json({ message: "Periodo no encontrado" });
      return res.json(periodo);
    } catch (error) {
      console.error("Update periodo error:", error);
      return res.status(500).json({ message: "Error al actualizar periodo" });
    }
  });

  app.delete("/api/periodos/:id", requireAdmin, async (req: Request, res: Response) => {
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

  // ── Pedidos (with Interlocutor logic) ──
  app.get("/api/pedidos/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const pedidosList = await storage.getPedidosByUser(userId);
      return res.json(pedidosList);
    } catch (error) {
      console.error("Get pedidos error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // ── Historial enriquecido ──
  app.get("/api/historial/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const sessionUserId = (req.session as any).userId;
      if (!sessionUserId) return res.status(401).json({ message: "No autenticado" });

      const pedidosList = await storage.getPedidosByUser(userId);
      const allMinutas = await storage.getAllMinutas();
      const minutaMap: Record<string, any> = {};
      for (const m of allMinutas) minutaMap[m.id] = m;

      const enriched = pedidosList.map((p) => {
        const m = minutaMap[p.minutaId];
        const opts: Record<number, string> = {};
        if (m) {
          opts[1] = m.opcion1; opts[2] = m.opcion2; opts[3] = m.opcion3;
          if (m.opcion4) opts[4] = m.opcion4;
          if (m.opcion5) opts[5] = m.opcion5;
        }
        return {
          ...p,
          fecha: m?.fecha ?? null,
          familia: m?.familia ?? null,
          opcionTexto: p.opcionSeleccionada > 0 ? (opts[p.opcionSeleccionada] ?? null) : null,
        };
      });

      // Sort by fecha desc (most recent first)
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

  app.post("/api/pedidos", async (req: Request, res: Response) => {
    try {
      const parsed = insertPedidoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Datos inválidos" });
      }

      const user = await storage.getUser(parsed.data.userId);
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const minuta = await storage.getMinuta(parsed.data.minutaId);
      if (!minuta) {
        return res.status(404).json({ message: "Minuta no encontrada" });
      }

      const casinoPeriodos = await storage.getPeriodosByCasino(minuta.casinoId);
      const now = new Date();
      const activePeriodos = casinoPeriodos.filter(p => p.activo && new Date(p.fechaInicio) <= now && new Date(p.fechaFin) >= now);
      if (casinoPeriodos.filter(p => p.activo).length > 0 && activePeriodos.length === 0) {
        return res.status(403).json({ message: "La inscripción no está disponible en este momento. Fuera del horario de inscripción." });
      }

      const tipo = req.body.tipo || "seleccion";
      const nombreVisita = req.body.nombreVisita || null;

      if (tipo === "visita" && user.role !== "interlocutor" && user.role !== "admin") {
        return res.status(403).json({ message: "Solo interlocutores pueden emitir vales de visita" });
      }

      let opcionFinal = parsed.data.opcionSeleccionada;
      if (tipo === "no_asiste") {
        opcionFinal = 0;
      } else if (user.role === "interlocutor" && tipo !== "visita") {
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
        nombreVisita,
      });

      return res.status(201).json(pedido);
    } catch (error) {
      console.error("Create pedido error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/api/periodo-activo/:casinoId", async (req: Request, res: Response) => {
    try {
      const { casinoId } = req.params;
      const periodosList = await storage.getPeriodosByCasino(casinoId);
      const now = new Date();
      const activo = periodosList.find(p => p.activo && new Date(p.fechaInicio) <= now && new Date(p.fechaFin) >= now);
      return res.json({ activo: !!activo, periodo: activo || null });
    } catch (error) {
      return res.status(500).json({ message: "Error al verificar periodo" });
    }
  });

  app.post("/api/pedidos/semanal", async (req: Request, res: Response) => {
    try {
      const { userId, selecciones } = req.body;
      if (!userId || !selecciones || !Array.isArray(selecciones)) {
        return res.status(400).json({ message: "userId y selecciones son requeridos" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      if (user.casinoId) {
        const periodosList = await storage.getPeriodosByCasino(user.casinoId);
        const now = new Date();
        const periodoActivo = periodosList.find(p => p.activo && new Date(p.fechaInicio) <= now && new Date(p.fechaFin) >= now);
        if (!periodoActivo) {
          return res.status(403).json({ message: "No hay un periodo de inscripción activo. Contacta a tu administrador." });
        }
      }

      const results: any[] = [];
      for (const sel of selecciones) {
        const { minutaId, opcionSeleccionada, tipo } = sel;
        if (!minutaId) continue;

        const existing = await storage.getPedidoByUserAndMinuta(userId, minutaId);

        const minuta = await storage.getMinuta(minutaId);
        if (!minuta) continue;

        let opcion = opcionSeleccionada || 1;
        const selTipo = tipo || "seleccion";
        if (selTipo === "no_asiste") opcion = 0;

        if (existing) {
          const updated = await storage.updatePedido(existing.id, {
            opcionSeleccionada: opcion,
            tipo: selTipo,
            codigoQr: selTipo === "no_asiste" ? null : (existing.codigoQr || `VASCAN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
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
          tipo: selTipo,
        });
        results.push(pedido);
      }

      return res.status(201).json(results);
    } catch (error) {
      console.error("Create pedidos semanales error:", error);
      return res.status(500).json({ message: "Error al registrar selecciones semanales" });
    }
  });

  app.post("/api/pedidos/visita", async (req: Request, res: Response) => {
    try {
      const { userId, minutaId, nombreVisita } = req.body;
      if (!userId || !minutaId || !nombreVisita) {
        return res.status(400).json({ message: "userId, minutaId y nombreVisita son requeridos" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Usuario no encontrado" });

      if (user.role !== "interlocutor" && user.role !== "admin") {
        return res.status(403).json({ message: "Solo interlocutores pueden emitir vales de visita" });
      }

      const minuta = await storage.getMinuta(minutaId);
      if (!minuta) return res.status(404).json({ message: "Minuta no encontrada" });

      const codigoQr = `VASCAN-VISITA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const pedido = await storage.createPedido({
        userId,
        minutaId,
        opcionSeleccionada: 1,
        codigoQr,
        tipo: "visita",
        nombreVisita,
      });

      return res.status(201).json(pedido);
    } catch (error) {
      console.error("Create vale visita error:", error);
      return res.status(500).json({ message: "Error al crear vale de visita" });
    }
  });

  // ── Reporte Diario Manual ──
  app.post("/api/reportes/diario", requireAdmin, async (req: Request, res: Response) => {
    try {
      const fecha = (req.body?.fecha as string) || new Date().toISOString().split("T")[0];
      const entries = await generateDailyReport(fecha);
      console.log(`[reporte manual] Generado para ${fecha}:`, JSON.stringify(entries, null, 2));
      return res.json({ fecha, casinos: entries });
    } catch (error) {
      console.error("Error reporte diario manual:", error);
      return res.status(500).json({ message: "Error al generar reporte diario" });
    }
  });

  // ── Dashboard Stats ──
  app.get("/api/reportes/dashboard", requireAdmin, async (req: Request, res: Response) => {
    try {
      const allPedidos = await db.select().from(pedidosTable);
      const totalInscripciones = allPedidos.filter(p => p.tipo === "seleccion" || !p.tipo).length;
      const totalNoAsiste = allPedidos.filter(p => p.tipo === "no_asiste").length;
      const totalVisitas = allPedidos.filter(p => p.tipo === "visita").length;
      return res.json({ totalInscripciones, totalNoAsiste, totalVisitas });
    } catch (error) {
      console.error("Dashboard stats error:", error);
      return res.status(500).json({ message: "Error al obtener estadísticas" });
    }
  });

  // ── Consolidación / Reportes ──
  app.get("/api/reportes/consolidacion", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { casinoId, fecha, fechaHasta } = req.query;
      if (!casinoId || !fecha) {
        return res.status(400).json({ message: "casinoId y fecha son requeridos" });
      }

      const isAllCasinos = (casinoId as string) === "all";
      const hasRange = !!(fechaHasta && fechaHasta !== fecha);

      // Build list of dates when range is given
      const fechasToProcess: string[] = [];
      if (hasRange) {
        const start = new Date((fecha as string) + "T12:00:00");
        const end = new Date((fechaHasta as string) + "T12:00:00");
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          fechasToProcess.push(d.toISOString().split("T")[0]);
        }
      } else {
        fechasToProcess.push(fecha as string);
      }

      // Resolve casinos
      const casinosList = isAllCasinos
        ? await storage.getCasinos()
        : [await storage.getCasino(casinoId as string)].filter(Boolean) as any[];

      if (!isAllCasinos && casinosList.length === 0) {
        return res.status(404).json({ message: "Casino no encontrado" });
      }

      // Aggregate across casinos + dates
      const opcionMap: Record<number, { descripcion: string; cantidad: number }> = {};
      let totalPedidos = 0;
      let totalNoAsiste = 0;
      let totalVisitas = 0;
      const visitasList: { nombreVisita: string | null; codigoQr: string | null }[] = [];
      const dailyRows: { fecha: string; casinoNombre: string; total: number; noAsiste: number }[] = [];

      for (const casino of casinosList) {
        const allMinutasCasino = await storage.getAllMinutasByCasino(casino.id);
        for (const f of fechasToProcess) {
          const minuta = allMinutasCasino.find((m) => m.fecha === f);
          if (!minuta) continue;
          const pedidosForMinuta = await storage.getPedidosByMinuta(minuta.id);
          const selPedidos = pedidosForMinuta.filter(p => p.tipo !== "no_asiste" && p.tipo !== "visita");
          const noAsPedidos = pedidosForMinuta.filter(p => p.tipo === "no_asiste");
          const visPedidos = pedidosForMinuta.filter(p => p.tipo === "visita");
          totalPedidos += selPedidos.length;
          totalNoAsiste += noAsPedidos.length;
          totalVisitas += visPedidos.length;
          visPedidos.forEach(v => visitasList.push({ nombreVisita: v.nombreVisita || null, codigoQr: v.codigoQr || null }));
          dailyRows.push({ fecha: f, casinoNombre: casino.nombre, total: selPedidos.length, noAsiste: noAsPedidos.length });
          const allOptions: (string | null)[] = [minuta.opcion1, minuta.opcion2, minuta.opcion3, minuta.opcion4, minuta.opcion5];
          for (let i = 0; i < allOptions.length; i++) {
            if (!allOptions[i]) continue;
            const num = i + 1;
            if (!opcionMap[num]) opcionMap[num] = { descripcion: allOptions[i]!, cantidad: 0 };
            opcionMap[num].cantidad += selPedidos.filter(p => p.opcionSeleccionada === num).length;
          }
        }
      }

      const opciones = Object.entries(opcionMap).map(([num, v]) => ({
        numero: parseInt(num),
        descripcion: v.descripcion,
        cantidad: v.cantidad,
        porcentaje: totalPedidos > 0 ? Math.round((v.cantidad / totalPedidos) * 100) : 0,
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
        visitas: visitasList,
        dailyRows: hasRange ? dailyRows : undefined,
      });
    } catch (error) {
      console.error("Consolidacion error:", error);
      return res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  // ── Consolidación Semanal JSON ──
  app.get("/api/reportes/consolidacion-semanal", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { casinoId, fecha } = req.query;
      if (!casinoId || !fecha) return res.status(400).json({ message: "casinoId y fecha requeridos" });

      const casino = await storage.getCasino(casinoId as string);
      if (!casino) return res.status(404).json({ message: "Casino no encontrado" });

      const d = new Date(fecha as string + "T12:00:00");
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setDate(d.getDate() + mondayOffset);

      const weekDates: string[] = [];
      for (let i = 0; i < 5; i++) {
        const dd = new Date(monday);
        dd.setDate(monday.getDate() + i);
        weekDates.push(dd.toISOString().split("T")[0]);
      }

      const allMinutas = await storage.getAllMinutasByCasino(casinoId as string);
      const weekMinutas = weekDates.map(f => allMinutas.find(m => m.fecha === f) || null);

      const allUsers = await storage.getAllUsers();
      const casinoUsers = allUsers.filter(u => u.casinoId === casinoId && u.role === "comensal" && u.activo);

      const allPedidos = await storage.getAllPedidos();
      const weekMinutaIds = weekMinutas.filter(Boolean).map(m => m!.id);
      const weekPedidos = allPedidos.filter(p => weekMinutaIds.includes(p.minutaId));

      const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie"];

      const dias = weekDates.map((fecha, i) => {
        const minuta = weekMinutas[i];
        if (!minuta) return { fecha, dia: dayNames[i], opciones: [], total: 0, noAsiste: 0, noInscritos: casinoUsers.length };

        const pedidos = weekPedidos.filter(p => p.minutaId === minuta.id);
        const seleccion = pedidos.filter(p => p.tipo !== "no_asiste" && p.tipo !== "visita");
        const noAsiste = pedidos.filter(p => p.tipo === "no_asiste").length;
        const inscritosIds = new Set(pedidos.map(p => p.userId));
        const noInscritos = casinoUsers.filter(u => !inscritosIds.has(u.id)).length;

        const allOpts = [minuta.opcion1, minuta.opcion2, minuta.opcion3, minuta.opcion4, minuta.opcion5];
        const opciones = allOpts.filter(Boolean).map((desc, idx) => ({
          numero: idx + 1,
          descripcion: desc,
          cantidad: seleccion.filter(p => p.opcionSeleccionada === idx + 1).length,
        }));

        return { fecha, dia: dayNames[i], opciones, total: seleccion.length, noAsiste, noInscritos };
      });

      return res.json({
        casinoNombre: casino.nombre,
        weekStart: weekDates[0],
        weekEnd: weekDates[4],
        totalComensales: casinoUsers.length,
        dias,
      });
    } catch (error) {
      console.error("Consolidacion semanal error:", error);
      return res.status(500).json({ message: "Error interno" });
    }
  });

  // ── Programación Semanal Excel ──
  app.get("/api/reportes/programacion-semanal", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { casinoId, fecha } = req.query;
      if (!casinoId || !fecha) {
        return res.status(400).json({ message: "casinoId y fecha son requeridos" });
      }

      const casino = await storage.getCasino(casinoId as string);
      if (!casino) return res.status(404).json({ message: "Casino no encontrado" });

      const d = new Date(fecha as string + "T12:00:00");
      const dayOfWeek = d.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(d);
      monday.setDate(d.getDate() + mondayOffset);

      const weekDates: string[] = [];
      for (let i = 0; i < 5; i++) {
        const dd = new Date(monday);
        dd.setDate(monday.getDate() + i);
        weekDates.push(dd.toISOString().split("T")[0]);
      }

      const allMinutas = await storage.getAllMinutasByCasino(casinoId as string);
      const weekMinutas = weekDates.map(fecha => allMinutas.find(m => m.fecha === fecha) || null);

      const allUsers = await storage.getAllUsers();
      const casinoUsers = allUsers
        .filter(u => u.casinoId === casinoId && u.role === "comensal" && u.activo)
        .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`));

      const allPedidos = await storage.getAllPedidos();
      const weekMinutaIds = weekMinutas.filter(Boolean).map(m => m!.id);
      const weekPedidos = allPedidos.filter(p => weekMinutaIds.includes(p.minutaId));

      const dayNames = ["LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES"];
      const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

      function formatDateHeader(fecha: string, dayName: string, minuta: any) {
        const dd = new Date(fecha + "T12:00:00");
        const dayNum = dd.getDate();
        const month = monthNames[dd.getMonth()];
        let header = `${dayName} ${dayNum} DE ${month}`;
        if (minuta) {
          const opts = [minuta.opcion1, minuta.opcion2, minuta.opcion3, minuta.opcion4, minuta.opcion5].filter(Boolean);
          header += " " + opts.map((o: string, i: number) => `OP${i + 1}: ${o}`).join(" ");
        }
        return header;
      }

      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();

      const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1B365D" } };
      const headerFont = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
      const goldFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFF2CC" } };
      const borderThin = { top: { style: "thin" as const }, left: { style: "thin" as const }, bottom: { style: "thin" as const }, right: { style: "thin" as const } };

      // ─── Hoja "Datos" (like Hoja2 in the reference) ───
      const wsDatos = wb.addWorksheet("Datos", { properties: { tabColor: { argb: "FFD4A843" } } });

      const datosHeaders = ["ID", "RUT", "Nombre completo"];
      weekDates.forEach((fecha, i) => datosHeaders.push(formatDateHeader(fecha, dayNames[i], weekMinutas[i])));

      wsDatos.columns = datosHeaders.map((h, i) => ({
        header: h,
        key: `col${i}`,
        width: i === 0 ? 6 : i === 1 ? 16 : i === 2 ? 35 : 15,
      }));

      const hRow = wsDatos.getRow(1);
      hRow.height = 80;
      hRow.eachCell(cell => {
        cell.font = headerFont;
        cell.fill = headerFill as any;
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = borderThin;
      });

      let rowIdx = 1;
      casinoUsers.forEach(user => {
        const rowData: any = {
          col0: rowIdx,
          col1: user.rut,
          col2: `${user.apellido} ${user.nombre}`.toUpperCase(),
        };

        weekMinutas.forEach((minuta, dayI) => {
          if (!minuta) { rowData[`col${dayI + 3}`] = ""; return; }
          const pedido = weekPedidos.find(p => p.minutaId === minuta.id && p.userId === user.id);
          if (!pedido) { rowData[`col${dayI + 3}`] = "NO INSCRITO"; return; }
          if (pedido.tipo === "no_asiste") { rowData[`col${dayI + 3}`] = "VACACIONES/ADMINISTRATIVO"; return; }
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
            cell.fill = goldFill as any;
            cell.font = { italic: true, size: 9, color: { argb: "FF996600" } };
          } else if (cell.value === "NO INSCRITO") {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } } as any;
            cell.font = { italic: true, size: 9, color: { argb: "FFCC0000" } };
          }
        });
      }

      // ─── Hoja "Resumen" ───
      const wsResumen = wb.addWorksheet("Resumen", { properties: { tabColor: { argb: "FF4472C4" } } });

      const resHeaders = ["Opción"];
      weekDates.forEach((fecha, i) => {
        const dd = new Date(fecha + "T12:00:00");
        resHeaders.push(`${dayNames[i]} ${dd.getDate()}/${dd.getMonth() + 1}`);
      });
      wsResumen.columns = resHeaders.map((h, i) => ({ header: h, key: `col${i}`, width: i === 0 ? 12 : 18 }));

      const resHRow = wsResumen.getRow(1);
      resHRow.height = 30;
      resHRow.eachCell(cell => {
        cell.font = headerFont;
        cell.fill = headerFill as any;
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = borderThin;
      });

      // Row for each option description
      const maxOpts = Math.max(...weekMinutas.map(m => m ? [m.opcion1, m.opcion2, m.opcion3, m.opcion4, m.opcion5].filter(Boolean).length : 0));
      for (let optIdx = 0; optIdx < maxOpts; optIdx++) {
        const descRow: any = { col0: `OP${optIdx + 1}` };
        weekMinutas.forEach((minuta, dayI) => {
          if (!minuta) { descRow[`col${dayI + 1}`] = ""; return; }
          const opts = [minuta.opcion1, minuta.opcion2, minuta.opcion3, minuta.opcion4, minuta.opcion5].filter(Boolean);
          descRow[`col${dayI + 1}`] = opts[optIdx] || "";
        });
        const r = wsResumen.addRow(descRow);
        r.eachCell(cell => {
          cell.border = borderThin;
          cell.alignment = { wrapText: true, vertical: "middle" };
          cell.font = { italic: true, size: 10 };
        });
      }

      wsResumen.addRow({});

      // Counts per option per day
      for (let optIdx = 0; optIdx < maxOpts; optIdx++) {
        const countRow: any = { col0: `Opción ${optIdx + 1}` };
        weekMinutas.forEach((minuta, dayI) => {
          if (!minuta) { countRow[`col${dayI + 1}`] = 0; return; }
          const pedidos = weekPedidos.filter(p => p.minutaId === minuta.id && p.tipo !== "no_asiste" && p.tipo !== "visita" && p.opcionSeleccionada === optIdx + 1);
          countRow[`col${dayI + 1}`] = pedidos.length;
        });
        const r = wsResumen.addRow(countRow);
        r.eachCell(cell => { cell.border = borderThin; cell.alignment = { horizontal: "center", vertical: "middle" }; });
      }

      // Total row
      const totalRow: any = { col0: "TOTAL" };
      weekMinutas.forEach((minuta, dayI) => {
        if (!minuta) { totalRow[`col${dayI + 1}`] = 0; return; }
        const pedidos = weekPedidos.filter(p => p.minutaId === minuta.id && p.tipo !== "no_asiste" && p.tipo !== "visita");
        totalRow[`col${dayI + 1}`] = pedidos.length;
      });
      const tRow = wsResumen.addRow(totalRow);
      tRow.eachCell(cell => {
        cell.font = { bold: true, size: 12 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } } as any;
        cell.border = borderThin;
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      // No asiste row
      const vacRow: any = { col0: "No asisten" };
      weekMinutas.forEach((minuta, dayI) => {
        if (!minuta) { vacRow[`col${dayI + 1}`] = 0; return; }
        vacRow[`col${dayI + 1}`] = weekPedidos.filter(p => p.minutaId === minuta.id && p.tipo === "no_asiste").length;
      });
      const vRow = wsResumen.addRow(vacRow);
      vRow.eachCell(cell => {
        cell.border = borderThin;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = goldFill as any;
      });

      // No inscrito row
      const noInscRow: any = { col0: "No inscritos" };
      weekMinutas.forEach((minuta, dayI) => {
        if (!minuta) { noInscRow[`col${dayI + 1}`] = 0; return; }
        const inscritosIds = new Set(weekPedidos.filter(p => p.minutaId === minuta.id).map(p => p.userId));
        noInscRow[`col${dayI + 1}`] = casinoUsers.filter(u => !inscritosIds.has(u.id)).length;
      });
      const niRow = wsResumen.addRow(noInscRow);
      niRow.eachCell(cell => {
        cell.border = borderThin;
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } } as any;
      });

      const startDate = new Date(weekDates[0] + "T12:00:00");
      const endDate = new Date(weekDates[4] + "T12:00:00");
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

  // ── Carga Masiva de Usuarios ──
  app.post("/api/usuarios/upload", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se recibió archivo" });
      }

      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      let created = 0;
      let skipped = 0;
      let errors = 0;
      const errorDetails: { row: number; error: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        try {
          const rut = String(row["RUT"] || row["rut"] || "").trim();
          const nombre = String(row["Nombre"] || row["nombre"] || "").trim();
          const apellido = String(row["Apellido"] || row["apellido"] || "").trim();
          const telefonoRaw = String(row["Telefono"] || row["telefono"] || row["Teléfono"] || row["TELEFONO"] || row["Celular"] || row["celular"] || "").trim();
          const rolRaw = String(row["Rol"] || row["rol"] || row["ROL"] || "comensal").trim().toLowerCase();
          const casinoRaw = String(row["Casino_ID"] || row["casino_id"] || row["CasinoID"] || row["CASINO"] || row["Casino"] || "").trim();

          if (!rut || !nombre) {
            errorDetails.push({ row: rowNum, error: "RUT o Nombre vacío" });
            errors++;
            continue;
          }

          if (looksLikeRut(rut) && !validarRutChileno(rut)) {
            errorDetails.push({ row: rowNum, error: `RUT ${rut} inválido — dígito verificador incorrecto` });
            errors++;
            continue;
          }

          const rol = rolRaw === "interlocutor" ? "interlocutor" : (rolRaw === "admin" ? "admin" : "comensal");

          let casinoId = "";
          if (casinoRaw) {
            if (casinoRaw.includes("-") && casinoRaw.length > 20) {
              casinoId = casinoRaw;
            } else {
              const allCasinos = await storage.getCasinos();
              const match = allCasinos.find(c => c.nombre.toLowerCase() === casinoRaw.toLowerCase());
              if (match) casinoId = match.id;
            }
          }
          const existing = await storage.getUserByRut(rut);
          if (existing) { skipped++; continue; }

          const digits = rut.replace(/[^0-9]/g, "");
          const defaultPassword = digits.slice(0, 4) || "1234";
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);

          await storage.createUser({ rut, nombre, apellido, telefono: telefonoRaw || null, password: hashedPassword, role: rol, casinoId: casinoId || null });
          created++;
        } catch (err: any) {
          errorDetails.push({ row: rowNum, error: err.message || "Error desconocido" });
          errors++;
        }
      }

      try { fs.unlinkSync(req.file.path); } catch {}
      return res.json({ created, skipped, errors, errorDetails });
    } catch (error) {
      console.error("Upload error:", error);
      return res.status(500).json({ message: "Error al procesar el archivo" });
    }
  });

  // ── ExcelJS Style Presets ──
  const EX = {
    darkFill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1A1A2E" } },
    navyFill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF16213E" } },
    headerBlueFill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F3460" } },
    goldLightFill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFF8E7" } },
    greenFill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE8F5E9" } },
    orangeFill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFF3E0" } },
    redLightFill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFCDD2" } },
    whiteFill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } },
    grayFill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF5F5F5" } },
    optFills: [
      { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE3F2FD" } },
      { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFE8F5E9" } },
      { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFF3E0" } },
      { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF3E5F5" } },
      { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFEBEE" } },
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
      top: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
      left: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
      right: { style: "thin" as const, color: { argb: "FFCCCCCC" } },
    },
    borderGold: {
      top: { style: "medium" as const, color: { argb: "FFD4A843" } },
      bottom: { style: "medium" as const, color: { argb: "FFD4A843" } },
      left: { style: "medium" as const, color: { argb: "FFD4A843" } },
      right: { style: "medium" as const, color: { argb: "FFD4A843" } },
    },
    center: { horizontal: "center" as const, vertical: "middle" as const },
    left: { horizontal: "left" as const, vertical: "middle" as const, wrapText: true },
    right: { horizontal: "right" as const, vertical: "middle" as const },
  };

  // ── Plantillas Descargables ──
  app.get("/api/plantillas/usuarios", async (_req: Request, res: Response) => {
    try {
      const casinosList = await storage.getCasinos();
      const wb = new ExcelJS.Workbook();
      wb.creator = "Vascan SPA";
      wb.created = new Date();

      const wsInst = wb.addWorksheet("Instrucciones", { properties: { tabColor: { argb: "FF1A1A2E" } } });
      wsInst.columns = [{ width: 26 }, { width: 68 }];
      wsInst.mergeCells("A1:B1");
      wsInst.getCell("A1").value = "PLANTILLA DE CARGA DE USUARIOS";
      wsInst.getCell("A1").font = EX.fontTitle;
      wsInst.getCell("A1").fill = EX.darkFill as any;
      wsInst.getCell("A1").alignment = EX.center;
      wsInst.getRow(1).height = 36;

      wsInst.mergeCells("A2:B2");
      wsInst.getCell("A2").value = "VASCAN SPA — Sistema de Inscripción de Comensales";
      wsInst.getCell("A2").font = EX.fontSubGold;
      wsInst.getCell("A2").fill = EX.navyFill as any;
      wsInst.getCell("A2").alignment = EX.center;
      wsInst.getRow(2).height = 24;

      wsInst.getCell("A4").value = "INSTRUCCIONES";
      wsInst.getCell("A4").font = EX.fontSubtitle;
      wsInst.getCell("A4").fill = EX.goldLightFill as any;
      wsInst.getCell("B4").fill = EX.goldLightFill as any;
      wsInst.getRow(4).height = 28;

      const instructions = [
        "Complete los datos en la hoja 'Usuarios' respetando el formato indicado.",
        "El campo RUT debe incluir guión y dígito verificador (ej: 12345678-9).",
        "El campo ROL tiene un menú desplegable: comensal, interlocutor, admin.",
        "El campo CASINO tiene un menú desplegable con los casinos disponibles.",
        "La contraseña por defecto serán los primeros 4 dígitos del RUT.",
        "Los usuarios con RUT duplicado serán omitidos automáticamente.",
      ];
      instructions.forEach((text, i) => {
        const row = 6 + i;
        wsInst.getCell(`A${row}`).value = `${i + 1}.`;
        wsInst.getCell(`A${row}`).font = EX.fontGold;
        wsInst.getCell(`A${row}`).alignment = EX.right;
        wsInst.getCell(`B${row}`).value = text;
        wsInst.getCell(`B${row}`).font = EX.fontNormal;
      });

      const obRow = 13;
      wsInst.getCell(`A${obRow}`).value = "CAMPOS OBLIGATORIOS:";
      wsInst.getCell(`A${obRow}`).font = EX.fontBoldDark;
      wsInst.getCell(`A${obRow}`).fill = EX.greenFill as any;
      wsInst.getCell(`A${obRow}`).border = EX.borderThin;
      wsInst.getCell(`B${obRow}`).value = "RUT, Nombre, Apellido";
      wsInst.getCell(`B${obRow}`).font = EX.fontNormal;
      wsInst.getCell(`B${obRow}`).fill = EX.greenFill as any;
      wsInst.getCell(`B${obRow}`).border = EX.borderThin;

      wsInst.getCell(`A${obRow + 1}`).value = "CAMPOS OPCIONALES:";
      wsInst.getCell(`A${obRow + 1}`).font = EX.fontBoldDark;
      wsInst.getCell(`A${obRow + 1}`).fill = EX.orangeFill as any;
      wsInst.getCell(`A${obRow + 1}`).border = EX.borderThin;
      wsInst.getCell(`B${obRow + 1}`).value = "Rol (default: comensal), Casino (seleccionar del desplegable)";
      wsInst.getCell(`B${obRow + 1}`).font = EX.fontNormal;
      wsInst.getCell(`B${obRow + 1}`).fill = EX.orangeFill as any;
      wsInst.getCell(`B${obRow + 1}`).border = EX.borderThin;

      const wsUsers = wb.addWorksheet("Usuarios", { properties: { tabColor: { argb: "FFD4A843" } } });
      wsUsers.columns = [
        { header: "RUT", key: "rut", width: 18 },
        { header: "NOMBRE", key: "nombre", width: 22 },
        { header: "APELLIDO", key: "apellido", width: 22 },
        { header: "TELEFONO", key: "telefono", width: 18 },
        { header: "ROL", key: "rol", width: 18 },
        { header: "CASINO", key: "casino", width: 32 },
      ];

      const headerRowU = wsUsers.getRow(1);
      headerRowU.height = 30;
      headerRowU.eachCell(cell => {
        cell.font = EX.fontHeader;
        cell.fill = EX.headerBlueFill as any;
        cell.alignment = EX.center;
        cell.border = EX.borderGold;
      });

      const casinoNames = casinosList.map(c => c.nombre);
      const casinoMap: Record<string, string> = {};
      casinosList.forEach(c => { casinoMap[c.nombre] = c.id; });

      const examples = [
        { rut: "12345678-9", nombre: "Juan", apellido: "Pérez", telefono: "+56912345678", rol: "comensal", casino: casinoNames[0] || "" },
        { rut: "98765432-1", nombre: "María", apellido: "González", telefono: "+56987654321", rol: "interlocutor", casino: casinoNames[0] || "" },
        { rut: "11223344-5", nombre: "Carlos", apellido: "Muñoz", telefono: "", rol: "comensal", casino: "" },
      ];
      examples.forEach(ex => wsUsers.addRow(ex));

      for (let i = 0; i < 97; i++) wsUsers.addRow({ rut: "", nombre: "", apellido: "", telefono: "", rol: "", casino: "" });

      const DATA_ROWS = 100;
      for (let r = 2; r <= DATA_ROWS + 1; r++) {
        const row = wsUsers.getRow(r);
        const isExample = r <= 4;
        const isEven = r % 2 === 0;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = isExample ? { ...EX.fontSmall, italic: true } : EX.fontNormal;
          cell.fill = (isExample ? EX.goldLightFill : (isEven ? EX.grayFill : EX.whiteFill)) as any;
          cell.border = EX.borderThin;
          cell.alignment = colNumber === 1 ? EX.center : EX.left;
        });

        wsUsers.getCell(`E${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"comensal,interlocutor,admin"'],
          showErrorMessage: true,
          errorTitle: "Rol inválido",
          error: "Seleccione: comensal, interlocutor o admin",
          promptTitle: "Seleccionar Rol",
          prompt: "Elija el rol del usuario",
          showInputMessage: true,
        };

        if (casinoNames.length > 0) {
          wsUsers.getCell(`F${r}`).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [`"${casinoNames.join(",")}"`],
            showErrorMessage: true,
            errorTitle: "Casino inválido",
            error: "Seleccione un casino de la lista",
            promptTitle: "Seleccionar Casino",
            prompt: "Elija el casino asignado",
            showInputMessage: true,
          };
        }
      }

      const wsCasinos = wb.addWorksheet("Casinos (Referencia)", { properties: { tabColor: { argb: "FF0F3460" } } });
      wsCasinos.columns = [
        { header: "NOMBRE", key: "nombre", width: 35 },
        { header: "DIRECCIÓN", key: "direccion", width: 40 },
        { header: "ID (UUID)", key: "id", width: 42 },
        { header: "ESTADO", key: "estado", width: 12 },
      ];
      const headerRowC = wsCasinos.getRow(1);
      headerRowC.height = 28;
      headerRowC.eachCell(cell => {
        cell.font = EX.fontHeader;
        cell.fill = EX.headerBlueFill as any;
        cell.alignment = EX.center;
        cell.border = EX.borderGold;
      });
      casinosList.forEach(c => {
        const row = wsCasinos.addRow({ nombre: c.nombre, direccion: c.direccion || "—", id: c.id, estado: c.activo ? "Activo" : "Inactivo" });
        row.eachCell(cell => {
          cell.font = EX.fontNormal;
          cell.border = EX.borderThin;
          cell.alignment = EX.left;
        });
      });
      wsCasinos.state = "visible";

      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=Plantilla_Usuarios_Vascan.xlsx");
      return res.send(Buffer.from(buf as ArrayBuffer));
    } catch (error) {
      console.error("Template error:", error);
      return res.status(500).json({ message: "Error al generar plantilla" });
    }
  });

  app.get("/api/plantillas/minutas", async (_req: Request, res: Response) => {
    try {
      const casinosList = await storage.getCasinos();
      const wb = new ExcelJS.Workbook();
      wb.creator = "Vascan SPA";
      wb.created = new Date();

      const wsInst = wb.addWorksheet("Instrucciones", { properties: { tabColor: { argb: "FF1A1A2E" } } });
      wsInst.columns = [{ width: 22 }, { width: 72 }];
      wsInst.mergeCells("A1:B1");
      wsInst.getCell("A1").value = "PLANTILLA DE PLANIFICACIÓN DE MINUTAS";
      wsInst.getCell("A1").font = EX.fontTitle;
      wsInst.getCell("A1").fill = EX.darkFill as any;
      wsInst.getCell("A1").alignment = EX.center;
      wsInst.getRow(1).height = 36;
      wsInst.mergeCells("A2:B2");
      wsInst.getCell("A2").value = "VASCAN SPA — Sistema de Inscripción de Comensales";
      wsInst.getCell("A2").font = EX.fontSubGold;
      wsInst.getCell("A2").fill = EX.navyFill as any;
      wsInst.getCell("A2").alignment = EX.center;
      wsInst.getRow(2).height = 24;

      wsInst.getCell("A4").value = "INSTRUCCIONES";
      wsInst.getCell("A4").font = EX.fontSubtitle;
      wsInst.getCell("A4").fill = EX.goldLightFill as any;
      wsInst.getCell("B4").fill = EX.goldLightFill as any;

      const minInstructions = [
        "Complete las minutas en la hoja correspondiente a cada casino.",
        "Cada semana tiene 5 columnas (Lunes a Viernes) y hasta 5 opciones de menú por día.",
        "La fila FECHA contiene las fechas en formato AAAA-MM-DD. No modificar el formato.",
        "Las opciones 4 y 5 son opcionales (dejar en blanco si no aplica).",
        "Para importar, suba este archivo en el panel de administración > Carga Masiva.",
        "La sección CONSOLIDACIÓN se llena automáticamente con los datos de inscripción.",
      ];
      minInstructions.forEach((text, i) => {
        const row = 6 + i;
        wsInst.getCell(`A${row}`).value = `${i + 1}.`;
        wsInst.getCell(`A${row}`).font = EX.fontGold;
        wsInst.getCell(`A${row}`).alignment = EX.right;
        wsInst.getCell(`B${row}`).value = text;
        wsInst.getCell(`B${row}`).font = EX.fontNormal;
      });
      wsInst.getCell("A13").value = "IMPORTANTE:";
      wsInst.getCell("A13").font = EX.fontBoldDark;
      wsInst.getCell("A13").fill = EX.redLightFill as any;
      wsInst.getCell("A13").border = EX.borderThin;
      wsInst.getCell("B13").value = "No modificar la estructura de las hojas ni las filas de FECHA / ID Casino.";
      wsInst.getCell("B13").font = EX.fontNormal;
      wsInst.getCell("B13").fill = EX.redLightFill as any;
      wsInst.getCell("B13").border = EX.borderThin;

      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - today.getDay() + 1);
      const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

      for (const casino of casinosList) {
        const safeSheetName = casino.nombre.substring(0, 28).replace(/[\\\/\?\*\[\]]/g, "");
        const ws = wb.addWorksheet(safeSheetName, { properties: { tabColor: { argb: "FFD4A843" } } });
        ws.columns = [
          { width: 20 }, { width: 20 }, { width: 30 }, { width: 30 }, { width: 30 }, { width: 30 }, { width: 30 },
        ];

        ws.mergeCells("A1:G1");
        ws.getCell("A1").value = "PLANIFICACIÓN SEMANAL DE MINUTAS";
        ws.getCell("A1").font = EX.fontTitle;
        ws.getCell("A1").fill = EX.darkFill as any;
        ws.getCell("A1").alignment = EX.center;
        ws.getRow(1).height = 32;

        ws.getCell("A2").value = "Casino:";
        ws.getCell("A2").font = EX.fontGold;
        ws.getCell("B2").value = casino.nombre;
        ws.getCell("B2").font = EX.fontBoldDark;
        ws.getCell("A3").value = "Dirección:";
        ws.getCell("A3").font = EX.fontSmall;
        ws.getCell("B3").value = casino.direccion || "—";
        ws.getCell("B3").font = EX.fontSmall;
        ws.getCell("A4").value = "ID Casino:";
        ws.getCell("A4").font = { ...EX.fontSmall, size: 8 };
        ws.getCell("B4").value = casino.id;
        ws.getCell("B4").font = { ...EX.fontSmall, size: 8 };

        let currentRow = 6;

        for (let week = 0; week < 4; week++) {
          const weekStart = new Date(monday);
          weekStart.setDate(monday.getDate() + week * 7);
          const dates: string[] = [];
          const dateLabels: string[] = [];

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
            cell.fill = EX.headerBlueFill as any;
            cell.alignment = EX.center;
            cell.border = EX.borderGold;
          });
          currentRow++;

          const dateRow = ws.getRow(currentRow);
          dateRow.values = ["", "FECHA", ...dates];
          dateRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { ...EX.fontSmall, bold: true, color: { argb: "FF0F3460" } };
            cell.fill = EX.goldLightFill as any;
            cell.alignment = EX.center;
            cell.border = EX.borderThin;
            cell.numFmt = "@"; // Force TEXT format so Excel does not auto-convert ISO date strings
          });
          currentRow++;

          for (let opt = 0; opt < 5; opt++) {
            const optRow = ws.getRow(currentRow);
            optRow.values = [opt === 0 ? "" : "", `OPCIÓN ${opt + 1}`, "", "", "", "", ""];
            optRow.height = 24;
            const optFill = EX.optFills[opt];
            optRow.getCell(1).font = EX.fontSmall;
            optRow.getCell(1).fill = optFill as any;
            optRow.getCell(1).border = EX.borderThin;
            optRow.getCell(2).font = EX.fontGold;
            optRow.getCell(2).fill = optFill as any;
            optRow.getCell(2).alignment = EX.left;
            optRow.getCell(2).border = EX.borderThin;
            for (let c = 3; c <= 7; c++) {
              const cell = optRow.getCell(c);
              cell.font = EX.fontNormal;
              cell.fill = EX.whiteFill as any;
              cell.alignment = EX.left;
              cell.border = EX.borderThin;
            }
            currentRow++;
          }

          currentRow++;

          const consHeaderRow = ws.getRow(currentRow);
          consHeaderRow.values = ["", "CONSOLIDACIÓN", ...dateLabels];
          consHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
            cell.font = { ...EX.fontHeader, color: { argb: "FFB8902E" } };
            cell.fill = EX.goldLightFill as any;
            cell.alignment = EX.center;
            cell.border = EX.borderThin;
          });
          currentRow++;

          for (let i = 0; i < 5; i++) {
            const consRow = ws.getRow(currentRow);
            consRow.values = ["", `Inscritos Op.${i + 1}`, 0, 0, 0, 0, 0];
            consRow.getCell(2).font = EX.fontSmall;
            consRow.getCell(2).fill = EX.optFills[i] as any;
            consRow.getCell(2).alignment = EX.left;
            consRow.getCell(2).border = EX.borderThin;
            for (let c = 3; c <= 7; c++) {
              consRow.getCell(c).font = EX.fontNormal;
              consRow.getCell(c).fill = EX.optFills[i] as any;
              consRow.getCell(c).alignment = EX.center;
              consRow.getCell(c).border = EX.borderThin;
            }
            currentRow++;
          }

          const extraLabels = ["Sin inscripción", "Visitas"];
          for (const label of extraLabels) {
            const row = ws.getRow(currentRow);
            row.values = ["", label, "", "", "", "", ""];
            row.getCell(2).font = EX.fontSmall;
            row.getCell(2).fill = EX.grayFill as any;
            row.getCell(2).alignment = EX.left;
            row.getCell(2).border = EX.borderThin;
            for (let c = 3; c <= 7; c++) {
              row.getCell(c).font = EX.fontNormal;
              row.getCell(c).fill = EX.grayFill as any;
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
            cell.fill = EX.darkFill as any;
            cell.alignment = EX.center;
            cell.border = EX.borderGold;
          });
          currentRow += 3;
        }
      }

      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=Plantilla_Minutas_Vascan.xlsx");
      return res.send(Buffer.from(buf as ArrayBuffer));
    } catch (error) {
      console.error("Template minutas error:", error);
      return res.status(500).json({ message: "Error al generar plantilla" });
    }
  });

  // ── Importar Minutas desde Excel ──
  app.post("/api/minutas/upload", requireAdmin, upload.single("file"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No se recibió archivo" });
      }

      const workbook = XLSX.readFile(req.file.path, { cellDates: true });
      let created = 0;
      let skipped = 0;
      let errors = 0;
      const errorDetails: { sheet: string; row: number; error: string }[] = [];

      // Helper: convert any cell value (Date, string, number serial) to YYYY-MM-DD
      const toIsoDate = (v: any): string | null => {
        if (v == null || v === "") return null;
        if (v instanceof Date && !isNaN(v.getTime())) {
          const y = v.getFullYear();
          const m = String(v.getMonth() + 1).padStart(2, "0");
          const d = String(v.getDate()).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
        const s = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
        // Excel serial number
        const n = Number(s);
        if (!isNaN(n) && n > 25569 && n < 60000) {
          const ms = (n - 25569) * 86400 * 1000;
          const d = new Date(ms);
          const y = d.getUTCFullYear();
          const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(d.getUTCDate()).padStart(2, "0");
          return `${y}-${mo}-${dd}`;
        }
        // Try DD/MM/YYYY or DD-MM-YYYY
        const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (m) {
          return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }
        return null;
      };

      for (const sheetName of workbook.SheetNames) {
        if (sheetName === "Instrucciones") continue;
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1, raw: true }) as any[][];

        let casinoId = "";
        for (const row of rows) {
          if (row && row[0] && String(row[0]).trim() === "ID Casino:" && row[1]) {
            casinoId = String(row[1]).trim();
            break;
          }
        }
        if (!casinoId) {
          errorDetails.push({ sheet: sheetName, row: 0, error: `No se encontró "ID Casino:" en la hoja. Use la plantilla descargada.` });
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
              const opciones: string[] = [];
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
              const existing = existingMinutas.find(m => m.fecha === fecha);
              if (existing) { skipped++; continue; }

              await storage.createMinuta({
                casinoId,
                fecha,
                opcion1: opciones[0],
                opcion2: opciones[1],
                opcion3: opciones[2],
                opcion4: opciones[3] || null,
                opcion5: opciones[4] || null,
              });
              created++;
            } catch (err: any) {
              errorDetails.push({ sheet: sheetName, row: i, error: err.message });
              errors++;
            }
          }
        }
      }

      try { fs.unlinkSync(req.file!.path); } catch {}
      return res.json({ created, skipped, errors, errorDetails });
    } catch (error) {
      console.error("Upload minutas error:", error);
      return res.status(500).json({ message: "Error al procesar el archivo" });
    }
  });

  // ── Reportes Detallados (3 nuevos, descarga Excel) ──
  // Helper común
  function buildHeader(ws: any, title: string) {
    ws.mergeCells("A1:F1");
    ws.getCell("A1").value = title;
    ws.getCell("A1").font = EX.fontTitle;
    ws.getCell("A1").fill = EX.darkFill as any;
    ws.getCell("A1").alignment = EX.center;
    ws.getRow(1).height = 30;
    ws.mergeCells("A2:F2");
    ws.getCell("A2").value = "BUENAMEZCLA — Sistema de Comensales";
    ws.getCell("A2").font = EX.fontSubGold;
    ws.getCell("A2").fill = EX.navyFill as any;
    ws.getCell("A2").alignment = EX.center;
  }

  // 1) Reporte de Inscripción x rango: día inscripción / comensal / casino / opción / día servicio
  // Helper: enforce interlocutor casino scope (returns effective casinoId or null for "all admins-only")
  function scopedCasinoId(req: Request, requested: string | undefined): string | undefined | null {
    const sUser = (req.session as any).user;
    if (sUser?.role === "interlocutor") {
      // interlocutor is locked to their own casino regardless of what they requested
      return sUser.casinoId || null;
    }
    return requested;
  }

  app.get("/api/reportes/inscripcion-detalle", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { fechaDesde, fechaHasta } = req.query as any;
      const casinoId = scopedCasinoId(req, req.query.casinoId as string);
      if (!fechaDesde || !fechaHasta) return res.status(400).json({ message: "fechaDesde y fechaHasta requeridos" });

      const allPedidos = await storage.getAllPedidos();
      const allMinutas = await storage.getAllMinutas();
      const allUsers = await storage.getAllUsers();
      const allCasinos = await storage.getCasinos();
      const minutaById = new Map(allMinutas.map(m => [m.id, m]));
      const userById = new Map(allUsers.map(u => [u.id, u]));
      const casinoById = new Map(allCasinos.map(c => [c.id, c]));

      const start = new Date(fechaDesde + "T00:00:00");
      const end = new Date(fechaHasta + "T23:59:59");

      const filtered = allPedidos.filter(p => {
        const created = p.createdAt ? new Date(p.createdAt) : null;
        if (!created || created < start || created > end) return false;
        if (casinoId && casinoId !== "all") {
          const m = minutaById.get(p.minutaId);
          if (!m || m.casinoId !== casinoId) return false;
        }
        return true;
      });

      const wb = new ExcelJS.Workbook();
      wb.creator = "BuenaMezcla";
      const ws = wb.addWorksheet("Inscripciones", { properties: { tabColor: { argb: "FFD4A843" } } });
      ws.columns = [
        { header: "Día Inscripción", key: "fechaInsc", width: 22 },
        { header: "Comensal (RUT - Nombre)", key: "comensal", width: 38 },
        { header: "Casino", key: "casino", width: 26 },
        { header: "Tipo", key: "tipo", width: 14 },
        { header: "Opción", key: "opcion", width: 36 },
        { header: "Día Servicio", key: "fechaServ", width: 16 },
      ];
      buildHeader(ws, "INSCRIPCIONES POR RANGO DE FECHAS");
      const headerRow = ws.getRow(4);
      headerRow.values = ["Día Inscripción", "Comensal", "Casino", "Tipo", "Opción", "Día Servicio"];
      headerRow.height = 26;
      headerRow.eachCell(c => { c.font = EX.fontHeader; c.fill = EX.headerBlueFill as any; c.alignment = EX.center; c.border = EX.borderGold; });

      const sorted = filtered.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
      sorted.forEach((p, idx) => {
        const m = minutaById.get(p.minutaId);
        const u = userById.get(p.userId);
        const c = m ? casinoById.get(m.casinoId) : null;
        const opciones = m ? [m.opcion1, m.opcion2, m.opcion3, m.opcion4, m.opcion5] : [];
        const opcionTexto = p.tipo === "no_asiste" ? "(no asiste)" : (opciones[p.opcionSeleccionada - 1] || `Opción ${p.opcionSeleccionada}`);
        const tipoLabel = p.tipo === "visita" ? `Visita: ${p.nombreVisita || ""}` : (p.tipo === "no_asiste" ? "No asiste" : "Selección");
        const created = p.createdAt ? new Date(p.createdAt) : null;
        const fechaInscStr = created
          ? `${created.toLocaleDateString("es-CL")} ${String(created.getHours()).padStart(2, "0")}:${String(created.getMinutes()).padStart(2, "0")}`
          : "—";
        const r = ws.addRow({
          fechaInsc: fechaInscStr,
          comensal: u ? `${u.rut} — ${u.nombre} ${u.apellido}` : "—",
          casino: c?.nombre || "—",
          tipo: tipoLabel,
          opcion: opcionTexto,
          fechaServ: m?.fecha || "—",
        });
        const isEven = idx % 2 === 0;
        r.eachCell(cell => { cell.font = EX.fontNormal; cell.fill = (isEven ? EX.whiteFill : EX.grayFill) as any; cell.border = EX.borderThin; cell.alignment = EX.left; });
      });

      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=Inscripciones_${fechaDesde}_a_${fechaHasta}.xlsx`);
      return res.send(Buffer.from(buf as ArrayBuffer));
    } catch (error) {
      console.error("Inscripcion detalle error:", error);
      return res.status(500).json({ message: "Error al generar reporte" });
    }
  });

  // 2) Reporte de Consumo x rango (proxy: createdAt del pedido = impresión vale)
  app.get("/api/reportes/consumo-detalle", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { fechaDesde, fechaHasta } = req.query as any;
      const casinoId = scopedCasinoId(req, req.query.casinoId as string);
      if (!fechaDesde || !fechaHasta) return res.status(400).json({ message: "fechaDesde y fechaHasta requeridos" });

      const allPedidos = await storage.getAllPedidos();
      const allMinutas = await storage.getAllMinutas();
      const allUsers = await storage.getAllUsers();
      const allCasinos = await storage.getCasinos();
      const minutaById = new Map(allMinutas.map(m => [m.id, m]));
      const userById = new Map(allUsers.map(u => [u.id, u]));
      const casinoById = new Map(allCasinos.map(c => [c.id, c]));

      const start = new Date(fechaDesde + "T00:00:00");
      const end = new Date(fechaHasta + "T23:59:59");

      const filtered = allPedidos.filter(p => {
        if (p.tipo === "no_asiste") return false;
        const m = minutaById.get(p.minutaId);
        if (!m) return false;
        const fechaServ = new Date(m.fecha + "T12:00:00");
        if (fechaServ < start || fechaServ > end) return false;
        if (casinoId && casinoId !== "all" && m.casinoId !== casinoId) return false;
        return true;
      });

      const wb = new ExcelJS.Workbook();
      wb.creator = "BuenaMezcla";
      const ws = wb.addWorksheet("Consumo", { properties: { tabColor: { argb: "FFD4A843" } } });
      ws.columns = [
        { header: "Fecha y hora vale", key: "fechaConsumo", width: 22 },
        { header: "Comensal", key: "comensal", width: 38 },
        { header: "Casino", key: "casino", width: 26 },
        { header: "Opción", key: "opcion", width: 36 },
        { header: "Día Servicio", key: "fechaServ", width: 16 },
        { header: "Código QR", key: "qr", width: 28 },
      ];
      buildHeader(ws, "CONSUMO POR RANGO DE FECHAS");
      const headerRow = ws.getRow(4);
      headerRow.values = ["Fecha y hora vale", "Comensal", "Casino", "Opción", "Día Servicio", "Código QR"];
      headerRow.height = 26;
      headerRow.eachCell(c => { c.font = EX.fontHeader; c.fill = EX.headerBlueFill as any; c.alignment = EX.center; c.border = EX.borderGold; });

      const sorted = filtered.sort((a, b) => {
        const ma = minutaById.get(a.minutaId)!;
        const mb = minutaById.get(b.minutaId)!;
        return ma.fecha.localeCompare(mb.fecha);
      });
      sorted.forEach((p, idx) => {
        const m = minutaById.get(p.minutaId);
        const u = userById.get(p.userId);
        const c = m ? casinoById.get(m.casinoId) : null;
        const opciones = m ? [m.opcion1, m.opcion2, m.opcion3, m.opcion4, m.opcion5] : [];
        const opcionTexto = opciones[p.opcionSeleccionada - 1] || `Opción ${p.opcionSeleccionada}`;
        const created = p.createdAt ? new Date(p.createdAt) : null;
        const fechaConsumoStr = created
          ? `${created.toLocaleDateString("es-CL")} ${String(created.getHours()).padStart(2, "0")}:${String(created.getMinutes()).padStart(2, "0")}`
          : "—";
        const comensalLabel = p.tipo === "visita"
          ? `VISITA — ${p.nombreVisita || ""}`
          : (u ? `${u.rut} — ${u.nombre} ${u.apellido}` : "—");
        const r = ws.addRow({
          fechaConsumo: fechaConsumoStr,
          comensal: comensalLabel,
          casino: c?.nombre || "—",
          opcion: opcionTexto,
          fechaServ: m?.fecha || "—",
          qr: p.codigoQr || "—",
        });
        const isEven = idx % 2 === 0;
        r.eachCell(cell => { cell.font = EX.fontNormal; cell.fill = (isEven ? EX.whiteFill : EX.grayFill) as any; cell.border = EX.borderThin; cell.alignment = EX.left; });
      });

      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=Consumo_${fechaDesde}_a_${fechaHasta}.xlsx`);
      return res.send(Buffer.from(buf as ArrayBuffer));
    } catch (error) {
      console.error("Consumo detalle error:", error);
      return res.status(500).json({ message: "Error al generar reporte" });
    }
  });

  // 3) Reporte minutas detalle del mes
  app.get("/api/reportes/minutas-detalle", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { mes } = req.query as any; // mes = YYYY-MM
      const casinoId = scopedCasinoId(req, req.query.casinoId as string);
      if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return res.status(400).json({ message: "mes requerido (YYYY-MM)" });

      const allMinutas = await storage.getAllMinutas();
      const allCasinos = await storage.getCasinos();
      const casinoById = new Map(allCasinos.map(c => [c.id, c]));

      const filtered = allMinutas.filter(m => {
        if (!m.fecha.startsWith(mes)) return false;
        if (casinoId && casinoId !== "all" && m.casinoId !== casinoId) return false;
        return true;
      }).sort((a, b) => a.fecha.localeCompare(b.fecha));

      const wb = new ExcelJS.Workbook();
      wb.creator = "BuenaMezcla";
      const ws = wb.addWorksheet("Minutas del mes", { properties: { tabColor: { argb: "FFD4A843" } } });
      ws.columns = [
        { header: "Día Servicio", key: "fecha", width: 14 },
        { header: "Casino", key: "casino", width: 26 },
        { header: "Familia", key: "familia", width: 16 },
        { header: "Opción N°", key: "num", width: 12 },
        { header: "Preparación", key: "prep", width: 60 },
      ];
      buildHeader(ws, `MINUTAS DETALLE DEL MES — ${mes}`);
      const headerRow = ws.getRow(4);
      headerRow.values = ["Día Servicio", "Casino", "Familia", "Opción N°", "Preparación"];
      headerRow.height = 26;
      headerRow.eachCell(c => { c.font = EX.fontHeader; c.fill = EX.headerBlueFill as any; c.alignment = EX.center; c.border = EX.borderGold; });

      let idx = 0;
      filtered.forEach(m => {
        const opts = [m.opcion1, m.opcion2, m.opcion3, m.opcion4, m.opcion5];
        const c = casinoById.get(m.casinoId);
        opts.forEach((op, i) => {
          if (!op) return;
          const r = ws.addRow({
            fecha: m.fecha,
            casino: c?.nombre || "—",
            familia: m.familia || "—",
            num: i + 1,
            prep: op,
          });
          const isEven = idx % 2 === 0;
          r.eachCell((cell, col) => {
            cell.font = EX.fontNormal;
            cell.fill = (isEven ? EX.whiteFill : EX.grayFill) as any;
            cell.border = EX.borderThin;
            cell.alignment = col === 4 ? EX.center : EX.left;
          });
          idx++;
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=Minutas_${mes}.xlsx`);
      return res.send(Buffer.from(buf as ArrayBuffer));
    } catch (error) {
      console.error("Minutas detalle error:", error);
      return res.status(500).json({ message: "Error al generar reporte" });
    }
  });

  // ── Seed Data (manual) ──
  app.get("/api/seed", async (_req: Request, res: Response) => {
    try {
      await autoSeed();
      return res.json({ message: "Seed ejecutado" });
    } catch (error) {
      console.error("Seed error:", error);
      return res.status(500).json({ message: "Error al crear datos de prueba" });
    }
  });

  // ── Sync API for tótems ───────────────────────────────────────────────
  registerSyncRoutes(app);

  // Strict admin gate: fleet management is dangerous (mints bootstrap tokens,
  // publishes auto-update releases) so we exclude `interlocutor`.
  function requireAdminStrict(req: Request, res: Response, next: Function) {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ message: "No autenticado" });
    storage.getUser(userId).then(u => {
      if (!u || u.role !== "admin") return res.status(403).json({ message: "Solo administradores" });
      (req as any).currentUser = u;
      next();
    }).catch(() => res.status(500).json({ message: "Error de autenticación" }));
  }

  // ── Fleet management (admin only) ─────────────────────────────────────
  app.get("/api/totems", requireAdminStrict, async (_req, res) => {
    try {
      const list = await db.select().from(totemsTable);
      const now = Date.now();
      const enriched = list.map((t: any) => {
        const last = t.ultimaConexion ? new Date(t.ultimaConexion).getTime() : 0;
        const ageMs = now - last;
        let estado = "offline";
        if (last && ageMs < 2 * 60 * 1000) estado = "online";
        else if (last && ageMs < 10 * 60 * 1000) estado = "intermitente";
        return { ...t, estado, secretHash: undefined };
      });
      res.json(enriched);
    } catch (err) {
      console.error("list totems error", err);
      res.status(500).json({ message: "Error al listar tótems" });
    }
  });

  app.put("/api/totems/:id", requireAdminStrict, async (req, res) => {
    try {
      const { id } = req.params;
      const { nombre, notas, activo } = req.body;
      const updateData: any = {};
      if (nombre !== undefined) updateData.nombre = nombre;
      if (notas !== undefined) updateData.notas = notas;
      if (activo !== undefined) updateData.activo = activo;
      const [updated] = await db.update(totemsTable).set(updateData).where(eqOp(totemsTable.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "No encontrado" });
      res.json({ ...updated, secretHash: undefined });
    } catch (err) {
      res.status(500).json({ message: "Error al actualizar tótem" });
    }
  });

  app.delete("/api/totems/:id", requireAdminStrict, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(totemsTable).where(eqOp(totemsTable.id, id));
      res.json({ message: "Tótem eliminado" });
    } catch (err) {
      res.status(500).json({ message: "Error al eliminar tótem" });
    }
  });

  // Bootstrap-token endpoints: admin generates a one-shot token used by the
  // installer on the totem PC during /api/totem/register.
  app.post("/api/totems/bootstrap-token", requireAdminStrict, async (req, res) => {
    try {
      const u = (req as any).currentUser;
      const { casinoId } = req.body as { casinoId?: string };
      if (!casinoId) return res.status(400).json({ message: "casinoId requerido" });
      const casino = await storage.getCasino(casinoId);
      if (!casino) return res.status(404).json({ message: "Casino no existe" });
      const token = issueBootstrapToken(u?.rut || "admin", casinoId);
      res.json({
        token,
        casino: { id: casino.id, nombre: casino.nombre },
        expiresInfo: "Válido por 1 hora. Se invalida al usarse (single-use).",
      });
    } catch (err) {
      res.status(500).json({ message: "Error al generar token" });
    }
  });

  // Releases CRUD (publish new totem versions for auto-update)
  app.get("/api/totem-releases", requireAdminStrict, async (_req, res) => {
    try {
      const list = await db.select().from(totemReleasesTable).orderBy(sqlOp`created_at DESC`);
      res.json(list);
    } catch (err) {
      res.status(500).json({ message: "Error al listar versiones" });
    }
  });

  app.post("/api/totem-releases", requireAdminStrict, async (req, res) => {
    try {
      const { version, url, sha256, notas, obligatoria, publicada } = req.body;
      if (!version || !url || !sha256) return res.status(400).json({ message: "Faltan campos" });
      const [r] = await db.insert(totemReleasesTable).values({
        version, url, sha256,
        notas: notas ?? null,
        obligatoria: !!obligatoria,
        publicada: publicada !== false,
      }).returning();
      res.status(201).json(r);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ message: "Versión duplicada" });
      res.status(500).json({ message: "Error al crear versión" });
    }
  });

  app.put("/api/totem-releases/:id", requireAdminStrict, async (req, res) => {
    try {
      const { id } = req.params;
      const { publicada, obligatoria, notas, url, sha256 } = req.body;
      const upd: any = {};
      if (publicada !== undefined) upd.publicada = publicada;
      if (obligatoria !== undefined) upd.obligatoria = obligatoria;
      if (notas !== undefined) upd.notas = notas;
      if (url !== undefined) upd.url = url;
      if (sha256 !== undefined) upd.sha256 = sha256;
      const [r] = await db.update(totemReleasesTable).set(upd).where(eqOp(totemReleasesTable.id, id)).returning();
      if (!r) return res.status(404).json({ message: "No encontrado" });
      res.json(r);
    } catch (err) {
      res.status(500).json({ message: "Error al actualizar versión" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
