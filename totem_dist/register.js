"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_db = require("../server/db");
var os = __toESM(require("os"));
process.env.DB_MODE = "totem";
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback ?? "";
}
async function main() {
  const nombre = arg("nombre", `Totem-${os.hostname()}`);
  const token = arg("token", process.env.TOTEM_BOOTSTRAP_TOKEN || "");
  const cloud = arg("cloud", process.env.CLOUD_URL || "https://app.buenamezcla.cl");
  const version = arg("version", "1.0.0");
  if (!token) {
    console.error("Uso: tsx totem/register.ts --token <bootstrap> [--nombre <n>] [--cloud <url>]");
    process.exit(1);
  }
  let ipLocal = "";
  const ifaces = os.networkInterfaces();
  for (const k of Object.keys(ifaces)) {
    for (const a of ifaces[k] || []) {
      if (!a.internal && a.family === "IPv4") {
        ipLocal = a.address;
        break;
      }
    }
    if (ipLocal) break;
  }
  const url = cloud.replace(/\/$/, "") + "/api/totem/register";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-bootstrap-token": token },
    body: JSON.stringify({ nombre, hostname: os.hostname(), ipLocal, version })
  });
  if (!res.ok) {
    console.error("Registro fall\xF3:", res.status, await res.text());
    process.exit(2);
  }
  const data = await res.json();
  console.log("Registrado:", data);
  import_db.sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("totem_id", data.totemId);
  import_db.sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("totem_secret", data.secret);
  import_db.sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("casino_id", data.casino.id);
  import_db.sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("casino_nombre", data.casino.nombre);
  import_db.sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("cloud_url", cloud);
  import_db.sqlite.prepare("INSERT OR REPLACE INTO totem_config(key, value) VALUES(?, ?)").run("version", version);
  console.log("Configuraci\xF3n guardada en totem_config. Listo para usar.");
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
