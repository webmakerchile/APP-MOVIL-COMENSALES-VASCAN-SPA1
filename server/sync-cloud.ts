// Cloud-side sync API used by remote totems.
// Authentication: each totem holds an `X-Totem-Id` + `X-Totem-Secret` pair
// (the secret is bcrypt-hashed in the DB). On every request we look up the
// totem, compare the hash, and reject if invalid.
//
// Endpoints (mounted under /api/totem):
//   POST /register       — first-time registration with admin token
//   POST /heartbeat      — keepalive + status report
//   GET  /pull?since=ms  — returns master data changed since `since`
//                          (scoped to the totem's casino)
//   POST /push           — accepts an array of pedido upserts
//   GET  /version/latest — returns latest published release (for self-update)
//   GET  /pull-update    — lightweight update bundle (runtime.js + sync-worker.js + pwa/dist)
import type { Express, Request, Response, NextFunction } from "express";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import type archiverType from "archiver";
import { createRequire as _cr } from "module";
// archiver es un paquete CJS sin export default en ESM;
// se carga vía createRequire para que funcione con --format=esm --packages=external.
const archiver = _cr(import.meta.url)("archiver") as typeof archiverType;
import bcrypt from "bcryptjs";
import { db, sqlite } from "./db";
import { totems, totemReleases, users, casinos, minutas, familias, periodos, pedidos, type Totem } from "@shared/schema";
import { storage } from "./storage";
import { eq, and, gt, sql, inArray } from "drizzle-orm";

interface AuthedTotemRequest extends Request {
  totem?: Totem;
}

async function requireTotem(req: AuthedTotemRequest, res: Response, next: NextFunction) {
  const id = req.header("x-totem-id");
  const secret = req.header("x-totem-secret");
  if (!id || !secret) return res.status(401).json({ message: "Faltan credenciales del tótem" });
  const [t] = await db.select().from(totems).where(eq(totems.id, id));
  if (!t || !t.activo) return res.status(401).json({ message: "Tótem no autorizado" });
  const ok = await bcrypt.compare(secret, t.secretHash);
  if (!ok) return res.status(401).json({ message: "Credenciales inválidas" });
  req.totem = t;
  next();
}

// Registration uses a one-time bootstrap token. Tokens are stored hashed
// in-memory with a 1h expiry. They self-destruct on first successful use so
// they cannot be replayed.
type TokenRec = { hash: string; expiresAt: number; createdBy: string; casinoId: string };
const bootstrapTokens: TokenRec[] = [];

export function issueBootstrapToken(createdBy: string, casinoId: string): string {
  const buf = require("crypto").randomBytes(24).toString("base64url");
  const hash = require("crypto").createHash("sha256").update(buf).digest("hex");
  // Purge expired
  const now = Date.now();
  for (let i = bootstrapTokens.length - 1; i >= 0; i--) {
    if (bootstrapTokens[i].expiresAt < now) bootstrapTokens.splice(i, 1);
  }
  bootstrapTokens.push({ hash, expiresAt: now + 60 * 60 * 1000, createdBy, casinoId });
  return buf;
}

function consumeBootstrapToken(token: string): { valid: boolean; casinoId?: string } {
  const hash = require("crypto").createHash("sha256").update(token).digest("hex");
  const now = Date.now();
  const idx = bootstrapTokens.findIndex(t => t.hash === hash && t.expiresAt > now);
  if (idx < 0) {
    // Allow env-var token as fallback (no auto-revoke, no casinoId — body must supply it)
    if (!!process.env.TOTEM_BOOTSTRAP_TOKEN && token === process.env.TOTEM_BOOTSTRAP_TOKEN) {
      return { valid: true };
    }
    return { valid: false };
  }
  const { casinoId } = bootstrapTokens[idx];
  bootstrapTokens.splice(idx, 1); // single-use
  return { valid: true, casinoId };
}

async function requireBootstrapToken(req: Request, res: Response, next: NextFunction) {
  const token = req.header("x-bootstrap-token");
  if (!token) return res.status(401).json({ message: "Token de instalación requerido" });
  const result = consumeBootstrapToken(token);
  if (!result.valid) {
    return res.status(401).json({ message: "Token de instalación inválido o expirado" });
  }
  (req as any).bootstrapCasinoId = result.casinoId;
  next();
}

