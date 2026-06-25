#!/usr/bin/env node
/* ============================================================
   Knowledge Atlas — end-of-session knowledge-gap extractor
   Invoked by the global SessionEnd hook (via ~/.claude/bin/atlas-gaps.sh).
   Reads the finished session transcript, and Sonnet 4.6 decides whether
   any DURABLE technical knowledge gaps surfaced while building something
   real (RunEntity, NeuralYul, a research project, ...) vs generic plumbing.
   Relevant gaps are tagged to the closest atlas domain/topic and appended
   to store/gaps.json, which the atlas surfaces as a "Gaps inbox".

   Uses claude with ALL tools stripped (pure classification/extraction).
   Self-gating: writes nothing when the session is generic. Always exits 0
   so it can never block a session from ending.

     atlas-gaps.sh feeds the hook JSON on stdin; or run manually:
     node tools/extract-gaps.js /path/to/transcript.jsonl
   ============================================================ */

"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const STORE = path.join(ROOT, "store");
const GAPS = path.join(STORE, "gaps.json");
const MODEL = process.env.ATLAS_MODEL || "claude-sonnet-4-6";
const CLAUDE = process.env.ATLAS_CLAUDE || "claude";
const MAX_TRANSCRIPT = 48000; // chars of recent conversation to consider

function bail(msg) {
  if (msg) console.error("[atlas-gaps] " + msg);
  process.exit(0); // never block session end
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

// ---- resolve transcript + cwd from hook payload or argv ------
function resolveInput() {
  const argPath = process.argv[2];
  if (argPath && fs.existsSync(argPath))
    return { transcript: argPath, cwd: process.cwd() };
  const raw = readStdin();
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    return {
      transcript: p.transcript_path || p.transcriptPath,
      cwd: p.cwd || process.cwd(),
    };
  } catch {
    return null;
  }
}

// ---- condense a JSONL transcript into plain text -------------
function condense(file) {
  let lines;
  try {
    lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
  } catch {
    return "";
  }
  const out = [];
  for (const ln of lines) {
    let o;
    try {
      o = JSON.parse(ln);
    } catch {
      continue;
    }
    const m = o.message || o;
    const role = m.role || o.type;
    if (role !== "user" && role !== "assistant") continue;
    let text = "";
    if (typeof m.content === "string") text = m.content;
    else if (Array.isArray(m.content))
      text = m.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join(" ");
    if (text.trim()) out.push(`${role.toUpperCase()}: ${text.trim()}`);
  }
  const joined = out.join("\n");
  return joined.length > MAX_TRANSCRIPT
    ? joined.slice(-MAX_TRANSCRIPT)
    : joined;
}

// ---- atlas id catalogue for tagging -------------------------
function atlasCatalogue() {
  const g = {};
  global.window = g;
  g.ATLAS = [];
  try {
    require(path.join(ROOT, "data", "_init.js"));
    for (const f of fs
      .readdirSync(path.join(ROOT, "data"))
      .filter((x) => x.endsWith(".js") && x !== "_init.js")
      .sort())
      require(path.join(ROOT, "data", f));
  } catch (e) {
    return "";
  }
  return (g.ATLAS || [])
    .map(
      (d) =>
        `${d.id} (${d.title}): ` + (d.topics || []).map((t) => t.id).join(", "),
    )
    .join("\n");
}

function runClaude(prompt, system) {
  if (process.env.ATLAS_FAKE_LLM)
    return (
      process.env.ATLAS_FAKE_GAPS || '{"relevant":false,"project":"","gaps":[]}'
    );
  return execFileSync(
    CLAUDE,
    [
      "-p",
      prompt,
      "--model",
      MODEL,
      "--max-turns",
      "1",
      "--allowedTools",
      "",
      "--append-system-prompt",
      system,
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  ).trim();
}

function extractJSON(text) {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = f ? f[1] : text;
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  if (s < 0 || e < s) return null;
  try {
    return JSON.parse(raw.slice(s, e + 1));
  } catch {
    return null;
  }
}

function main() {
  const input = resolveInput();
  if (!input || !input.transcript) return bail("no transcript");
  if (input.cwd && path.resolve(input.cwd) === ROOT)
    return bail("skip: editing the atlas itself");
  const convo = condense(input.transcript);
  if (convo.length < 600) return bail("skip: transcript too short");

  const catalogue = atlasCatalogue();
  const system =
    "You triage a finished engineering/research session for DURABLE technical knowledge gaps worth studying later - " +
    "concepts that were fuzzy, hard problems hit, things explicitly noted as 'need to understand X'. " +
    "Ignore routine plumbing, config, and generic project work. " +
    'Output ONLY JSON: {"relevant":bool,"project":"<short name>","gaps":[{"title":"","domain":"<atlas domain id>","topicId":"<atlas topic id or empty>","gap":"<what is not understood, <=160 chars>","note":"<how to close it, <=160 chars>"}]}. ' +
    "Map each gap to the closest atlas domain/topic id from the catalogue. Max 6 gaps. If nothing durable, relevant=false and gaps=[].";
  const prompt =
    `Atlas catalogue (domainId (title): topicIds):\n${catalogue}\n\n` +
    `Session transcript (recent):\n${convo}`;

  let parsed;
  try {
    parsed = extractJSON(runClaude(prompt, system));
  } catch (e) {
    return bail("llm error: " + e.message.split("\n")[0]);
  }
  if (
    !parsed ||
    !parsed.relevant ||
    !Array.isArray(parsed.gaps) ||
    !parsed.gaps.length
  )
    return bail("no durable gaps");

  fs.mkdirSync(STORE, { recursive: true });
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(GAPS, "utf8"));
  } catch {
    existing = [];
  }
  const stamp = new Date().toISOString();
  for (const g of parsed.gaps.slice(0, 6)) {
    if (!g || !g.gap) continue;
    existing.push({
      id: "g_" + Math.random().toString(36).slice(2, 10),
      createdAt: stamp,
      project: parsed.project || "",
      sessionCwd: input.cwd || "",
      title: String(g.title || g.gap).slice(0, 120),
      domain: g.domain || "",
      topicId: g.topicId || "",
      gap: String(g.gap).slice(0, 200),
      note: String(g.note || "").slice(0, 200),
      state: "open",
    });
  }
  fs.writeFileSync(GAPS, JSON.stringify(existing, null, 2));
  console.error(
    `[atlas-gaps] +${parsed.gaps.length} gaps from "${parsed.project || "session"}"`,
  );
  process.exit(0);
}

try {
  main();
} catch (e) {
  bail("fatal: " + e.message);
}
