// helper.mjs - Servizio di supporto alla collection Postman (solo locale, 127.0.0.1:8788).
// Postman non può leggere il D1 locale né caricare file su Telegram: lo fa questo helper.
//   POST /seed            riesegue postman/seed-smoke.sql sul D1 locale
//   POST /query {sql}     esegue una SELECT sul D1 locale e restituisce { rows }
//   POST /upload {file}   invia postman/fixtures/<file> nella chat del proprietario e restituisce
//                         { file_id, file_name, file_size } da usare in un update finto
//   GET  /health          { ok: true }
// Token e id del proprietario si leggono da .dev.vars. Lancio: node postman/helper.mjs
// (lo avvia scripts/smoke-postman.ps1).

import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 8788;
const DB_NAME = "birthday-bot-db";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRANGLER = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");

function readDevVars() {
  const vars = {};
  for (const line of readFileSync(join(ROOT, ".dev.vars"), "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

const vars = readDevVars();
const token = vars.TELEGRAM_BOT_TOKEN ?? "";
const ownerId = vars.OWNER_TELEGRAM_ID ?? "";
if (!token || !/^\d+$/.test(ownerId)) {
  console.error("[helper] TELEGRAM_BOT_TOKEN o OWNER_TELEGRAM_ID mancanti in .dev.vars");
  process.exit(1);
}

// Wrangler lanciato con lo stesso Node, senza shell: l'SQL passa come argomento senza escape.
function runWrangler(args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [WRANGLER, ...args], { cwd: ROOT, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || stdout || err.message).trim().split("\n").slice(-5).join("\n")));
      else resolve(stdout);
    });
  });
}

// Un comando alla volta, con 3 tentativi: due `d1 execute --local` in parallelo falliscono a
// intermittenza ("Failed to get session commit token").
let queue = Promise.resolve();
function wrangler(args) {
  const run = async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await runWrangler(args);
      } catch (err) {
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

async function query(sql) {
  if (!/^\s*(select|with)\b/i.test(sql)) throw new Error("solo SELECT");
  const out = await wrangler(["d1", "execute", DB_NAME, "--local", "--json", "--command", sql]);
  const parsed = JSON.parse(out.slice(out.indexOf("[")));
  return parsed[0]?.results ?? [];
}

// file_id già ottenuti: lo stesso file non si ricarica a ogni richiesta.
const uploaded = new Map();

async function upload(file) {
  const name = basename(String(file ?? ""));
  if (!name) throw new Error("file mancante");
  const cached = uploaded.get(name);
  if (cached) return cached;
  const content = readFileSync(join(ROOT, "postman", "fixtures", name));
  const form = new FormData();
  form.append("chat_id", ownerId);
  form.append("caption", `📎 File di prova Postman: ${name}`);
  form.append("document", new Blob([content]), name);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
  const data = await res.json();
  if (!data.ok) throw new Error(`sendDocument: ${data.error_code} ${data.description ?? ""}`);
  const doc = data.result.document;
  const info = { file_id: doc.file_id, file_name: doc.file_name ?? name, file_size: doc.file_size ?? content.length };
  uploaded.set(name, info);
  return info;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", `http://localhost:${PORT}`).pathname;
  try {
    if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true });
    if (req.method === "POST" && path === "/seed") {
      await wrangler(["d1", "execute", DB_NAME, "--local", "--file", join("postman", "seed-smoke.sql")]);
      console.log("[helper] seed eseguito");
      return send(res, 200, { ok: true });
    }
    if (req.method === "POST" && path === "/query") {
      const { sql } = await readBody(req);
      return send(res, 200, { rows: await query(String(sql ?? "")) });
    }
    if (req.method === "POST" && path === "/upload") {
      const { file } = await readBody(req);
      const info = await upload(file);
      console.log(`[helper] caricato ${info.file_name}`);
      return send(res, 200, info);
    }
    send(res, 404, { error: "endpoint sconosciuto" });
  } catch (err) {
    console.error(`[helper] ${path}: ${err.message}`);
    send(res, 500, { error: err.message });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`[helper] in ascolto su http://localhost:${PORT} (Ctrl+C per fermarlo)`);
});
