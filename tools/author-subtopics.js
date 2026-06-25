#!/usr/bin/env node
/* ============================================================
   Knowledge Atlas — hourly textbook-subtopic author
   Run by launchd once an hour. Each run is INDEPENDENT and has
   no memory of prior runs, so continuity comes from the ledger
   tools/authoring-progress.md: every run reads it, authors the
   next single pending topic, then appends a condensed entry so
   the next run knows exactly where to continue.

   This is a constrained, headless Claude Code authoring pass
   (Sonnet 4.6, file-editing tools allowed) - NOT the pure-QA
   answerer. It writes data files but never commits; you review.

     node tools/author-subtopics.js
   Env: ATLAS_MODEL (default claude-sonnet-4-6), ATLAS_CLAUDE,
        ATLAS_MAX_TURNS (default 80)
   ============================================================ */

"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const LEDGER = path.join(ROOT, "tools", "authoring-progress.md");
const MODEL = process.env.ATLAS_MODEL || "claude-sonnet-4-6";
const CLAUDE = process.env.ATLAS_CLAUDE || "claude";
const MAX_TURNS = process.env.ATLAS_MAX_TURNS || "80";

if (!fs.existsSync(LEDGER)) {
  fs.writeFileSync(
    LEDGER,
    "# Authoring progress ledger\n\nOne entry per hourly run. Newest at the bottom.\n\n",
  );
}

const PROMPT = `You are the hourly textbook-subtopic author for the Knowledge Atlas in this directory.

Do exactly ONE topic this run, then stop. Steps:

1. Read CLAUDE.md (the STATUS section lists which domains still lack textbook \`subtopics\`,
   and the conventions/depth bar). Read tools/authoring-progress.md - it records every topic
   already authored in past runs. Do NOT redo anything listed there.
2. Pick the NEXT single pending topic: a topic in a data/NN_*.js file whose \`subtopics\` array
   is missing or empty. Follow the suggested domain order in CLAUDE.md STATUS; within a domain,
   go in file order. Cross-check against the ledger so two runs never collide.
3. Author that ONE topic's \`subtopics\` array to the web3 depth bar: 5-9 substantial,
   textbook-length paragraphs per subtopic, with derivations, worked examples, real
   incidents/case studies, and edge cases; plus exact deep-link resources (specific pages,
   never homepages) and valid cross-domain \`connections\`. Match the web3 reference files exactly.
4. Apply it by editing the topic object in its existing data/NN_*.js file (add the \`subtopics\`
   array in place). If you instead split the domain into per-topic files, add the new
   <script> tags to index.html. Never create a duplicate topic id.
5. Run BOTH validators described in CLAUDE.md (structural + headless render). If either fails,
   fix it; if you cannot, revert your edit so the tree stays clean.
6. Append ONE condensed entry to tools/authoring-progress.md in this exact form:
   "## <ISO date> - <domainId>/<topicId>\\n- subtopics added: <n>\\n- files: <paths>\\n- next pending: <domainId>/<topicId or 'domain complete'>"

Do not commit. Do not touch unrelated topics. One topic, then stop.`;

console.error(`[atlas-author] ${new Date().toISOString()} model=${MODEL}`);
const res = spawnSync(
  CLAUDE,
  [
    "-p",
    PROMPT,
    "--model",
    MODEL,
    "--max-turns",
    MAX_TURNS,
    "--allowedTools",
    "Read,Edit,Write,Bash,Glob,Grep",
  ],
  { cwd: ROOT, stdio: "inherit", encoding: "utf8" },
);

if (res.error) {
  console.error(`[atlas-author] failed: ${res.error.message}`);
  process.exit(1);
}
process.exit(res.status || 0);
