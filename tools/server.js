#!/usr/bin/env node
/* ============================================================
   Knowledge Atlas — local companion server
   Zero deps. Binds 127.0.0.1 ONLY. Optional: the atlas works
   fully offline without it; when it IS running, it unlocks the
   live LLM features (#1-#5) and live Obsidian vault sync.

     node tools/server.js            # http://127.0.0.1:4173
     ATLAS_PORT=5000 node tools/server.js

   Env:
     ATLAS_PORT     port              (default 4173)
     ATLAS_MODEL    default model     (default claude-sonnet-4-6)
     ATLAS_CLAUDE   claude binary     (default claude)
     ATLAS_VAULT    Obsidian sync dir (default <repo>/../Knowledge-Atlas-Notes)
     ATLAS_FAKE_LLM 1 → canned LLM replies (for tests, no spend)

   Endpoints (all JSON unless noted):
     GET  /                      → static site (same-origin, no CORS)
     GET  /api/ping              → { ok, vault, model }
     POST /api/llm               { model?, system?, prompt } → { text }
     POST /api/vault             { relPath, content }        → { ok }
     GET  /api/store?name=gaps   → parsed store/<name>.json (or [])
     POST /api/store?name=gaps   <json body>                 → { ok }
   ============================================================ */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const STORE = path.join(ROOT, "store");
const PORT = parseInt(process.env.ATLAS_PORT || "4173", 10);
const MODEL = process.env.ATLAS_MODEL || "claude-sonnet-4-6";
const CLAUDE = process.env.ATLAS_CLAUDE || "claude";
const VAULT = path.resolve(
  process.env.ATLAS_VAULT || path.join(ROOT, "..", "Knowledge-Atlas-Notes")
);

fs.mkdirSync(STORE, { recursive: true });
fs.mkdirSync(VAULT, { recursive: true });

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// ---- helpers -------------------------------------------------
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "content-type": "application/json" });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 8 * 1024 * 1024) reject(new Error("body too large"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
// reject any path that escapes `base`
function safeJoin(base, rel) {
  const p = path.resolve(base, "." + path.sep + String(rel || "").replace(/^[/\\]+/, ""));
  if (p !== base && !p.startsWith(base + path.sep)) return null;
  return p;
}
const storeName = (q) => (/^[a-z0-9_-]+$/i.test(q || "") ? q : null);

function runClaude({ model, system, prompt }, cb) {
  if (!prompt) return cb(new Error("prompt required"));
  if (process.env.ATLAS_FAKE_LLM) {
    return cb(null, `[fake ${model || MODEL}] ${String(prompt).slice(0, 120)}`);
  }
  const args = ["-p", String(prompt), "--model", model || MODEL, "--max-turns", "1", "--allowedTools", ""];
  if (system) args.push("--append-system-prompt", String(system));
  execFile(CLAUDE, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) return cb(new Error((stderr || err.message).split("\n")[0]));
    cb(null, String(stdout).trim());
  });
}

// ---- static ---------------------------------------------------
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  const file = safeJoin(ROOT, rel);
  if (!file) return sendJSON(res, 403, { error: "forbidden" });
  fs.readFile(file, (err, buf) => {
    if (err) return sendJSON(res, 404, { error: "not found" });
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(buf);
  });
}

// ---- api ------------------------------------------------------
async function handleApi(req, res, pathname, query) {
  if (pathname === "/api/ping") return sendJSON(res, 200, { ok: true, vault: VAULT, model: MODEL });

  if (pathname === "/api/llm" && req.method === "POST") {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJSON(res, 400, { error: "bad json" });
    }
    return runClaude(body, (err, text) =>
      err ? sendJSON(res, 500, { error: err.message }) : sendJSON(res, 200, { text })
    );
  }

  if (pathname === "/api/vault" && req.method === "POST") {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJSON(res, 400, { error: "bad json" });
    }
    const file = safeJoin(VAULT, body.relPath);
    if (!file || !/\.md$/i.test(file)) return sendJSON(res, 400, { error: "bad path" });
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, String(body.content ?? ""));
      return sendJSON(res, 200, { ok: true });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  if (pathname === "/api/store") {
    const name = storeName(query.get("name"));
    if (!name) return sendJSON(res, 400, { error: "bad name" });
    const file = path.join(STORE, name + ".json");
    if (req.method === "GET") {
      try {
        return sendJSON(res, 200, JSON.parse(fs.readFileSync(file, "utf8")));
      } catch {
        return sendJSON(res, 200, []);
      }
    }
    if (req.method === "POST") {
      let body;
      try {
        body = await readBody(req);
        JSON.parse(body); // validate
      } catch {
        return sendJSON(res, 400, { error: "bad json" });
      }
      try {
        fs.writeFileSync(file, body);
        return sendJSON(res, 200, { ok: true });
      } catch (e) {
        return sendJSON(res, 500, { error: e.message });
      }
    }
  }

  return sendJSON(res, 404, { error: "no such endpoint" });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (u.pathname.startsWith("/api/")) return handleApi(req, res, u.pathname, u.searchParams);
  if (req.method !== "GET") return sendJSON(res, 405, { error: "method not allowed" });
  serveStatic(req, res, u.pathname);
});

server.listen(PORT, "127.0.0.1", () => {
  console.error(`Knowledge Atlas companion → http://127.0.0.1:${PORT}`);
  console.error(`  model: ${MODEL}   vault: ${VAULT}`);
  if (process.env.ATLAS_FAKE_LLM) console.error("  (ATLAS_FAKE_LLM: canned replies)");
});
