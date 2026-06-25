/* ============================================================
   Knowledge Atlas — intelligence layer
   Pure vanilla JS, loads AFTER annotations.js. Adds the five
   LLM-powered study features + live Obsidian sync. All of it
   talks to the local companion server (tools/server.js); when
   that server is not running the panel says so and the rest of
   the atlas keeps working untouched.

     #1 Discover links   self-extending cross-domain graph
     #2 Examiner         Socratic viva loop, gap-seeking
     #3 Gap map          knowledge-frontier + note contradictions
     #4 Synthesis        cross-domain synthesis essay
     #5 Teach-back       explain it, get a mental-model diff
   ============================================================ */

(() => {
  "use strict";

  const MODEL = "claude-sonnet-4-6";
  const ANNOT_KEY = "KA_ANNOTATIONS_V1";
  const PROG_KEY = "KA_PROGRESS_V1"; // topicId -> "learning" | "mastered"
  const CONN_KEY = "KA_USERCONN_V1"; // accepted user connections
  const SUG_KEY = "KA_SUGGEST_V1"; // pending/dismissed link suggestions

  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const para = (s) =>
    esc(s).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");

  const jget = (k, d) => {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      return v == null ? d : v;
    } catch {
      return d;
    }
  };
  const jset = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      console.error("Atlas: save failed", e);
    }
  };

  // ---- topic graph from window.ATLAS ---------------------------
  const ATLAS = window.ATLAS || [];
  const topics = []; // { id, title, domainId, domainTitle, blurb }
  const titleById = new Map();
  const domainOfTopic = new Map();
  const existingPairs = new Set();
  for (const d of ATLAS) {
    titleById.set(d.id, d.title);
    for (const t of d.topics || []) {
      titleById.set(t.id, t.title);
      domainOfTopic.set(t.id, d.id);
      const blurb = (Array.isArray(t.body) ? t.body[0] : t.body) || "";
      topics.push({ id: t.id, title: t.title, domainId: d.id, domainTitle: d.title, blurb });
      for (const c of t.connections || []) existingPairs.add(t.id + "→" + c.to);
    }
  }
  const newId = () => "x_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ============================================================
  //  Server bridge (with graceful "offline" state)
  // ============================================================
  let SERVER = false;
  async function ping() {
    if (location.protocol === "file:") return; // no server possible; avoid a console error
    try {
      const r = await fetch("/api/ping");
      SERVER = r.ok;
    } catch {
      SERVER = false;
    }
  }
  async function llm(prompt, system, model) {
    if (!SERVER) throw new Error("offline");
    const r = await fetch("/api/llm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: model || MODEL, system, prompt }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "llm error");
    return j.text;
  }
  // Personal "second brain" recall: pull memory snippets relevant to the
  // current study context so the LLM answers are grounded in what the user
  // has already learned/noted. Best-effort: returns [] when the server is
  // off or the store has no matching memory, so features behave as before.
  async function recallMemory(query) {
    if (!SERVER || !query || !query.trim()) return [];
    try {
      const r = await fetch("/api/memory?q=" + encodeURIComponent(query) + "&k=6");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j.hits) ? j.hits : [];
    } catch {
      return [];
    }
  }
  // Format recalled snippets as a clearly-delimited prompt context block.
  // Returns "" when there is nothing relevant, leaving prompts untouched.
  function memoryBlock(hits) {
    if (!hits || !hits.length) return "";
    const items = hits
      .map((h) => `- ${h.title ? h.title + ": " : ""}${h.excerpt || ""}`)
      .join("\n");
    return (
      "RELEVANT MEMORY FROM YOUR SECOND BRAIN (things you have previously " +
      "learned or noted; use only what is pertinent, ignore the rest):\n" +
      items +
      "\n---\n"
    );
  }

  async function storeGet(name) {
    if (!SERVER) return null;
    try {
      const r = await fetch("/api/store?name=" + name);
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }
  async function storePut(name, data) {
    if (!SERVER) return;
    try {
      await fetch("/api/store?name=" + name, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      /* mirror is best-effort */
    }
  }
  async function vaultWrite(relPath, content) {
    if (!SERVER) return;
    try {
      await fetch("/api/vault", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ relPath, content }),
      });
    } catch {
      /* best-effort */
    }
  }

  // tolerant JSON extraction from an LLM reply
  function extractJSON(text) {
    if (!text) return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1] : text;
    const s = raw.indexOf("[") >= 0 ? raw.indexOf("[") : raw.indexOf("{");
    const e = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));
    if (s < 0 || e < s) return null;
    try {
      return JSON.parse(raw.slice(s, e + 1));
    } catch {
      return null;
    }
  }

  // ============================================================
  //  Accepted user connections → render as chips (no ATLAS mutation)
  // ============================================================
  function decorateUserConns() {
    const root = document.getElementById("app");
    if (!root) return;
    root.querySelectorAll(".ix-userconn-block").forEach((b) => b.remove());
    const conns = jget(CONN_KEY, []);
    const byTopic = new Map();
    for (const c of conns) {
      if (!byTopic.has(c.from)) byTopic.set(c.from, []);
      byTopic.get(c.from).push(c);
    }
    for (const [tid, list] of byTopic) {
      const sec = document.getElementById(tid);
      if (!sec) continue;
      const chips = list
        .map((c) => {
          const tgtTitle = titleById.get(c.to);
          const href = hrefFor(c.to);
          return `<a class="conn ix-userconn" ${href ? `href="${href}"` : ""}>
            <span class="conn-to"><span class="dot" style="background:#a06bff"></span>
              ${esc(tgtTitle || c.to)} <span class="arrow">→</span> <em>yours</em></span>
            <span class="conn-note">${esc(c.note || "")}</span></a>`;
        })
        .join("");
      const block = document.createElement("div");
      block.className = "ix-userconn-block";
      block.innerHTML = `<div class="block-label">Your links</div><div class="connections">${chips}</div>`;
      sec.appendChild(block);
    }
  }
  function hrefFor(id) {
    for (const d of ATLAS) {
      if (d.id === id) return `#/d/${d.id}`;
      for (const t of d.topics || []) if (t.id === id) return `#/d/${d.id}/${t.id}`;
    }
    return "";
  }

  // ============================================================
  //  Progress store: per-topic status control on each topic head
  // ============================================================
  const STATUSES = ["new", "learning", "mastered"];
  const STATUS_LABEL = { new: "○ To learn", learning: "◐ Learning", mastered: "● Mastered" };
  function decorateProgress() {
    const root = document.getElementById("app");
    if (!root) return;
    const prog = jget(PROG_KEY, {});
    root.querySelectorAll(".topic > h2").forEach((h) => {
      if (h.querySelector(".ix-status")) return;
      const tid = h.parentElement.id;
      const cur = prog[tid] || "new";
      const btn = document.createElement("button");
      btn.className = "ix-status ix-st-" + cur;
      btn.textContent = STATUS_LABEL[cur];
      btn.title = "Cycle learning status";
      btn.onclick = (e) => {
        e.preventDefault();
        const p = jget(PROG_KEY, {});
        const next = STATUSES[(STATUSES.indexOf(p[tid] || "new") + 1) % STATUSES.length];
        p[tid] = next;
        jset(PROG_KEY, p);
        btn.className = "ix-status ix-st-" + next;
        btn.textContent = STATUS_LABEL[next];
        document.dispatchEvent(new CustomEvent("ka:changed"));
      };
      h.appendChild(btn);
    });
  }

  // re-decorate after every render (app.js owns #app)
  let decorating = false;
  const decoMO = new MutationObserver(() => {
    if (decorating) return;
    decorating = true;
    decoMO.disconnect();
    decorateUserConns();
    decorateProgress();
    decorating = false;
    const root = document.getElementById("app");
    if (root) decoMO.observe(root, { childList: true, subtree: true });
  });

  // ============================================================
  //  AI panel (slide-over, tabbed)
  // ============================================================
  const panel = document.createElement("aside");
  panel.className = "ix-panel";
  panel.hidden = true;
  document.body.appendChild(panel);
  let open = false;
  let tab = "examiner";

  const TABS = {
    examiner: "🎓 Examiner",
    teach: "🪞 Teach-back",
    synth: "🔗 Synthesis",
    gap: "🧭 Gap map",
    discover: "✨ Discover",
    inbox: "🧩 Gaps",
  };
  let gapsCache = [];

  function topicPicker(cls, multiple) {
    const opts = topics
      .map((t) => `<option value="${esc(t.id)}">${esc(t.domainTitle)} · ${esc(t.title)}</option>`)
      .join("");
    return `<select class="${cls}" ${multiple ? "multiple size=6" : ""}>
      ${multiple ? "" : `<option value="">Pick a topic…</option>`}${opts}</select>`;
  }

  function shell(bodyHTML) {
    panel.innerHTML = `
      <header class="ix-head">
        <strong>Study intelligence</strong>
        <span class="ix-server ${SERVER ? "on" : "off"}">${SERVER ? "● live" : "○ server off"}</span>
        <button class="ix-close" title="Close">✕</button>
      </header>
      <nav class="ix-tabs">
        ${Object.entries(TABS)
          .map(([k, v]) => `<button data-tab="${k}" class="${tab === k ? "on" : ""}">${v}</button>`)
          .join("")}
      </nav>
      ${
        SERVER
          ? ""
          : `<div class="ix-offline">Live AI needs the companion server:
             <code>node tools/server.js</code>, then open
             <code>http://127.0.0.1:4173</code>.</div>`
      }
      <div class="ix-body">${bodyHTML}</div>`;
    panel.querySelector(".ix-close").onclick = closePanel;
    panel.querySelectorAll(".ix-tabs button").forEach((b) =>
      b.addEventListener("click", () => {
        tab = b.dataset.tab;
        renderTab();
      })
    );
  }

  const busy = (el, msg) =>
    (el.innerHTML = `<div class="ix-busy"><span class="ix-spin"></span>${esc(msg)}</div>`);

  // ---- #2 Examiner ---------------------------------------------
  let exam = { topicId: "", log: [] };
  function renderExaminer() {
    shell(`
      <label class="ix-field">Topic to be examined on
        ${topicPicker("ix-exam-topic")}</label>
      <button class="ix-go ix-exam-start">Start viva</button>
      <div class="ix-exam-thread"></div>`);
    const sel = panel.querySelector(".ix-exam-topic");
    sel.value = exam.topicId;
    panel.querySelector(".ix-exam-start").onclick = () => {
      exam = { topicId: sel.value, log: [] };
      if (!exam.topicId) return;
      examTurn(null);
    };
    paintExamThread();
  }
  function paintExamThread() {
    const wrap = panel.querySelector(".ix-exam-thread");
    if (!wrap) return;
    wrap.innerHTML = exam.log
      .map(
        (m) =>
          `<div class="ix-msg ix-${m.role}"><span>${m.role === "q" ? "Examiner" : "You"}</span>${para(
            m.text
          )}</div>`
      )
      .join("");
    if (exam.topicId && exam.log.length && exam.log[exam.log.length - 1].role === "q") {
      const a = document.createElement("div");
      a.className = "ix-answerbox";
      a.innerHTML = `<textarea class="ix-exam-ans" rows="3" placeholder="Your answer…"></textarea>
        <button class="ix-go ix-exam-send">Answer</button>`;
      wrap.appendChild(a);
      a.querySelector(".ix-exam-send").onclick = () => {
        const v = a.querySelector(".ix-exam-ans").value.trim();
        if (v) examTurn(v);
      };
    }
  }
  async function examTurn(answer) {
    const t = topics.find((x) => x.id === exam.topicId);
    if (answer != null) exam.log.push({ role: "a", text: answer });
    const wrap = panel.querySelector(".ix-exam-thread");
    paintExamThread();
    const live = document.createElement("div");
    live.className = "ix-msg ix-q";
    busy(live, "thinking…");
    wrap.appendChild(live);
    const sys =
      "You are a rigorous but encouraging Socratic examiner. Ask exactly ONE probing question at a time about the topic. " +
      "When the student answers, in <=1 line note what was right or missing, then ask a sharper follow-up that targets their weakest point. " +
      "If they have clearly mastered it, say so and stop. Output plain prose, no markdown headers.";
    const history = exam.log.map((m) => `${m.role === "q" ? "EXAMINER" : "STUDENT"}: ${m.text}`).join("\n");
    const mem = memoryBlock(await recallMemory(`${t.title} ${t.domainTitle} ${t.blurb}`));
    const prompt =
      mem +
      `Topic: ${t.title} (${t.domainTitle})\nReference summary: ${t.blurb}\n\n` +
      (history ? `Conversation so far:\n${history}\n\nContinue.` : "Ask your first question.");
    try {
      const text = await llm(prompt, sys);
      exam.log.push({ role: "q", text });
    } catch (e) {
      exam.log.push({ role: "q", text: "(" + e.message + ")" });
    }
    paintExamThread();
  }

  // ---- #5 Teach-back -------------------------------------------
  function renderTeach() {
    shell(`
      <label class="ix-field">Topic ${topicPicker("ix-teach-topic")}</label>
      <label class="ix-field">Explain it in your own words
        <textarea class="ix-teach-text" rows="6" placeholder="Teach it back…"></textarea></label>
      <button class="ix-go ix-teach-go">Grade my understanding</button>
      <div class="ix-result"></div>`);
    panel.querySelector(".ix-teach-go").onclick = async () => {
      const tid = panel.querySelector(".ix-teach-topic").value;
      const text = panel.querySelector(".ix-teach-text").value.trim();
      const out = panel.querySelector(".ix-result");
      if (!tid || !text) return;
      const t = topics.find((x) => x.id === tid);
      busy(out, "grading…");
      const sys =
        "Compare the student's explanation against the reference. Reply in plain prose with: a model score out of 100 on the first line; " +
        "then the specific misconceptions and missing pieces as short bullets; then a 2-line corrected summary. Be precise and terse.";
      try {
        const mem = memoryBlock(await recallMemory(`${t.title} ${t.blurb} ${text}`));
        out.innerHTML = para(
          await llm(mem + `Reference (${t.title}): ${t.blurb}\n\nStudent explanation:\n${text}`, sys)
        );
      } catch (e) {
        out.innerHTML = `<div class="ix-err">${esc(e.message)}</div>`;
      }
    };
  }

  // ---- #4 Synthesis --------------------------------------------
  function renderSynth() {
    shell(`
      <label class="ix-field">Pick 2-4 topics (⌘/Ctrl-click) ${topicPicker("ix-synth-topics", true)}</label>
      <button class="ix-go ix-synth-go">Write synthesis</button>
      <div class="ix-result"></div>`);
    panel.querySelector(".ix-synth-go").onclick = async () => {
      const sel = [...panel.querySelector(".ix-synth-topics").selectedOptions].map((o) => o.value);
      const out = panel.querySelector(".ix-result");
      if (sel.length < 2) return (out.innerHTML = `<div class="ix-err">Pick at least two.</div>`);
      const chosen = sel.map((id) => topics.find((x) => x.id === id)).filter(Boolean);
      busy(out, "synthesising…");
      const sys =
        "Write a tight, concrete cross-domain synthesis essay (4-6 paragraphs) connecting the given topics. " +
        "Name each topic explicitly, draw the shared deep structure, and avoid filler. Plain prose.";
      const body = chosen.map((t) => `- ${t.title} (${t.domainTitle}): ${t.blurb}`).join("\n");
      try {
        const mem = memoryBlock(await recallMemory(chosen.map((t) => t.title).join(" ")));
        out.innerHTML = para(await llm(mem + "Topics:\n" + body, sys));
      } catch (e) {
        out.innerHTML = `<div class="ix-err">${esc(e.message)}</div>`;
      }
    };
  }

  // ---- #3 Gap map ----------------------------------------------
  function engagedTopics() {
    const prog = jget(PROG_KEY, {});
    const annots = jget(ANNOT_KEY, []);
    const ids = new Set(Object.keys(prog));
    for (const a of annots) if (a.topicId) ids.add(a.topicId);
    return [...ids];
  }
  function renderGap() {
    shell(`<button class="ix-go ix-gap-go">Compute my knowledge frontier</button>
      <div class="ix-result"></div>`);
    panel.querySelector(".ix-gap-go").onclick = async () => {
      const out = panel.querySelector(".ix-result");
      const prog = jget(PROG_KEY, {});
      const annots = jget(ANNOT_KEY, []);
      const engaged = engagedTopics();
      if (!engaged.length)
        return (out.innerHTML = `<div class="ix-err">Mark some topics' status or add notes first.</div>`);
      busy(out, "mapping gaps…");
      const adj = topics
        .map((t) => {
          const outs = (ATLAS.find((d) => d.id === t.domainId)?.topics || [])
            .find((x) => x.id === t.id)
            ?.connections?.map((c) => c.to) || [];
          return `${t.id}[${prog[t.id] || "new"}] -> ${outs.join(",")}`;
        })
        .join("\n");
      const notes = annots
        .filter((a) => a.text)
        .map((a) => `(${a.topicId || "?"}) ${a.text}`)
        .join("\n");
      const sys =
        "You analyse a learner's knowledge graph. Output ONLY JSON: " +
        '{"frontier":[{"id":"topicId","why":"<=100 chars"}],"contradictions":[{"where":"topicId","issue":"<=120 chars"}]}. ' +
        "frontier = up to 8 highest-ROI topics to learn next (unmastered, adjacent to mastered/engaged ones). " +
        "contradictions = real conflicts inside the learner's own notes, else empty.";
      try {
        const engagedTitles = engaged.map((id) => titleById.get(id) || id).join(" ");
        const mem = memoryBlock(await recallMemory(`${engagedTitles} ${notes}`));
        const j = extractJSON(await llm(
          mem +
            `Engaged/mastered: ${engaged.join(", ")}\n\nGraph (id[status] -> links):\n${adj}\n\nLearner notes:\n${notes || "(none)"}`,
          sys
        ));
        out.innerHTML = renderGapResult(j);
      } catch (e) {
        out.innerHTML = `<div class="ix-err">${esc(e.message)}</div>`;
      }
    };
  }
  function renderGapResult(j) {
    if (!j) return `<div class="ix-err">Could not parse the model output.</div>`;
    const fr = (j.frontier || [])
      .map(
        (f) =>
          `<a class="ix-frontier" href="${hrefFor(f.id)}"><b>${esc(
            titleById.get(f.id) || f.id
          )}</b><span>${esc(f.why || "")}</span></a>`
      )
      .join("");
    const cn = (j.contradictions || [])
      .map((c) => `<li><b>${esc(titleById.get(c.where) || c.where)}:</b> ${esc(c.issue)}</li>`)
      .join("");
    return `<div class="ix-sub">Learn next</div><div class="ix-frontiers">${fr || "<i>nothing found</i>"}</div>
      ${cn ? `<div class="ix-sub">Contradictions in your notes</div><ul class="ix-contras">${cn}</ul>` : ""}`;
  }

  // ---- #1 Discover (self-extending graph) ----------------------
  function renderDiscover() {
    const sug = jget(SUG_KEY, []).filter((s) => s.state === "pending");
    shell(`
      <p class="ix-note">Sonnet scans the atlas for non-obvious cross-domain links you haven't drawn yet.
        Accept one and it renders as a <em>“Your links”</em> chip on the topic.</p>
      <button class="ix-go ix-disc-go">Discover new connections</button>
      <div class="ix-sug">${discoverListHTML(sug)}</div>`);
    panel.querySelector(".ix-disc-go").onclick = runDiscover;
    wireSuggestions();
  }
  function discoverListHTML(sug) {
    if (!sug.length) return `<div class="ix-empty-sm">No pending suggestions.</div>`;
    return sug
      .map(
        (s) => `<div class="ix-sugcard" data-id="${s.id}">
        <div class="ix-sug-link"><b>${esc(titleById.get(s.from) || s.from)}</b>
          <span class="arrow">→</span> <b>${esc(titleById.get(s.to) || s.to)}</b></div>
        <p>${esc(s.note)}</p>
        <div class="ix-sug-actions"><button class="ix-accept">Accept</button>
          <button class="ix-reject">Dismiss</button></div></div>`
      )
      .join("");
  }
  function wireSuggestions() {
    panel.querySelectorAll(".ix-sugcard").forEach((card) => {
      const id = card.dataset.id;
      card.querySelector(".ix-accept").onclick = () => decideSuggestion(id, true);
      card.querySelector(".ix-reject").onclick = () => decideSuggestion(id, false);
    });
  }
  function decideSuggestion(id, accept) {
    const sug = jget(SUG_KEY, []);
    const s = sug.find((x) => x.id === id);
    if (!s) return;
    s.state = accept ? "accepted" : "dismissed";
    jset(SUG_KEY, sug);
    if (accept) {
      const conns = jget(CONN_KEY, []);
      conns.push({ id, from: s.from, to: s.to, note: s.note });
      jset(CONN_KEY, conns);
      storePut("user_connections", conns);
      decorateUserConns();
      document.dispatchEvent(new CustomEvent("ka:changed"));
    }
    renderDiscover();
  }
  async function runDiscover() {
    const box = panel.querySelector(".ix-sug");
    busy(box, "scanning the atlas…");
    // sample a spread of topics across domains to keep the prompt tight
    const sample = topics.filter((_, i) => i % Math.max(1, Math.floor(topics.length / 40)) === 0);
    const list = sample.map((t) => `${t.id} | ${t.domainTitle} > ${t.title}: ${t.blurb.slice(0, 90)}`).join("\n");
    const sys =
      "You find NON-OBVIOUS, specific conceptual links between technical topics from DIFFERENT domains. " +
      'Output ONLY a JSON array: [{"from":"topicId","to":"topicId","note":"<=110 chars, the shared idea"}]. ' +
      "Use only the given topic ids. from and to must be in different domains. Max 8. No generic links.";
    try {
      const mem = memoryBlock(await recallMemory(sample.map((t) => t.title).join(" ")));
      const arr = extractJSON(await llm(mem + "Topics (id | domain > title: blurb):\n" + list, sys)) || [];
      const ids = new Set(topics.map((t) => t.id));
      const sug = jget(SUG_KEY, []);
      const known = new Set(
        sug.map((s) => s.from + "→" + s.to).concat([...existingPairs])
      );
      let added = 0;
      for (const c of arr) {
        if (!c || !ids.has(c.from) || !ids.has(c.to) || c.from === c.to) continue;
        if (domainOfTopic.get(c.from) === domainOfTopic.get(c.to)) continue;
        const key = c.from + "→" + c.to;
        if (known.has(key)) continue;
        known.add(key);
        sug.push({ id: newId(), from: c.from, to: c.to, note: String(c.note || "").slice(0, 140), state: "pending" });
        added++;
      }
      jset(SUG_KEY, sug);
      storePut("suggestions", sug);
      renderDiscover();
      if (!added)
        panel.querySelector(".ix-sug").insertAdjacentHTML(
          "afterbegin",
          `<div class="ix-empty-sm">No new links this pass - try again.</div>`
        );
    } catch (e) {
      box.innerHTML = `<div class="ix-err">${esc(e.message)}</div>`;
    }
  }

  // ---- Gaps inbox (fed by the SessionEnd hook → store/gaps.json) ----
  async function renderInbox() {
    shell(
      SERVER
        ? `<p class="ix-note">Knowledge gaps auto-captured at the end of your build sessions,
            tagged to the closest atlas topic.</p><div class="ix-result ix-gaps">Loading…</div>`
        : `<p class="ix-note">The gaps inbox is filled by the SessionEnd hook and read from the
            companion server. Start <code>node tools/server.js</code> to view it.</p>`
    );
    if (!SERVER) return;
    const box = panel.querySelector(".ix-gaps");
    const gaps = (await storeGet("gaps")) || [];
    gapsCache = gaps;
    const open = gaps.filter((g) => g.state !== "closed");
    if (!open.length) return (box.innerHTML = `<div class="ix-empty-sm">No open gaps. 🎉</div>`);
    const byProj = new Map();
    for (const g of open) {
      const k = g.project || "session";
      if (!byProj.has(k)) byProj.set(k, []);
      byProj.get(k).push(g);
    }
    box.innerHTML = [...byProj.entries()]
      .map(
        ([proj, list]) =>
          `<div class="ix-sub">${esc(proj)}</div>` +
          list
            .map(
              (g) => `<div class="ix-gapcard" data-id="${g.id}">
            <div class="ix-gap-top"><b>${esc(g.title)}</b>
              ${g.topicId ? `<a class="ix-gap-tag" href="${hrefFor(g.topicId)}">${esc(titleById.get(g.topicId) || g.topicId)}</a>` : g.domain ? `<span class="ix-gap-tag">${esc(g.domain)}</span>` : ""}</div>
            <p>${esc(g.gap)}</p>${g.note ? `<p class="ix-gap-note">→ ${esc(g.note)}</p>` : ""}
            <button class="ix-gap-done">Mark resolved</button></div>`
            )
            .join("")
      )
      .join("");
    box.querySelectorAll(".ix-gapcard").forEach((card) => {
      card.querySelector(".ix-gap-done").onclick = async () => {
        const g = gapsCache.find((x) => x.id === card.dataset.id);
        if (g) g.state = "closed";
        await storePut("gaps", gapsCache);
        renderInbox();
        updateGapBadge();
      };
    });
  }

  function renderTab() {
    ({
      examiner: renderExaminer,
      teach: renderTeach,
      synth: renderSynth,
      gap: renderGap,
      discover: renderDiscover,
      inbox: renderInbox,
    }[tab] || renderExaminer)();
  }
  function openPanel() {
    open = true;
    panel.hidden = false;
    document.body.classList.add("ix-panel-on");
    renderTab();
  }
  function closePanel() {
    open = false;
    panel.hidden = true;
    document.body.classList.remove("ix-panel-on");
  }

  // ============================================================
  //  Live Obsidian vault sync
  // ============================================================
  let syncTimer = null;
  function scheduleSync() {
    if (!SERVER) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncVault, 1200);
  }
  function syncVault() {
    const annots = jget(ANNOT_KEY, []);
    const prog = jget(PROG_KEY, {});
    const byTopic = new Map();
    for (const a of annots) {
      const k = a.topicId || "_general";
      if (!byTopic.has(k)) byTopic.set(k, []);
      byTopic.get(k).push(a);
    }
    for (const [tid, list] of byTopic) {
      const title = titleById.get(tid) || "General";
      const conns = (jget(CONN_KEY, []).filter((c) => c.from === tid) || [])
        .map((c) => `- [[${titleById.get(c.to) || c.to}]] — ${c.note}`)
        .join("\n");
      const lines = [
        "---",
        `topic: ${tid}`,
        `status: ${prog[tid] || "new"}`,
        "source: Knowledge Atlas",
        "---",
        `# ${title}`,
        "",
      ];
      for (const a of list) {
        if (a.kind === "link") {
          lines.push(`### 🔗 Link → ${a.link?.to ? `[[${titleById.get(a.link.to) || a.link.to}]]` : a.link?.url}`);
          if (a.link?.note) lines.push(a.link.note);
        } else {
          lines.push(`### ${a.kind === "question" ? "❓" : "💬"} ${a.kind}`);
          if (a.quote) lines.push(`> ${a.quote}`);
          if (a.text) lines.push("", a.text);
          if (a.answer) lines.push("", `**Answer:** ${a.answer}`);
        }
        lines.push("");
      }
      if (conns) lines.push("## Your links", conns, "");
      vaultWrite(`topics/${tid}.md`, lines.join("\n"));
    }
  }

  // ============================================================
  //  Wire-up
  // ============================================================
  function attachNav() {
    const nav = document.querySelector(".topnav");
    if (!nav || nav.querySelector(".ix-nav")) return;
    const btn = document.createElement("a");
    btn.href = "#";
    btn.className = "ix-nav";
    btn.textContent = "AI";
    btn.onclick = (e) => {
      e.preventDefault();
      open ? closePanel() : openPanel();
    };
    nav.appendChild(btn);
  }
  async function updateGapBadge() {
    const btn = document.querySelector(".ix-nav");
    if (!btn || !SERVER) return;
    const gaps = (await storeGet("gaps")) || [];
    const n = gaps.filter((g) => g.state !== "closed").length;
    btn.textContent = n ? `AI (${n})` : "AI";
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) closePanel();
  });
  document.addEventListener("ka:changed", () => {
    scheduleSync();
    if (open && tab === "discover") {
      /* keep suggestion list fresh */
    }
  });

  async function init() {
    await ping();
    attachNav();
    if (SERVER) {
      const remoteConn = await storeGet("user_connections");
      if (Array.isArray(remoteConn) && remoteConn.length) jset(CONN_KEY, remoteConn);
    }
    const root = document.getElementById("app");
    if (root) decoMO.observe(root, { childList: true, subtree: true });
    decorateUserConns();
    decorateProgress();
    updateGapBadge();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
