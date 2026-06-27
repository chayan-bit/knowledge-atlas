#!/usr/bin/env node
/* ============================================================
   Knowledge Atlas — local companion server
   Zero deps. Binds 127.0.0.1 ONLY. Optional: the atlas works
   fully offline without it; when it IS running, it unlocks the
   live LLM features (#1-#5) and live Obsidian vault sync.

     node tools/server.js            # http://127.0.0.1:4173
     ATLAS_PORT=5000 node tools/server.js

   Env:
     ATLAS_PORT        port               (default 4173)
     ATLAS_MODEL       default model      (default claude-sonnet-4-6)
     ATLAS_CLAUDE      claude binary      (default claude)
     ATLAS_VAULT       Obsidian sync dir  (default <repo>/../Knowledge-Atlas-Notes)
     ATLAS_FAKE_LLM    1 → canned LLM replies (for tests, no spend)
     ATLAS_MEMORY_DB   second-brain FTS5  (default ~/.claude/memory/memory.db)
     ATLAS_MEMORY_VAULT distilled .md dir (default ~/Desktop/SecondBrain/08_ClaudeMemory)

   Endpoints (all JSON unless noted):
     GET  /                      → static site (same-origin, no CORS)
     GET  /api/ping              → { ok, vault, model }
     POST /api/llm               { model?, system?, prompt } → { text }
     POST /api/answer-question   { id?, question, context? } → { id, answer, answeredAt }
     POST /api/note-gap          { note, context? }          → { added, gap? }
     POST /api/vault             { relPath, content }        → { ok }
     GET  /api/store?name=gaps   → parsed store/<name>.json (or [])
     POST /api/store?name=gaps   <json body>                 → { ok }
     GET  /api/memory?q=&k=      → { hits: [{ title, excerpt, source }] }
   ============================================================ */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const memory = require("./memory");

const ROOT = path.resolve(__dirname, "..");
const STORE = path.join(ROOT, "store");
const PORT = parseInt(process.env.ATLAS_PORT || "4173", 10);
const MODEL = process.env.ATLAS_MODEL || "claude-sonnet-4-6";
const CLAUDE = process.env.ATLAS_CLAUDE || "claude";
const VAULT = path.resolve(
  process.env.ATLAS_VAULT || path.join(ROOT, "..", "Knowledge-Atlas-Notes")
);
const HOME = process.env.HOME || process.env.USERPROFILE || "";
// Personal "second brain" memory: an FTS5 SQLite index (preferred, lexical
// recall) with a distilled-markdown vault as the fallback. Both configurable.
const MEMORY_DB = path.resolve(
  process.env.ATLAS_MEMORY_DB || path.join(HOME, ".claude", "memory", "memory.db")
);
const MEMORY_VAULT = path.resolve(
  process.env.ATLAS_MEMORY_VAULT ||
    path.join(HOME, "Desktop", "SecondBrain", "08_ClaudeMemory")
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

// ---- in-site answering + note→gap ----------------------------
// Mirrors tools/answer.js so a question asked in the atlas is resolved
// live, without the Export → answer.js → Import round-trip.
const ANSWER_SYSTEM =
  "You are answering one reader's question about a specific technical passage. " +
  "Reply with a single, self-contained takeaway in clear prose. " +
  "No tools, no follow-up questions, no preamble, no sign-off - just the answer.";

function buildAnswerPrompt(q) {
  const ctx = q.context || {};
  const topic = ctx.topic ? ` (topic: ${ctx.topic})` : "";
  const quote = ctx.quote ? `Highlighted passage${topic}:\n"""${ctx.quote}"""\n\n` : "";
  return `${quote}Question: ${q.question}`;
}

// Decide whether a reader's note hides a durable knowledge gap worth studying.
const GAP_SYSTEM =
  "You triage one reader's note left on a technical passage for a DURABLE knowledge gap worth " +
  "studying later - a concept that was fuzzy, a 'why does this work', an explicit 'need to understand X'. " +
  "Ignore plain remarks, opinions, reminders, and settled facts. " +
  'Output ONLY JSON: {"gap":bool,"title":"<=120 chars","summary":"<=200 chars: what is not understood",' +
  '"note":"<=200 chars: how to close it"}. If there is no durable gap, {"gap":false}.';

function buildGapPrompt(n) {
  const ctx = n.context || {};
  const topic = ctx.topic ? `Topic: ${ctx.topic}\n` : "";
  const quote = ctx.quote ? `Passage:\n"""${ctx.quote}"""\n` : "";
  return `${topic}${quote}\nReader's note:\n${n.note}`;
}

// tolerant JSON-object extraction from an LLM reply (handles ```fences```)
function extractJSON(text) {
  const s = String(text || "");
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : s;
  const a = raw.indexOf("{");
  const b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(raw.slice(a, b + 1));
  } catch {
    return null;
  }
}

const gapId = () => "g_" + Math.random().toString(36).slice(2, 10);

// Append one gap to store/gaps.json in the same schema as tools/extract-gaps.js.
function appendGap(gap) {
  const file = path.join(STORE, "gaps.json");
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }
  const next = existing.concat([gap]);
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return gap;
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

  if (pathname === "/api/answer-question" && req.method === "POST") {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJSON(res, 400, { error: "bad json" });
    }
    if (!body.question || !String(body.question).trim())
      return sendJSON(res, 400, { error: "question required" });
    return runClaude(
      { model: MODEL, system: ANSWER_SYSTEM, prompt: buildAnswerPrompt(body) },
      (err, text) =>
        err
          ? sendJSON(res, 500, { error: err.message })
          : sendJSON(res, 200, {
              id: body.id || "",
              answer: text,
              answeredAt: new Date().toISOString(),
            })
    );
  }

  if (pathname === "/api/note-gap" && req.method === "POST") {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJSON(res, 400, { error: "bad json" });
    }
    if (!body.note || !String(body.note).trim())
      return sendJSON(res, 400, { error: "note required" });
    return runClaude(
      { model: MODEL, system: GAP_SYSTEM, prompt: buildGapPrompt(body) },
      (err, text) => {
        if (err) return sendJSON(res, 500, { error: err.message });
        const parsed = extractJSON(text);
        if (!parsed || !parsed.gap || !parsed.summary)
          return sendJSON(res, 200, { added: false });
        const ctx = body.context || {};
        const gap = appendGap({
          id: gapId(),
          createdAt: new Date().toISOString(),
          project: "atlas-note",
          sessionCwd: ROOT,
          source: "note",
          title: String(parsed.title || parsed.summary).slice(0, 120),
          domain: String(ctx.domain || "").slice(0, 120),
          topicId: String(ctx.topicId || "").slice(0, 120),
          gap: String(parsed.summary).slice(0, 200),
          note: String(parsed.note || "").slice(0, 200),
          state: "open",
        });
        return sendJSON(res, 200, { added: true, gap });
      }
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

  if (pathname === "/api/memory" && req.method === "GET") {
    const q = String(query.get("q") || "").slice(0, 2000);
    const k = query.get("k");
    if (!q.trim()) return sendJSON(res, 200, { hits: [] });
    try {
      const hits = memory.recall(q, k, { dbPath: MEMORY_DB, vaultDir: MEMORY_VAULT });
      return sendJSON(res, 200, { hits });
    } catch {
      // never let a recall failure break the study features
      return sendJSON(res, 200, { hits: [] });
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
