#!/usr/bin/env node
/* ============================================================
   Knowledge Atlas — headless question answerer
   Zero deps. Bridges the offline atlas to Sonnet.

   Flow:
     1. In the atlas, open Notes → "Export questions" → questions.json
     2. node tools/answer.js [questions.json] [answers.json]
     3. In the atlas, open Notes → "Import answers" (answers.json)

   Each question is answered by a fresh, fully-headless Claude run:
   `claude -p` in print mode, model = Sonnet, ALL tools stripped
   (--allowedTools "" + --max-turns 1) so it is a pure question /
   answer takeaway with no tool use, no follow-ups, no preamble.

   Usage:
     node tools/answer.js                       # questions.json -> answers.json
     node tools/answer.js q.json a.json         # explicit paths
   Env:
     ATLAS_MODEL   model alias/id  (default: sonnet)
     ATLAS_CLAUDE  claude binary   (default: claude)
   ============================================================ */

"use strict";

const fs = require("fs");
const { execFileSync } = require("child_process");

const IN = process.argv[2] || "questions.json";
const OUT = process.argv[3] || "answers.json";
const MODEL = process.env.ATLAS_MODEL || "sonnet";
const CLAUDE = process.env.ATLAS_CLAUDE || "claude";

const SYSTEM =
  "You are answering one reader's question about a specific technical passage. " +
  "Reply with a single, self-contained takeaway in clear prose. " +
  "No tools, no follow-up questions, no preamble, no sign-off - just the answer.";

function readQuestions(path) {
  let raw;
  try {
    raw = fs.readFileSync(path, "utf8");
  } catch {
    console.error(
      `Cannot read ${path}. Export questions from the atlas first.`,
    );
    process.exit(1);
  }
  let qs;
  try {
    qs = JSON.parse(raw);
  } catch {
    console.error(`${path} is not valid JSON.`);
    process.exit(1);
  }
  if (!Array.isArray(qs) || !qs.length) {
    console.error(`${path} has no questions.`);
    process.exit(1);
  }
  return qs;
}

function buildPrompt(q) {
  const ctx = q.context || {};
  const topic = ctx.topic ? ` (topic: ${ctx.topic})` : "";
  const quote = ctx.quote
    ? `Highlighted passage${topic}:\n"""${ctx.quote}"""\n\n`
    : "";
  return `${quote}Question: ${q.question}`;
}

function answerOne(q) {
  return execFileSync(
    CLAUDE,
    [
      "-p",
      buildPrompt(q),
      "--model",
      MODEL,
      "--max-turns",
      "1",
      "--allowedTools",
      "",
      "--append-system-prompt",
      SYSTEM,
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  ).trim();
}

function main() {
  const questions = readQuestions(IN);
  const answers = [];
  for (const q of questions) {
    if (!q || !q.id || !q.question) {
      console.error("Skipping malformed question entry:", q);
      continue;
    }
    process.stderr.write(`answering ${q.id} … `);
    try {
      const answer = answerOne(q);
      answers.push({ id: q.id, answer, answeredAt: new Date().toISOString() });
      console.error("ok");
    } catch (err) {
      console.error(`failed: ${err.message.split("\n")[0]}`);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(answers, null, 2));
  console.error(
    `\nWrote ${answers.length}/${questions.length} answers -> ${OUT}`,
  );
}

main();
