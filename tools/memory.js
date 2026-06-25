"use strict";
/* ============================================================
   Knowledge Atlas — personal "second brain" memory recall.
   Zero external deps. Lexical (keyword) recall over the user's
   distilled memories, used to ground the LLM study features in
   what the user has already learned/noted.

   Source resolution, most robust first:
     1. node:sqlite over the FTS5 index (if the runtime has it)
     2. the `sqlite3` CLI over the same index
     3. grep the distilled-markdown vault
   Every layer degrades to an empty list, so the app keeps working
   when no store is present. Returns: [{ title, excerpt, source }].
   ============================================================ */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SNIPPET = 240; // excerpt length, chars
const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "it",
  "with", "as", "by", "at", "be", "this", "that", "are", "from", "how", "what",
  "why", "your", "you", "i", "me", "my",
]);

// Pull meaningful FTS5 tokens out of free text (topic/notes/question).
function tokens(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .slice(0, 24);
}

// Strip the leading [slug.md] marker + YAML frontmatter the index stores,
// then collapse whitespace into a short excerpt.
function cleanExcerpt(content) {
  let s = String(content || "");
  s = s.replace(/^\s*\[[^\]]*\]\s*/, "");
  s = s.replace(/^\s*---[\s\S]*?---\s*/, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s.length > SNIPPET ? s.slice(0, SNIPPET).trim() + "…" : s;
}

// Derive a human title: prefer frontmatter `title:`, else the first heading,
// else the slug from the [slug.md] marker.
function deriveTitle(content) {
  const fm = String(content || "").match(/title:\s*"?([^"\n]+)"?/);
  if (fm) return fm[1].replace(/\|.*$/, "").trim().slice(0, 120);
  const h = String(content || "").match(/^#+\s+(.+)$/m);
  if (h) return h[1].trim().slice(0, 120);
  const slug = String(content || "").match(/^\s*\[([^\]]+)\]/);
  if (slug) return path.basename(slug[1]).replace(/\.md$/i, "");
  return "memory";
}

function sourceOf(content) {
  const m = String(content || "").match(/^\s*\[([^\]]+)\]/);
  return m ? m[1] : "";
}

function ftsMatch(q) {
  const toks = tokens(q);
  if (!toks.length) return "";
  return toks.map((t) => `"${t}"`).join(" OR ");
}

function rows(content, k) {
  return content.slice(0, k).map((c) => ({
    title: deriveTitle(c),
    excerpt: cleanExcerpt(c),
    source: sourceOf(c),
  }));
}

// --- layer 1: node:sqlite ------------------------------------
function viaNodeSqlite(dbPath, match, k) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    return null; // runtime has no node:sqlite → try next layer
  }
  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const stmt = db.prepare(
      "SELECT content FROM memory WHERE memory MATCH ? ORDER BY rank LIMIT ?"
    );
    const out = stmt.all(match, k);
    return rows(out.map((r) => r.content), k);
  } catch {
    return null;
  } finally {
    try {
      if (db) db.close();
    } catch {
      /* ignore */
    }
  }
}

// --- layer 2: sqlite3 CLI ------------------------------------
function viaSqliteCli(dbPath, match, k) {
  // -separator with a marker we can split on; FTS5 ORDER BY rank.
  const sql =
    "SELECT content FROM memory WHERE memory MATCH " +
    "'" + match.replace(/'/g, "''") + "' ORDER BY rank LIMIT " + k + ";";
  let out;
  try {
    out = execFileSync("sqlite3", ["-separator", "", dbPath, sql], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      timeout: 5000,
    });
  } catch {
    return null; // no sqlite3 binary, or query failed
  }
  // sqlite3 separates rows by newline; content itself has newlines, so use
  // the [slug.md] marker (always at a row start) as a record delimiter.
  const records = out.split(/\n(?=\[[^\]]+\])/).map((r) => r.trim()).filter(Boolean);
  return rows(records, k);
}

// --- layer 3: grep the markdown vault ------------------------
function viaVault(vaultDir, q, k) {
  let files;
  try {
    files = fs.readdirSync(vaultDir).filter((f) => /\.md$/i.test(f));
  } catch {
    return [];
  }
  const toks = tokens(q);
  if (!toks.length) return [];
  const scored = [];
  for (const f of files) {
    let text;
    try {
      text = fs.readFileSync(path.join(vaultDir, f), "utf8");
    } catch {
      continue;
    }
    const lower = text.toLowerCase();
    let score = 0;
    for (const t of toks) if (lower.includes(t)) score++;
    if (score > 0) scored.push({ score, text: "[" + f + "] " + text });
  }
  scored.sort((a, b) => b.score - a.score);
  return rows(scored.slice(0, k).map((s) => s.text), k);
}

// Public: recall up to k snippets relevant to the free-text query.
// Never throws; returns [] when no store is found.
function recall(query, k, opts) {
  const kk = Math.max(1, Math.min(parseInt(k, 10) || 6, 20));
  const dbPath = (opts && opts.dbPath) || "";
  const vaultDir = (opts && opts.vaultDir) || "";
  const match = ftsMatch(query);

  if (match && dbPath && fs.existsSync(dbPath)) {
    const a = viaNodeSqlite(dbPath, match, kk);
    if (a && a.length) return a;
    const b = viaSqliteCli(dbPath, match, kk);
    if (b && b.length) return b;
  }
  if (vaultDir) return viaVault(vaultDir, query, kk);
  return [];
}

module.exports = { recall, tokens };
