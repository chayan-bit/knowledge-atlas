# Knowledge Atlas - project guide

Local, offline, dependency-free SPA: 13 technical domains as one connected knowledge graph.
Each topic has a write-up, **exact** deep-links (specific pages, never homepages), and cross-domain connection chips.
Open `index.html` via `file://` - no server, build, or network.

## Architecture

- **`index.html`** - shell + ordered `<script>`/`<link>` tags: loads `data/_init.js`, every `data/NN_*.js`, then `app.js`, `annotations.js`, `intelligence.js`. Add a tag for any new file.
- **`styles.css`** - dark theme; per-domain accent via `--d`. `annotations.css`, `intelligence.css` - layer styles.
- **`app.js`** - vanilla-JS engine (IIFE, no deps): hash router (`#/`, `#/domains`, `#/connections`, `#/d/:domainId/:topicId`), renderer, SVG radial graph, search (`/`). Renders `window.ATLAS` only - **never hardcode content here**.
- **`annotations.js`** - note layer (see below). Self-contained; never edits `app.js`.
- **`intelligence.js`** - LLM study features + Obsidian sync (see below). Talks to the companion server; degrades gracefully to "server off" when it's not running.
- **`data/_init.js`** - data contract + `atlasAdd()`, which **merges by domain id** (first call sets meta, later calls append topics - lets one domain span files).
- **`data/NN_*.js`** - the knowledge, one domain per number. Web3 (#12) is split: `12_web3.js` (meta) + `12_web3_1..9_*.js` (one file per topic).
- **`tools/*`** - node, zero-dep: `server.js` (companion), `answer.js` (headless Q&A), `author-subtopics.js` (hourly author), `extract-gaps.js` (SessionEnd gap extractor).
- **`store/*.json`** - server-written state read back by the app: `gaps.json`, `suggestions.json`, `user_connections.json`. Not committed content; the app's source of truth stays localStorage.

## Data schema

```js
atlasAdd({
  id, num, title, icon, color, tagline,
  overview: ["para", ...],
  topics: [{
    id,                  // globally unique; target of connection links
    title, level,        // `level` strings group into curriculum sections
    body: ["para", ...], // markdown-lite: **bold** `code` _em_
    subtopics: [{ title, body: ["para", ...],
      resources: [{ label, url, type, note? }] }],   // textbook deep-dive (optional)
    resources: [{ label, url, type, note? }],         // topic reading list
    connections: [{ to: "<topicId|domainId>", note }], // cross-links
  }],
});
```

Resource `type` ∈ `docs · paper · course · book · tool · video · repo · practice`.

## Annotation layer (`annotations.js` + `annotations.css` + `tools/answer.js`)

Reader notes over the rendered atlas, fully offline.
Three kinds, all in localStorage (`KA_ANNOTATIONS_V1`) and round-trippable to JSON:

- **comment** - on selected text (select → toolbar) or a whole resource/connection (hover → ✎). Fire-and-forget `/api/note-gap` triages it into the AI Gaps inbox if it hides a durable knowledge gap.
- **link** - your own cross-link to a topic/domain id (datalist) or any URL, with a note.
- **question** - auto-answered in-site via `/api/answer-question` when the companion server is running (no export/import needed). Falls back to headless `tools/answer.js` when offline.

**Notes** nav button opens a slide-over panel: list grouped per topic, per-topic 📝 badges, edit/delete, and Export/Import `annotations.json`. Offline fallback: Export `questions.json` → `node tools/answer.js` → Import `answers.json`.

Design rules: notes never live in `app.js` - the engine re-decorates `#app` via a `MutationObserver` (paused during its own writes to avoid loops) and captures anchors from the live DOM.
Storage ops are immutable (return fresh arrays).
`[hidden]` overrides must win over the component `display` rules.

## Companion server (`tools/server.js`)

Optional zero-dep node http, **127.0.0.1 only**. `node tools/server.js` → `http://127.0.0.1:4173` (serves the site same-origin).
Endpoints: `/api/ping`, `/api/llm` (claude -p proxy), `/api/answer-question` (in-site Q&A), `/api/note-gap` (comment → gap triage), `/api/vault` (write `.md` under `ATLAS_VAULT`), `/api/store?name=` (read/write `store/<name>.json`), `/api/memory?q=&k=` (read-only second-brain recall).
Path-traversal guarded. `ATLAS_FAKE_LLM=1` returns canned replies for tests (no spend).
Env: `ATLAS_PORT 4173`, `ATLAS_MODEL claude-sonnet-4-6`, `ATLAS_VAULT <repo>/../Knowledge-Atlas-Notes`, `ATLAS_MEMORY_DB ~/.claude/memory/memory.db`, `ATLAS_MEMORY_VAULT ~/Desktop/SecondBrain/08_ClaudeMemory`.

**`/api/memory`** (`tools/memory.js`, zero-dep) - lexical recall over the user's personal "second brain".
Source resolution: `node:sqlite` over FTS5 index → `sqlite3` CLI → grep the distilled-markdown vault.
Builds an FTS5 `OR`-of-tokens query from `q` (stopwords stripped), returns `{ hits: [{ title, excerpt, source }] }` ranked by FTS5 `rank`, capped at `k` (default 6, max 20).
Degrades to `{ hits: [] }` on any error - so the app never breaks.

## Intelligence layer (`intelligence.js` + `intelligence.css`)

**AI** nav button → tabbed slide-over. All call the server (`/api/llm`, Sonnet 4.6); offline → "server off".

- **#1 Discover** - Sonnet proposes non-obvious cross-domain links; accept → persists to `KA_USERCONN_V1` / `store/user_connections.json`, renders as a violet "Your links" chip (DOM-decorated, no ATLAS mutation).
- **#2 Examiner** - Socratic viva loop; running transcript re-sent each turn.
- **#3 Gap map** - frontier + note-contradiction analysis over engaged topics (`KA_PROGRESS_V1` status pills).
- **#4 Synthesis** - cross-domain essay over 2-4 picked topics.
- **#5 Teach-back** - grade an explanation vs the reference.
- **#6 Gaps inbox** - reads `store/gaps.json` (from SessionEnd hook + `/api/note-gap`); resolve → `state:"closed"`. Badge: `AI (n)`.

**Memory grounding**: features #1-#5 prepend relevant second-brain snippets (via `/api/memory`) to each LLM prompt.
When `/api/memory` returns nothing, each feature behaves exactly as before.
`recallMemory()`/`memoryBlock()` in `intelligence.js` are best-effort and never throw; `window.ATLAS` is never mutated.

**Live Obsidian sync**: on every `ka:changed` event (debounced), mirrors notes+answers+status per topic to `ATLAS_VAULT/topics/<topicId>.md` with frontmatter and `[[wikilinks]]`. Needs the server.

## Conventions (match existing content)

- **Exact links only** - deep-link the specific page (e.g. `eips.ethereum.org/EIPS/eip-1559`), never a homepage. Core requirement.
- **No em dashes** anywhere - plain `-`.
- **Math and notation** - use LaTeX/MathJax syntax for all mathematical expressions (inline `$...$`, display `$$...$$`). Use Markdown formatting (bold, code, lists) wherever it adds clarity. Never write raw Greek letters or formulas as plain prose.
- **Textbook depth** for subtopics: 5-9 substantial paragraphs each, with derivations, worked examples, real incidents, edge cases. Bar: "this page alone could make me master it."
- **Cross-connections** link the _same idea_ reappearing elsewhere (EVM → ECDSA, → bytecode VMs). Dangling `to` ids are skipped silently - keep them valid.
- Many small files: split large domains via the merge-by-id pattern.

## Validate after edits

From project root (nix-only - use `nix-shell`):

- **Structural**: load `_init.js` + every `data/*.js` in node; assert no dangling `c.to`, no dup topic ids, every `r.url` parses via `new URL`.
- **Render**: headless Playwright (project-local, in session scratchpad) - assert 0 JS errors and that subtopics/level groups render. Re-run both after content edits.

## STATUS - textbook subtopics (the high-value work)

✅ **#12 Web3** - all 9 topics, 56 subtopics, 83 links. Reference impl; match its depth/format.

⬜ **Remaining** - every topic below still has only short `body` blurbs; author a `subtopics` array to the web3 bar for each.
Files: #1 `01_dsa.js`, #2 `02_os.js`, #3 `03_compilers.js`, #4 `04_lowlevel.js`, #5 `05_cybersecurity.js`, #6 `06_webdev.js`, #7 `07_gamedev.js`, #8 `08_aiml.js`, #9 `09_embedded.js`, #10 `10_cryptography.js`, #11 `11_quant.js`, #13 `13_gpu.js` (8-11 topics each; see each file for topic ids).

**Suggested order** (high cross-link value with web3): #10 → #4 → #3 → #8 → #13 → #1 → #5 → #11 → #2 → #6 → #7 → #9

When expanding a domain: split into per-topic files (`NN_name_K_topic.js`) via merge-by-id, add `<script>` tags to `index.html`, author `subtopics` to the web3 bar, run both validators.