export function registerSyncRoutes(app: Express) {
  // ── Register a new totem ────────────────────────────────────────────────
  // Body: { nombre, casinoId, hostname?, ipLocal?, version? }
  // Response: { totemId, secret } — the secret is shown ONCE.
  app.post("/api/totem/register", requireBootstrapToken, async (req: Request, res: Response) => {
    try {
      const { nombre, hostname, ipLocal, version } = req.body;
      // casinoId comes from the bootstrap token (preferred) or body fallback
      const casinoId: string = (req as any).bootstrapCasinoId || req.body.casinoId;
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
        ultimaConexion: new Date(),
        estado: "online",
      }).returning();

      return res.status(201).json({
        totemId: t.id,
        secret,
        casino: { id: casino.id, nombre: casino.nombre },
      });
    } catch (err) {
      console.error("totem register error", err);
      return res.status(500).json({ message: "Error al registrar tótem" });
    }
  });

  // ── Heartbeat ───────────────────────────────────────────────────────────
  app.post("/api/totem/heartbeat", requireTotem, async (req: AuthedTotemRequest, res: Response) => {
    try {
      const t = req.totem!;
      const { version, pedidosPendientes, ipLocal, hostname } = req.body || {};
      const ipPublica = (req.ip || req.socket.remoteAddress || "").replace("::ffff:", "");
      await db.update(totems).set({
        ultimaConexion: new Date(),
        version: version ?? t.version,
        pedidosPendientes: typeof pedidosPendientes === "number" ? pedidosPendientes : t.pedidosPendientes,
        ipPublica,
        ipLocal: ipLocal ?? t.ipLocal,
        hostname: hostname ?? t.hostname,
        estado: "online",
      }).where(eq(totems.id, t.id));
      return res.json({ ok: true, serverTime: Date.now() });
    } catch (err) {
      console.error("heartbeat error", err);
      return res.status(500).json({ message: "Error en heartbeat" });
    }
  });

  // ── Pull master data ────────────────────────────────────────────────────
  // Returns rows from each table where updatedAt > since, scoped to the
  // totem's casino where applicable. Tombstones (deletedAt set) are included
  // so the client can mirror deletions.
  app.get("/api/totem/pull", requireTotem, async (req: AuthedTotemRequest, res: Response) => {
    try {
      const t = req.totem!;
      const since = new Date(parseInt((req.query.since as string) || "0", 10));
      const limit = Math.min(parseInt((req.query.limit as string) || "5000", 10), 10000);

      // Scope: casino principal + casinos secundarios configurados (extraCasinoIds).
      // extraCasinoIds se almacena como JSON array de strings en la BD.
      let extraIds: string[] = [];
      try {
        const parsed = JSON.parse(t.extraCasinoIds || "[]");
        if (Array.isArray(parsed)) extraIds = parsed.filter((x: any) => typeof x === "string");
      } catch { /* ignorar JSON inválido */ }
      const targetCasinoIds = [t.casinoId, ...extraIds];

      // ── Backfill automático al cambiar scope ────────────────────────────
      // Si el scope (conjunto de casinoIds) cambió desde el último pull,
      // ignoramos el cursor del cliente y forzamos since=0 para que el tótem
      // reciba TODOS los datos del nuevo alcance (backfill completo).
      // El hash es el JSON canónico (sorted) del scope actual.
      const currentScopeHash = JSON.stringify([...targetCasinoIds].sort());
      const scopeChanged = (t.scopeHash || "") !== currentScopeHash;
      const effectiveSince = scopeChanged ? new Date(0) : since;

      if (scopeChanged) {
        // Persistir el nuevo hash inmediatamente para que el próximo pull
        // ya no dispare otro backfill innecesario.
        await db.update(totems).set({ scopeHash: currentScopeHash }).where(eq(totems.id, t.id));
      }
      // ───────────────────────────────────────────────────────────────────

      const casinoFilter = (col: any) =>
        targetCasinoIds.length === 1
          ? eq(col, targetCasinoIds[0])
          : inArray(col, targetCasinoIds);

      // Subquery: ids de minutas de todos los casinos del tótem (para scope de pedidos).
      const minutaIdsForCasino = db.select({ id: minutas.id }).from(minutas).where(
        targetCasinoIds.length === 1
          ? eq(minutas.casinoId, targetCasinoIds[0])
          : inArray(minutas.casinoId, targetCasinoIds)
      );

      const [casinosRows, familiasRows, usersRows, minutasRows, periodosRows, pedidosRows] = await Promise.all([
        db.select().from(casinos).where(and(gt(casinos.updatedAt, effectiveSince), casinoFilter(casinos.id))).limit(limit),
        db.select().from(familias).where(gt(familias.updatedAt, effectiveSince)).limit(limit),
        db.select().from(users).where(and(gt(users.updatedAt, effectiveSince), casinoFilter(users.casinoId))).limit(limit),
        db.select().from(minutas).where(and(gt(minutas.updatedAt, effectiveSince), casinoFilter(minutas.casinoId))).limit(limit),
        db.select().from(periodos).where(and(gt(periodos.updatedAt, effectiveSince), casinoFilter(periodos.casinoId))).limit(limit),
        // Pedidos de todos los casinos del tótem (incluye tombstones para mirror de anulaciones).
        db.select().from(pedidos).where(and(gt(pedidos.updatedAt, effectiveSince), inArray(pedidos.minutaId, minutaIdsForCasino))).limit(limit),
      ]);

      // Update last sync marker
      await db.update(totems).set({ ultimoSync: new Date() }).where(eq(totems.id, t.id));

      // Compute the high-water mark from the rows actually returned so the
      // client advances its cursor only past data it has seen. Avoids the
      // "skip changes committed during pull window" race when paginating.
      const allRows = [...casinosRows, ...familiasRows, ...usersRows, ...minutasRows, ...periodosRows, ...pedidosRows];
      const maxUpdatedAt = allRows.reduce((m, r: any) => {
        const ts = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
        return ts > m ? ts : m;
      }, since.getTime());

      return res.json({
        serverTime: Date.now(),
        since: since.getTime(),
        // Client should set its next cursor to this exact value, NOT serverTime.
        nextCursor: maxUpdatedAt,
        data: {
          casinos:  casinosRows,
          familias: familiasRows,
          users:    usersRows,
          minutas:  minutasRows,
          periodos: periodosRows,
          pedidos:  pedidosRows,
        },
      });
    } catch (err) {
      console.error("pull error", err);
      return res.status(500).json({ message: "Error al sincronizar pull" });
    }
  });

  // ── Push pedidos generated locally on the totem ─────────────────────────
  // Body: { pedidos: [{ id, userId, minutaId, opcionSeleccionada, tipo, nombreVisita?, codigoQr?, createdAt(ms), origenTotemId }] }
  // Returns: { accepted: [ids], rejected: [{id, reason}] }
  app.post("/api/totem/push", requireTotem, async (req: AuthedTotemRequest, res: Response) => {
    try {
      const t = req.totem!;
      const incoming: any[] = Array.isArray(req.body?.pedidos) ? req.body.pedidos : [];
      const accepted: string[] = [];
      const rejected: { id: string; reason: string }[] = [];

      for (const p of incoming) {
        try {
          if (!p.id || !p.userId || !p.minutaId) {
            rejected.push({ id: p.id ?? "?", reason: "Faltan campos requeridos" });
            continue;
          }
          // Validate references exist and belong to this casino (defence in depth)
          const [m] = await db.select().from(minutas).where(eq(minutas.id, p.minutaId));
          if (!m) { rejected.push({ id: p.id, reason: "Minuta no existe" }); continue; }
          if (m.casinoId !== t.casinoId) { rejected.push({ id: p.id, reason: "Minuta de otro casino" }); continue; }
          const [u] = await db.select().from(users).where(eq(users.id, p.userId));
          if (!u) { rejected.push({ id: p.id, reason: "Usuario no existe" }); continue; }

          const payload: any = {
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
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            origenTotemId: t.id,
            updatedAt: new Date(),
            syncVersion: Date.now(),
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
              origenTotemId: t.id,
            },
          });
          accepted.push(p.id);
        } catch (e: any) {
          rejected.push({ id: p.id ?? "?", reason: e?.message || "error" });
        }
      }

      // Update pending counter (server-side hint; client also tracks locally)
      const remaining = Math.max(0, (t.pedidosPendientes ?? 0) - accepted.length);
      await db.update(totems).set({
        pedidosPendientes: remaining,
        ultimoSync: new Date(),
        ultimaConexion: new Date(),
      }).where(eq(totems.id, t.id));

      return res.json({ accepted, rejected, serverTime: Date.now() });
    } catch (err) {
      console.error("push error", err);
      return res.status(500).json({ message: "Error al sincronizar push" });
    }
  });

  // ── Sync status (local totem PWA only) ────────────────────────────────────
  // GET /api/totem/sync-status
  // No requiere autenticación de tótem — es una llamada local del kiosco PWA
  // al servidor Node que corre en la misma máquina (origen relativo).
  // Solo funciona en DB_MODE=totem; devuelve 404 en el cloud.
  //
  // Respuesta: { online, lastPullAt, lastPushAt, pendingOutbox }
  //   online        → true si el pull fue exitoso hace < 3 min
  //   lastPullAt    → epoch ms del último pull exitoso (o null)
  //   lastPushAt    → epoch ms del último push exitoso (o null)
  //   pendingOutbox → pedidos en la cola aún no subidos a la nube
  app.get("/api/totem/sync-status", (req: Request, res: Response) => {
    if (process.env.DB_MODE !== "totem" || !sqlite) return res.status(404).end();
    try {
      const getState = (key: string): string | null => {
        const row = sqlite!.prepare("SELECT value FROM sync_state WHERE key = ?").get(key) as any;
        return row?.value ?? null;
      };
      const lastPullSuccessRaw = getState("last_pull_success_at");
      const lastPushSuccessRaw = getState("last_push_success_at");
      const lastPullAt = lastPullSuccessRaw ? parseInt(lastPullSuccessRaw, 10) : null;
      const lastPushAt = lastPushSuccessRaw ? parseInt(lastPushSuccessRaw, 10) : null;
      // "online" = pull exitoso en los últimos 3 minutos
      const online = !!(lastPullAt && Date.now() - lastPullAt < 3 * 60_000);
      const { c: pendingOutbox } = sqlite!.prepare("SELECT COUNT(*) as c FROM sync_outbox WHERE acked = 0").get() as any;
      return res.json({ online, lastPullAt, lastPushAt, pendingOutbox: pendingOutbox ?? 0 });
    } catch (err) {
      console.error("[sync-status] error:", err);
      return res.status(500).json({ message: "Error consultando estado de sync" });
    }
  });

  // ── Latest release info (for auto-update) ───────────────────────────────
  app.get("/api/totem/version/latest", requireTotem, async (_req, res) => {
    try {
      const [r] = await db.select().from(totemReleases)
        .where(eq(totemReleases.publicada, true))
        .orderBy(sql`created_at DESC`)
        .limit(1);
      if (!r) return res.json({ version: null });
      return res.json({ version: r.version, url: r.url, sha256: r.sha256, obligatoria: r.obligatoria, notas: r.notas });
    } catch (err) {
      console.error("version latest error", err);
      return res.status(500).json({ message: "Error al consultar versión" });
    }
  });

  // ── Latest release info (for auto-update) — already above ──────────────

  // ── Lightweight pull-update bundle ──────────────────────────────────────
  // GET /api/totem/pull-update
  // Authenticated via totem credentials (X-Totem-Id + X-Totem-Secret).
  // Returns a ZIP with only: totem/runtime.js + totem/sync-worker.js + pwa/dist
  // (no node_modules/better-sqlite3 — much smaller than update-package).
  app.get("/api/totem/pull-update", requireTotem, async (_req: AuthedTotemRequest, res: Response) => {
    if (process.env.DB_MODE === "totem") return res.status(404).end();

    const cwd = process.cwd();
    const pwaDistDir = path.join(cwd, "pwa", "dist");
    const totemSrcDir = path.join(cwd, "totem");
    const tmpDir = path.join("/tmp", `totem-pull-update-${Date.now()}`);

    // Compile runtime.ts and sync-worker.ts (lightweight — no register.ts needed)
    const totemFiles = ["runtime.ts", "sync-worker.ts"];
    const compiled: string[] = [];

    if (fs.existsSync(totemSrcDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
      for (const file of totemFiles) {
        const src = path.join(totemSrcDir, file);
        if (!fs.existsSync(src)) continue;
        const outFile = path.join(tmpDir, file.replace(".ts", ".js"));
        const result = spawnSync(
          "npx",
          ["esbuild", src, "--platform=node", "--bundle", "--format=cjs",
            "--external:better-sqlite3", "--external:fsevents", `--outfile=${outFile}`],
          { cwd, encoding: "utf8", timeout: 120_000 },
        );
        if (result.status === 0) {
          compiled.push(file.replace(".ts", ".js"));
        } else {
          console.error(`[pull-update] esbuild error for ${file}:`, result.stderr?.slice(0, 200));
        }
      }
    }

    // Fail fast if required JS files could not be compiled
    const requiredFiles = ["runtime.js", "sync-worker.js"];
    const missing = requiredFiles.filter(f => !compiled.includes(f));
    if (missing.length > 0) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
      return res.status(500).json({
        message: `Error compilando archivos requeridos: ${missing.join(", ")}. Revisa los logs del servidor.`,
      });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="totem-pull-update-${Date.now()}.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err) => { console.error("[pull-update] archiver error:", err); res.end(); });
    archive.pipe(res);

    for (const jsFile of compiled) {
      const jsPath = path.join(tmpDir, jsFile);
      if (fs.existsSync(jsPath)) archive.file(jsPath, { name: `totem/${jsFile}` });
    }

    if (fs.existsSync(pwaDistDir)) {
      archive.directory(pwaDistDir, "pwa/dist");
    }

    await archive.finalize();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  // ── Fleet view (admin-only) ─────────────────────────────────────────────
  // Mounted in routes.ts since it needs the requireAdmin middleware there.
}

function generateSecret(len = 48) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = require("crypto").randomBytes(len);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
