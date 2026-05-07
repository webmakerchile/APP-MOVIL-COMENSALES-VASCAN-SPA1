// CLI: register this PC as a tótem against the cloud.
//   tsx totem/register.ts --nombre "Tótem Comedor 1" --casino <casino-uuid> \
//        --token <bootstrap-token> --cloud https://app.buenamezcla.cl
//
// Persists the issued totemId/secret inside the local SQLite (totem_config).
process.env.DB_MODE = "totem";
import { sqlite } from "../server/db";
import * as os from "os";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback ?? "";
}

async function main() {
  const nombre = arg("nombre", `Totem-${os.hostname()}`);
  const casinoId = arg("casino");
  const token = arg("token", process.env.TOTEM_BOOTSTRAP_TOKEN || "");
  const cloud = arg("cloud", process.env.CLOUD_URL || "https://app.buenamezcla.cl");
  const version = arg("version", "1.0.0");

  if (!casinoId || !token) {
    console.error("Uso: tsx totem/register.ts --casino <id> --token <bootstrap> [--nombre <n>] [--cloud <url>]");
    process.exit(1);
  }

  // Detect first non-internal IPv4
  let ipLocal = "";
  const ifaces = os.networkInterfaces();
  for (const k of Object.keys(ifaces)) {
    for (const a of ifaces[k] || []) {
      if (!a.internal && a.family === "IPv4") { ipLocal = a.address; break; }
    }
    if (ipLocal) break;
  }

  const url = cloud.replace(/\/$/, "") + "/api/totem/register";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bootstrap-token": token },
    body: JSON.stringify({ nombre, casinoId, hostname: os.hostname(), ipLocal, version }),
  });
  if (!res.ok) {
    console.error("Registro falló:", res.status, await res.text());
    process.exit(2);
  }
  const data: any = await res.json();
  console.log("Registrado:", data);

  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("totem_id", data.totemId);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("totem_secret", data.secret);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("casino_id", data.casino.id);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("casino_nombre", data.casino.nombre);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("cloud_url", cloud);
  sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("version", version);

  console.log("Configuración guardada en totem_config. Listo para usar.");
}

main().catch(err => { console.error(err); process.exit(1); });
