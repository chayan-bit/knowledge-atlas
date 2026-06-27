/* ============================================================
   Knowledge Atlas — annotation layer
   Pure vanilla JS, no deps. Loads AFTER app.js. Stays fully
   offline: notes live in localStorage and round-trip to JSON.

   Three things you can attach to any line/resource/connection:
     - comment   : a note on the selected text or element
     - question  : answered later, headless, by `tools/answer.js`
                   (claude -p --model sonnet, all tools stripped)
     - link      : your own cross-link to a topic/domain id or URL

   The engine never touches app.js: it re-decorates #app via a
   MutationObserver after every render, and captures anchors from
   the live DOM (text selection + hover pencil).
   ============================================================ */

(() => {
  "use strict";

  const KEY = "KA_ANNOTATIONS_V1";
  const QUOTE_MAX = 180;

  // ---- storage (immutable: every op returns a fresh array) -----
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  let state = load();
  function persist(next) {
    state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Atlas notes: could not save", e);
    }
    redecorate();
    if (panelOpen) renderPanel();
    document.dispatchEvent(new CustomEvent("ka:changed")); // intelligence.js / vault sync
  }
  const add = (a) => persist(state.concat([a]));
  const update = (id, patch) =>
    persist(state.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id) => persist(state.filter((a) => a.id !== id));

  const newId = () =>
    "a_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const nowISO = () => new Date().toISOString();

  // ---- companion server: live answering + note→gap -------------
  // The atlas stays fully offline; when tools/server.js is running, a question
  // asked here is answered in-site (no Export → answer.js → Import round-trip),
  // and a comment is triaged into the AI Gaps inbox if it hides a knowledge gap.
  let serverOn = false;
  fetch("/api/ping")
    .then((r) => (serverOn = r.ok))
    .catch(() => (serverOn = false));

  const answering = new Set(); // annotation ids whose answer is in flight

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "ka-toast";
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("on"));
    setTimeout(() => {
      el.classList.remove("on");
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  function contextOf(a) {
    return {
      topic: a.topicId ? titleById.get(a.topicId) || a.topicId : "",
      topicId: a.topicId || "",
      domain: domainOf(a.topicId),
      quote: a.quote || "",
      hash: a.hash,
    };
  }

  // Live-answer a question annotation, filling its answer in place.
  async function requestAnswer(a) {
    if (!serverOn) return;
    answering.add(a.id);
    if (panelOpen) renderPanel();
    redecorate();
    try {
      const r = await fetch("/api/answer-question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: a.id, question: a.text, context: contextOf(a) }),
      });
      const j = await r.json();
      answering.delete(a.id);
      if (r.ok && j.answer) update(a.id, { answer: j.answer, answeredAt: nowISO() });
      else if (panelOpen) renderPanel();
    } catch {
      answering.delete(a.id);
      if (panelOpen) renderPanel();
    }
  }

  // Fire-and-forget: triage a comment into a durable gap if it hides one.
  async function requestNoteGap(a) {
    if (!serverOn) return;
    try {
      const r = await fetch("/api/note-gap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ note: a.text, context: contextOf(a) }),
      });
      const j = await r.json();
      if (r.ok && j.added) toast("📥 Added to your Gaps inbox (AI)");
    } catch {
      /* best-effort */
    }
  }
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // Lookup of every annotatable target id -> human title (topics + domains)
  const titleById = new Map();
  const domainByTopic = new Map(); // topic id -> owning domain id
  for (const d of window.ATLAS || []) {
    titleById.set(d.id, d.title);
    for (const t of d.topics || []) {
      titleById.set(t.id, t.title);
      domainByTopic.set(t.id, d.id);
    }
  }
  const domainOf = (id) => (id ? domainByTopic.get(id) || "" : "");
  const topicIdOf = (el) => el?.closest?.(".topic")?.id || null;
  const clip = (s) => {
    s = String(s || "").replace(/\s+/g, " ").trim();
    return s.length > QUOTE_MAX ? s.slice(0, QUOTE_MAX - 1) + "…" : s;
  };

  // ============================================================
  //  Anchor capture: text selection + hover pencil
  // ============================================================
  const appEl = () => document.getElementById("app");

  // floating mini-toolbar shown over a text selection
  const selBar = document.createElement("div");
  selBar.className = "ka-selbar";
  selBar.hidden = true;
  selBar.innerHTML = `
    <button data-k="comment" title="Add a comment">💬 Comment</button>
    <button data-k="question" title="Ask a question (answered by Sonnet)">❓ Ask</button>
    <button data-k="link" title="Make your own link">🔗 Link</button>`;
  document.body.appendChild(selBar);

  let pendingAnchor = null; // { type, topicId, quote }

  function showSelBar() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return hideSelBar();
    const range = sel.getRangeAt(0);
    const within = appEl()?.contains(range.commonAncestorContainer);
    const quote = clip(sel.toString());
    if (!within || quote.length < 2) return hideSelBar();
    const node =
      range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    pendingAnchor = { type: "selection", topicId: topicIdOf(node), quote };
    const r = range.getBoundingClientRect();
    selBar.hidden = false;
    const bw = selBar.offsetWidth || 220;
    selBar.style.left =
      Math.max(8, Math.min(window.innerWidth - bw - 8, r.left + r.width / 2 - bw / 2)) + "px";
    selBar.style.top = window.scrollY + r.top - selBar.offsetHeight - 8 + "px";
  }
  function hideSelBar() {
    selBar.hidden = true;
    pendingAnchor = null;
  }
  document.addEventListener("mouseup", () => setTimeout(showSelBar, 0));
  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) hideSelBar();
  });
  selBar.addEventListener("mousedown", (e) => e.preventDefault()); // keep selection
  selBar.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || !pendingAnchor) return;
    openComposer(b.dataset.k, pendingAnchor);
    hideSelBar();
  });

  // hover pencil for whole resources / connection chips
  const pencil = document.createElement("button");
  pencil.className = "ka-pencil";
  pencil.hidden = true;
  pencil.textContent = "✎";
  pencil.title = "Annotate this";
  document.body.appendChild(pencil);
  let hoverTarget = null;

  function annotatableOf(el) {
    return el?.closest?.(".resources a, .conn") || null;
  }
  document.addEventListener("mouseover", (e) => {
    const t = annotatableOf(e.target);
    if (!t) return;
    hoverTarget = t;
    const r = t.getBoundingClientRect();
    pencil.hidden = false;
    pencil.style.left = window.scrollX + r.right - 26 + "px";
    pencil.style.top = window.scrollY + r.top + 4 + "px";
  });
  document.addEventListener("mouseout", (e) => {
    if (annotatableOf(e.target) && !e.relatedTarget?.closest?.(".ka-pencil"))
      pencil.hidden = true;
  });
  pencil.addEventListener("click", () => {
    if (!hoverTarget) return;
    const type = hoverTarget.classList.contains("conn") ? "connection" : "resource";
    openComposer("comment", {
      type,
      topicId: topicIdOf(hoverTarget),
      quote: clip(hoverTarget.textContent),
    });
    pencil.hidden = true;
  });

  // ============================================================
  //  Composer modal
  // ============================================================
  const modal = document.createElement("div");
  modal.className = "ka-modal";
  modal.hidden = true;
  document.body.appendChild(modal);

  function targetOptions() {
    return [...titleById.entries()]
      .map(([id, title]) => `<option value="${esc(id)}">${esc(title)} · ${esc(id)}</option>`)
      .join("");
  }

  function openComposer(kind, anchor, existing) {
    const a = existing || {
      id: newId(),
      kind,
      hash: location.hash || "#/",
      topicId: anchor.topicId,
      anchorType: anchor.type,
      quote: anchor.quote,
      text: "",
      link: { to: "", url: "", note: "" },
      answer: "",
      answeredAt: null,
      createdAt: nowISO(),
    };
    const isEdit = !!existing;
    const ctxTitle = a.topicId ? titleById.get(a.topicId) || a.topicId : "this page";
    modal.innerHTML = `
      <div class="ka-modal-card" role="dialog" aria-modal="true">
        <header>
          <strong>${isEdit ? "Edit note" : "New note"}</strong>
          <button class="ka-x" title="Close">✕</button>
        </header>
        <div class="ka-ctx"><span class="ka-ctx-on">on “${esc(ctxTitle)}”</span>
          ${a.quote ? `<blockquote>${esc(a.quote)}</blockquote>` : ""}</div>
        <div class="ka-tabs">
          ${["comment", "question", "link"]
            .map(
              (k) =>
                `<button data-tab="${k}" class="${a.kind === k ? "on" : ""}">${
                  { comment: "💬 Comment", question: "❓ Question", link: "🔗 Link" }[k]
                }</button>`
            )
            .join("")}
        </div>
        <div class="ka-body"></div>
        <footer>
          <button class="ka-cancel">Cancel</button>
          <button class="ka-save">${isEdit ? "Save" : "Add note"}</button>
        </footer>
      </div>`;
    modal.hidden = false;

    const bodyEl = modal.querySelector(".ka-body");
    function paintTab() {
      if (a.kind === "link") {
        bodyEl.innerHTML = `
          <label>Link to a topic or domain id
            <input class="ka-to" list="ka-targets" placeholder="e.g. crypto-ecc"
              value="${esc(a.link?.to || "")}" /></label>
          <datalist id="ka-targets">${targetOptions()}</datalist>
          <label>…or any URL
            <input class="ka-url" placeholder="https://…" value="${esc(a.link?.url || "")}" /></label>
          <label>Why this link?
            <textarea class="ka-note" rows="2" placeholder="The reason this connects…">${esc(
              a.link?.note || ""
            )}</textarea></label>`;
      } else {
        bodyEl.innerHTML = `
          <label>${a.kind === "question" ? "Your question (answered headlessly by Sonnet)" : "Your comment"}
            <textarea class="ka-text" rows="4" placeholder="${
              a.kind === "question" ? "What do you want explained?" : "Your note…"
            }">${esc(a.text || "")}</textarea></label>
          ${
            a.kind === "question" && a.answer
              ? `<div class="ka-ans"><span>Answer</span><p>${esc(a.answer)}</p></div>`
              : ""
          }`;
      }
    }
    paintTab();

    modal.querySelectorAll(".ka-tabs button").forEach((b) =>
      b.addEventListener("click", () => {
        a.kind = b.dataset.tab;
        modal.querySelectorAll(".ka-tabs button").forEach((x) =>
          x.classList.toggle("on", x === b)
        );
        paintTab();
      })
    );

    const close = () => (modal.hidden = true);
    modal.querySelector(".ka-x").onclick = close;
    modal.querySelector(".ka-cancel").onclick = close;
    modal.onclick = (e) => {
      if (e.target === modal) close();
    };
    modal.querySelector(".ka-save").onclick = () => {
      if (a.kind === "link") {
        a.link = {
          to: bodyEl.querySelector(".ka-to").value.trim(),
          url: bodyEl.querySelector(".ka-url").value.trim(),
          note: bodyEl.querySelector(".ka-note").value.trim(),
        };
        a.text = "";
        if (!a.link.to && !a.link.url) return bodyEl.querySelector(".ka-to").focus();
      } else {
        a.text = bodyEl.querySelector(".ka-text").value.trim();
        if (!a.text) return bodyEl.querySelector(".ka-text").focus();
      }
      if (isEdit) update(a.id, a);
      else add(a);
      close();
      // Live server actions (no-ops when the companion server is off).
      if (a.kind === "question" && !a.answer) requestAnswer(a);
      else if (a.kind === "comment" && !isEdit) requestNoteGap(a);
    };
  }

  // ============================================================
  //  Decoration: per-topic badges after each render
  // ============================================================
  let decorating = false;
  function redecorate() {
    const root = appEl();
    if (!root || decorating) return;
    decorating = true; // our own DOM writes must not retrigger the observer
    mo.disconnect();
    root.querySelectorAll(".ka-badge").forEach((b) => b.remove());
    const counts = new Map();
    for (const a of state) {
      if (!a.topicId) continue;
      counts.set(a.topicId, (counts.get(a.topicId) || 0) + 1);
    }
    for (const [tid, n] of counts) {
      const h = document.querySelector(`#${CSS.escape(tid)} > h2`);
      if (!h) continue;
      const badge = document.createElement("button");
      badge.className = "ka-badge";
      badge.textContent = `📝 ${n}`;
      badge.title = `${n} note${n > 1 ? "s" : ""} — open Notes`;
      badge.onclick = () => openPanel(tid);
      h.appendChild(badge);
    }
    decorating = false;
    if (moActive) mo.observe(root, { childList: true, subtree: true });
  }
  let moActive = false;
  const mo = new MutationObserver(() => redecorate());

  // ============================================================
  //  Notes slide-over panel
  // ============================================================
  const panel = document.createElement("aside");
  panel.className = "ka-panel";
  panel.hidden = true;
  document.body.appendChild(panel);
  let panelOpen = false;
  let panelFilter = null;

  function linkTargetHTML(a) {
    if (a.link?.to) {
      const ok = titleById.has(a.link.to);
      return ok
        ? `<a href="#/d/${routeForTarget(a.link.to)}">→ ${esc(
            titleById.get(a.link.to)
          )}</a>`
        : `<span class="ka-dangling">→ ${esc(a.link.to)} (unknown id)</span>`;
    }
    if (a.link?.url)
      return `<a href="${esc(a.link.url)}" target="_blank" rel="noopener">↗ ${esc(
        a.link.url
      )}</a>`;
    return "";
  }
  function routeForTarget(id) {
    for (const d of window.ATLAS || []) {
      if (d.id === id) return d.id;
      for (const t of d.topics || []) if (t.id === id) return `${d.id}/${t.id}`;
    }
    return "";
  }

  function annItemHTML(a) {
    const badge = { comment: "💬", question: "❓", link: "🔗" }[a.kind] || "•";
    let main = "";
    if (a.kind === "link") {
      main = `<div class="ka-link">${linkTargetHTML(a)}</div>${
        a.link?.note ? `<p>${esc(a.link.note)}</p>` : ""
      }`;
    } else {
      main = `<p>${esc(a.text)}</p>`;
      if (a.kind === "question")
        main += a.answer
          ? `<div class="ka-ans"><span>Sonnet</span><p>${esc(a.answer)}</p></div>`
          : answering.has(a.id)
          ? `<div class="ka-pending">⏳ answering…</div>`
          : `<div class="ka-pending">⏳ pending — start <code>tools/server.js</code> to auto-answer, or Export questions → <code>tools/answer.js</code> → Import answers</div>`;
    }
    const where = a.topicId ? titleById.get(a.topicId) || a.topicId : "page";
    return `
      <li class="ka-item" data-id="${a.id}">
        <div class="ka-item-head">
          <span class="ka-kind">${badge}</span>
          <a class="ka-where" href="${esc(a.hash)}">${esc(where)}</a>
          <button class="ka-edit" title="Edit">✎</button>
          <button class="ka-del" title="Delete">🗑</button>
        </div>
        ${a.quote ? `<blockquote>${esc(a.quote)}</blockquote>` : ""}
        ${main}
      </li>`;
  }

  function renderPanel() {
    const items = panelFilter ? state.filter((a) => a.topicId === panelFilter) : state;
    const pendingQ = state.filter((a) => a.kind === "question" && !a.answer).length;
    panel.innerHTML = `
      <header class="ka-panel-head">
        <strong>Notes &amp; questions</strong>
        <button class="ka-close" title="Close">✕</button>
      </header>
      <div class="ka-panel-tools">
        <button data-act="export">⬇ Export all</button>
        <button data-act="import">⬆ Import</button>
        <button data-act="exportq">❓ Export questions${pendingQ ? ` (${pendingQ})` : ""}</button>
        <button data-act="importa">✅ Import answers</button>
        <button data-act="clear" class="ka-danger">Clear all</button>
        ${panelFilter ? `<button data-act="unfilter">Show all</button>` : ""}
      </div>
      <input type="file" class="ka-file" accept="application/json" hidden />
      ${
        items.length
          ? `<ul class="ka-list">${items
              .slice()
              .reverse()
              .map(annItemHTML)
              .join("")}</ul>`
          : `<div class="ka-empty">No notes yet. Select any line, or hover a resource / connection, to begin.</div>`
      }`;

    panel.querySelector(".ka-close").onclick = closePanel;
    panel.querySelector(".ka-panel-tools").onclick = (e) => {
      const b = e.target.closest("button");
      if (b) toolAction(b.dataset.act);
    };
    panel.querySelectorAll(".ka-item").forEach((li) => {
      const id = li.dataset.id;
      const a = state.find((x) => x.id === id);
      li.querySelector(".ka-del").onclick = () => remove(id);
      li.querySelector(".ka-edit").onclick = () =>
        openComposer(a.kind, { type: a.anchorType, topicId: a.topicId, quote: a.quote }, a);
    });
  }

  function openPanel(filter) {
    panelFilter = filter || null;
    panelOpen = true;
    panel.hidden = false;
    document.body.classList.add("ka-panel-on");
    renderPanel();
  }
  function closePanel() {
    panelOpen = false;
    panel.hidden = true;
    document.body.classList.remove("ka-panel-on");
  }

  // ---- export / import helpers ---------------------------------
  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function pickFile(cb) {
    const input = panel.querySelector(".ka-file");
    input.value = "";
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          cb(JSON.parse(reader.result));
        } catch (e) {
          alert("Invalid JSON file");
        }
      };
      reader.readAsText(f);
    };
    input.click();
  }
  function mergeById(incoming) {
    if (!Array.isArray(incoming)) return;
    const byId = new Map(state.map((a) => [a.id, a]));
    for (const a of incoming) if (a && a.id) byId.set(a.id, { ...byId.get(a.id), ...a });
    persist([...byId.values()]);
  }
  function applyAnswers(answers) {
    if (!Array.isArray(answers)) return;
    const map = new Map(answers.map((x) => [x.id, x]));
    persist(
      state.map((a) =>
        map.has(a.id)
          ? { ...a, answer: map.get(a.id).answer || a.answer, answeredAt: nowISO() }
          : a
      )
    );
  }
  function toolAction(act) {
    if (act === "export") return download("annotations.json", state);
    if (act === "import") return pickFile(mergeById);
    if (act === "importa") return pickFile(applyAnswers);
    if (act === "unfilter") return openPanel(null);
    if (act === "clear") {
      if (confirm("Delete ALL notes? Export first if unsure.")) persist([]);
      return;
    }
    if (act === "exportq") {
      const qs = state
        .filter((a) => a.kind === "question" && !a.answer)
        .map((a) => ({
          id: a.id,
          question: a.text,
          context: {
            topic: a.topicId ? titleById.get(a.topicId) || a.topicId : "",
            quote: a.quote || "",
            hash: a.hash,
          },
        }));
      if (!qs.length) return alert("No pending questions to export.");
      download("questions.json", qs);
    }
  }

  // ============================================================
  //  Wire-up
  // ============================================================
  function attachNav() {
    const nav = document.querySelector(".topnav");
    if (!nav || nav.querySelector(".ka-nav")) return;
    const btn = document.createElement("a");
    btn.href = "#";
    btn.className = "ka-nav";
    btn.textContent = "Notes";
    btn.onclick = (e) => {
      e.preventDefault();
      panelOpen ? closePanel() : openPanel(null);
    };
    nav.appendChild(btn);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!modal.hidden) modal.hidden = true;
      else if (panelOpen) closePanel();
      hideSelBar();
    }
  });

  function init() {
    attachNav();
    const root = appEl();
    if (root) {
      moActive = true;
      mo.observe(root, { childList: true, subtree: true });
    }
    redecorate();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
