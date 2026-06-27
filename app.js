/* ============================================================
   Knowledge Atlas — engine
   Pure vanilla JS. No build step, no network. Open index.html.
   Data lives in window.ATLAS (array of domain objects), populated
   by data/*.js. See data/_init.js for the schema contract.
   ============================================================ */

(() => {
  "use strict";

  const DOMAINS = (window.ATLAS || []).slice().sort((a, b) => a.num - b.num);
  const app = document.getElementById("app");

  // ---- Lookups -------------------------------------------------
  const domainById = new Map();
  const topicById = new Map();            // topicId -> { domain, topic }
  for (const d of DOMAINS) {
    domainById.set(d.id, d);
    for (const t of d.topics || []) topicById.set(t.id, { domain: d, topic: t });
  }

  // Resolve a connection target id (topic id OR domain id) -> info
  function resolveTarget(id) {
    if (topicById.has(id)) {
      const { domain, topic } = topicById.get(id);
      return { kind: "topic", domain, topic, href: `#/d/${domain.id}/${topic.id}`,
               label: topic.title, color: domain.color };
    }
    if (domainById.has(id)) {
      const d = domainById.get(id);
      return { kind: "domain", domain: d, href: `#/d/${d.id}`, label: d.title, color: d.color };
    }
    return null; // dangling link — skip silently
  }

  // ---- Small DOM helpers --------------------------------------
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ---- Markdown -----------------------------------------------
  // Full markdown via vendored marked.js (offline). Bodies are authored as
  // arrays of paragraphs; joined with blank lines they form one markdown doc,
  // so headings, lists, links, blockquotes, tables and code fences all render.
  // Falls back to a tiny inline parser if marked failed to load.
  const MD = typeof window.marked !== "undefined" ? window.marked : null;
  const KX = typeof window.katex !== "undefined" ? window.katex : null;

  // Render a TeX span via KaTeX; on any failure fall back to the literal source
  // so a stray "$" never blows up a page.
  function renderTeX(tex, display) {
    const lit = (display ? "$$" : "$") + tex + (display ? "$$" : "$");
    if (!KX) return esc(lit);
    try { return KX.renderToString(tex, { displayMode: display, throwOnError: true, output: "html" }); }
    catch { return esc(lit); }
  }

  if (MD) {
    MD.setOptions({ gfm: true, breaks: false });
    // Math is tokenized BEFORE markdown so the inner TeX (underscores,
    // backslashes, asterisks) is never mangled by emphasis/code parsing.
    // Inline uses single $...$ (the convention in the data); $$...$$ is display.
    if (KX) {
      MD.use({ extensions: [
        { name: "mathBlock", level: "block",
          start(s) { const i = s.indexOf("$$"); return i < 0 ? undefined : i; },
          tokenizer(src) { const m = /^\$\$([\s\S]+?)\$\$/.exec(src);
            if (m) return { type: "mathBlock", raw: m[0], text: m[1].trim() }; },
          renderer(t) { return renderTeX(t.text, true); } },
        { name: "mathInline", level: "inline",
          start(s) { const i = s.indexOf("$"); return i < 0 ? undefined : i; },
          // `\\.` consumes a TeX escape (e.g. `\$` literal dollar) as a unit so
          // an inner escaped `$` does not prematurely close the span.
          tokenizer(src) { const m = /^\$(?!\s)((?:\\.|[^\n$])+?)(?<!\s)\$/.exec(src);
            if (m) return { type: "mathInline", raw: m[0], text: m[1] }; },
          renderer(t) { return renderTeX(t.text, false); } },
      ] });
    }
  }

  // body markdown links should open in a new tab
  const newTabLinks = (html) => html.replace(/<a /g, '<a target="_blank" rel="noopener" ');

  function fallbackInline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])[*_]([^*_]+)[*_]/g, "$1<em>$2</em>");
  }

  // inline markdown (used for titles): no wrapping <p>
  function inline(s) {
    if (MD) return MD.parseInline(String(s == null ? "" : s));
    return fallbackInline(s);
  }

  // block markdown (used for bodies / overviews)
  function bodyHTML(body) {
    const src = Array.isArray(body) ? body.join("\n\n") : String(body || "");
    if (MD) return newTabLinks(MD.parse(src));
    return src.split(/\n\n+/).map((p) => `<p>${fallbackInline(p.trim())}</p>`).join("");
  }
  const hostOf = (url) => { try { return new URL(url).host.replace(/^www\./, ""); } catch { return ""; } };

  // ============================================================
  //  HOME / MAP
  // ============================================================
  function renderHome() {
    const totalTopics = DOMAINS.reduce((n, d) => n + (d.topics?.length || 0), 0);
    const totalRes = DOMAINS.reduce((n, d) =>
      n + (d.topics || []).reduce((m, t) => m + (t.resources?.length || 0), 0), 0);
    const totalConns = DOMAINS.reduce((n, d) =>
      n + (d.topics || []).reduce((m, t) => m + (t.connections?.length || 0), 0), 0);

    app.innerHTML = `
      <section class="hero">
        <h1>One connected map of deep technical mastery</h1>
        <p>Thirteen domains — from data structures to GPU systems — each broken into the
        ideas that actually matter, with exact reading links and live cross-links to the
        same idea wherever it reappears in another field.</p>
        <div class="stats">
          <div class="stat"><b>${DOMAINS.length}</b><span>Domains</span></div>
          <div class="stat"><b>${totalTopics}</b><span>Topic clusters</span></div>
          <div class="stat"><b>${totalRes}</b><span>Curated links</span></div>
          <div class="stat"><b>${totalConns}</b><span>Cross-connections</span></div>
        </div>
      </section>

      <div class="graph-card">
        <div id="graph-mount"></div>
        <div class="graph-hint">Hover a node to light up its connections · click to open a domain</div>
      </div>

      <p class="section-label">The thirteen domains</p>
      <div class="domain-grid">
        ${DOMAINS.map(domainCard).join("")}
      </div>
    `;
    drawGraph(document.getElementById("graph-mount"));
  }

  function domainCard(d) {
    const nTopics = d.topics?.length || 0;
    const nConn = (d.topics || []).reduce((m, t) => m + (t.connections?.length || 0), 0);
    return `
      <a class="domain-card" href="#/d/${d.id}" style="--d:${d.color}">
        <div class="dc-num">${String(d.num).padStart(2, "0")}</div>
        <h3><span class="ic">${d.icon || "◆"}</span>${esc(d.title)}</h3>
        <p>${esc(d.tagline)}</p>
        <div class="dc-meta"><span><b>${nTopics}</b> topics</span><span><b>${nConn}</b> links out</span></div>
      </a>`;
  }

  // ---- Interactive SVG knowledge graph (radial layout) --------
  function buildAdjacency() {
    // domain -> domain weighted edges from topic connections
    const edges = new Map(); // "a|b" -> weight
    for (const d of DOMAINS) {
      for (const t of d.topics || []) {
        for (const c of t.connections || []) {
          const tgt = resolveTarget(c.to);
          if (!tgt || tgt.domain.id === d.id) continue;
          const key = [d.id, tgt.domain.id].sort().join("|");
          edges.set(key, (edges.get(key) || 0) + 1);
        }
      }
    }
    return edges;
  }

  // light-theme palette for the SVG graph (kept in sync with styles.css vars)
  const G = { edge: "#d8d2c4", ring: "#faf8f4", label: "#6b6660",
              labelOn: "#232026", labelOff: "#c0b9ac" };

  function drawGraph(mount) {
    const W = 1100, H = 620, cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.38;
    const n = DOMAINS.length;
    const pos = new Map();
    DOMAINS.forEach((d, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      pos.set(d.id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a });
    });
    const edges = buildAdjacency();
    const maxW = Math.max(1, ...edges.values());

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("id", "graph");

    // edges
    const edgeEls = [];
    for (const [key, w] of edges) {
      const [a, b] = key.split("|");
      const p1 = pos.get(a), p2 = pos.get(b);
      if (!p1 || !p2) continue;
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", p1.x); line.setAttribute("y1", p1.y);
      line.setAttribute("x2", p2.x); line.setAttribute("y2", p2.y);
      line.setAttribute("stroke", G.edge);
      line.setAttribute("stroke-width", 0.6 + (w / maxW) * 3);
      line.setAttribute("stroke-opacity", 0.35);
      line.dataset.a = a; line.dataset.b = b;
      svg.appendChild(line);
      edgeEls.push(line);
    }

    // nodes
    const nodeEls = [];
    DOMAINS.forEach((d) => {
      const p = pos.get(d.id);
      const g = document.createElementNS(svgNS, "g");
      g.style.cursor = "pointer";
      g.dataset.id = d.id;

      const halo = document.createElementNS(svgNS, "circle");
      halo.setAttribute("cx", p.x); halo.setAttribute("cy", p.y);
      halo.setAttribute("r", 26); halo.setAttribute("fill", d.color);
      halo.setAttribute("opacity", 0.12);

      const c = document.createElementNS(svgNS, "circle");
      c.setAttribute("cx", p.x); c.setAttribute("cy", p.y);
      c.setAttribute("r", 15); c.setAttribute("fill", d.color);
      c.setAttribute("stroke", G.ring); c.setAttribute("stroke-width", 3);

      const ic = document.createElementNS(svgNS, "text");
      ic.setAttribute("x", p.x); ic.setAttribute("y", p.y + 5);
      ic.setAttribute("text-anchor", "middle"); ic.setAttribute("font-size", "15");
      ic.textContent = d.icon || "◆";

      // label outside the ring
      const onRight = Math.cos(p.a) >= -0.01;
      const lx = p.x + Math.cos(p.a) * 30, ly = p.y + Math.sin(p.a) * 30;
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", lx); label.setAttribute("y", ly + 4);
      label.setAttribute("text-anchor", onRight ? "start" : "end");
      label.setAttribute("font-size", "13"); label.setAttribute("font-weight", "600");
      label.setAttribute("fill", G.label);
      label.textContent = d.title;

      g.append(halo, c, ic, label);
      g.addEventListener("mouseenter", () => highlight(d.id));
      g.addEventListener("mouseleave", clearHighlight);
      g.addEventListener("click", () => { location.hash = `#/d/${d.id}`; });
      svg.appendChild(g);
      nodeEls.push({ id: d.id, g, halo, c, label });
    });

    function highlight(id) {
      const near = new Set([id]);
      edgeEls.forEach((e) => {
        const on = e.dataset.a === id || e.dataset.b === id;
        e.setAttribute("stroke-opacity", on ? 0.9 : 0.08);
        e.setAttribute("stroke", on ? domainById.get(id).color : G.edge);
        if (on) { near.add(e.dataset.a); near.add(e.dataset.b); }
      });
      nodeEls.forEach((nn) => {
        const on = near.has(nn.id);
        nn.g.setAttribute("opacity", on ? 1 : 0.3);
        nn.halo.setAttribute("opacity", nn.id === id ? 0.3 : on ? 0.16 : 0.05);
        nn.label.setAttribute("fill", on ? G.labelOn : G.labelOff);
      });
    }
    function clearHighlight() {
      edgeEls.forEach((e) => {
        e.setAttribute("stroke-opacity", 0.45); e.setAttribute("stroke", G.edge);
      });
      nodeEls.forEach((nn) => {
        nn.g.setAttribute("opacity", 1);
        nn.halo.setAttribute("opacity", 0.14);
        nn.label.setAttribute("fill", G.label);
      });
    }
    mount.appendChild(svg);
  }

  // ---- Content helpers ----------------------------------------
  function resourceList(list, extraClass) {
    const items = (list || []).map((r) => `
      <li><a href="${esc(r.url)}" target="_blank" rel="noopener">
        <span class="res-type ${r.type || "docs"}">${esc(r.type || "docs")}</span>
        <span class="res-label">${esc(r.label)}${r.note ? ` <span class="res-note">- ${esc(r.note)}</span>` : ""}</span>
        <span class="res-host">${esc(hostOf(r.url))}</span>
      </a></li>`).join("");
    return items ? `<ul class="resources${extraClass ? " " + extraClass : ""}">${items}</ul>` : "";
  }

  function connChips(t) {
    return (t.connections || []).map((c) => {
      const tgt = resolveTarget(c.to);
      if (!tgt) return "";
      return `<a class="conn" href="${tgt.href}">
        <span class="conn-to"><span class="dot" style="background:${tgt.color}"></span>
          ${esc(tgt.domain.title)} <span class="arrow">→</span> ${esc(tgt.label)}</span>
        <span class="conn-note">${esc(c.note)}</span>
      </a>`;
    }).join("");
  }

  // strip markdown / TeX to plain text for excerpts
  function plainText(body) {
    let s = Array.isArray(body) ? (body[0] || "") : String(body || "");
    return s
      .replace(/\$[^$]*\$/g, " ")          // math
      .replace(/`([^`]+)`/g, "$1")          // code
      .replace(/\*\*([^*]+)\*\*/g, "$1")    // bold
      .replace(/[*_]/g, "")                  // stray emphasis
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
      .replace(/\s+/g, " ")
      .trim();
  }
  function excerpt(body, n = 165) {
    const s = plainText(body);
    return s.length > n ? esc(s.slice(0, n).replace(/\s+\S*$/, "")) + "…" : esc(s);
  }

  // prev / next pager. each side is {href,label,dir} or null
  function pager(prev, next) {
    const side = (o, dir, word) => o
      ? `<a class="pg pg-${dir}" href="${o.href}"><span class="pg-dir">${word}</span><span class="pg-label">${esc(o.label)}</span></a>`
      : `<span class="pg pg-empty"></span>`;
    return `<nav class="pager">${side(prev, "prev", "← Previous")}${side(next, "next", "Next →")}</nav>`;
  }

  const crumb = (parts) => `<div class="crumbs">${parts.map((p, i) =>
    (i ? ' <span class="sep">›</span> ' : "") + (p.href ? `<a href="${p.href}">${esc(p.label)}</a>` : `<span>${esc(p.label)}</span>`)
  ).join("")}</div>`;

  // ============================================================
  //  DOMAIN PAGE  (clickable index of topics)
  // ============================================================
  function renderDomain(domainId) {
    const d = domainById.get(domainId);
    if (!d) return renderNotFound();

    // Group topics into ordered level-runs (consecutive topics sharing a level).
    const groups = [];
    for (const t of d.topics || []) {
      const lvl = t.level || "";
      const last = groups[groups.length - 1];
      if (last && last.level === lvl) last.topics.push(t);
      else groups.push({ level: lvl, topics: [t] });
    }

    const card = (t) => {
      const nSub = (t.subtopics || []).length;
      const nRes = (t.resources || []).length;
      const meta = [
        nSub ? `<b>${nSub}</b> deep dives` : "",
        nRes ? `<b>${nRes}</b> links` : "",
      ].filter(Boolean).join('<span class="tc-dot">·</span>');
      return `
        <a class="topic-card" href="#/d/${d.id}/${t.id}">
          <div class="tc-main">
            <h3>${esc(t.title)}</h3>
            <p>${excerpt(t.body)}</p>
            ${meta ? `<div class="tc-meta">${meta}</div>` : ""}
          </div>
          <span class="tc-arrow">→</span>
        </a>`;
    };

    app.innerHTML = `
      <article style="--d:${d.color}">
        <header class="dpage-head">
          ${crumb([{ label: "Map", href: "#/" }, { label: "Domains", href: "#/domains" }, { label: d.title }])}
          <h1><span class="ic">${d.icon || "◆"}</span>${esc(d.title)}
            <span class="dpage-num">${String(d.num).padStart(2, "0")}</span></h1>
          <p class="tagline">${esc(d.tagline)}</p>
          <div class="overview">${bodyHTML(d.overview)}</div>
        </header>
        <div class="topic-index">
          ${groups.map((g) =>
            (g.level ? `<div class="level-head"><span class="level-rule"></span><span class="level-name">${esc(g.level)}</span><span class="level-rule"></span></div>` : "")
            + `<div class="topic-cards">${g.topics.map(card).join("")}</div>`
          ).join("")}
        </div>
      </article>`;
    window.scrollTo(0, 0);
  }

  // ============================================================
  //  TOPIC PAGE  (blog article + deep-dive index)
  // ============================================================
  function renderTopic(domainId, topicId) {
    const d = domainById.get(domainId);
    if (!d) return renderNotFound();
    const topics = d.topics || [];
    const idx = topics.findIndex((x) => x.id === topicId);
    const t = topics[idx];
    if (!t) return renderNotFound();

    const subs = (t.subtopics || []).map((s, i) => `
      <a class="sub-card" href="#/d/${d.id}/${t.id}/${i}">
        <span class="sub-card-n">${String(i + 1).padStart(2, "0")}</span>
        <span class="sub-card-main">
          <span class="sub-card-title">${inline(s.title)}</span>
          <span class="sub-card-ex">${excerpt(s.body, 130)}</span>
        </span>
        <span class="sub-card-arrow">→</span>
      </a>`).join("");

    const conns = connChips(t);
    const prev = topics[idx - 1] && { href: `#/d/${d.id}/${topics[idx - 1].id}`, label: topics[idx - 1].title };
    const next = topics[idx + 1] && { href: `#/d/${d.id}/${topics[idx + 1].id}`, label: topics[idx + 1].title };

    app.innerHTML = `
      <article style="--d:${d.color}">
        ${crumb([{ label: "Map", href: "#/" }, { label: d.title, href: `#/d/${d.id}` }, { label: t.title }])}
        <section class="topic post" id="${t.id}">
          ${t.level ? `<div class="post-lvl">${esc(t.level)}</div>` : ""}
          <h2>${esc(t.title)}</h2>
          <div class="body">${bodyHTML(t.body)}</div>
          ${subs ? `<div class="block-label">Deep dive - textbook subtopics</div><div class="sub-cards">${subs}</div>` : ""}
          ${resourceList(t.resources) ? `<div class="block-label">Read / practice</div>${resourceList(t.resources)}` : ""}
          ${conns ? `<div class="block-label">Connects to</div><div class="connections">${conns}</div>` : ""}
        </section>
        ${pager(prev, next)}
      </article>`;
    window.scrollTo(0, 0);
  }

  // ============================================================
  //  SUBTOPIC PAGE  (full blog article for one deep dive)
  // ============================================================
  function renderSubtopic(domainId, topicId, subIdx) {
    const d = domainById.get(domainId);
    if (!d) return renderNotFound();
    const t = (d.topics || []).find((x) => x.id === topicId);
    if (!t) return renderNotFound();
    const subs = t.subtopics || [];
    const i = Number.parseInt(subIdx, 10);
    const s = subs[i];
    if (!s) return renderNotFound();

    const topicHref = `#/d/${d.id}/${t.id}`;
    const prev = subs[i - 1] ? { href: `#/d/${d.id}/${t.id}/${i - 1}`, label: subs[i - 1].title } : { href: topicHref, label: t.title };
    const next = subs[i + 1] && { href: `#/d/${d.id}/${t.id}/${i + 1}`, label: subs[i + 1].title };

    // wrap as the parent topic (id = topicId) so notes anchor to the topic
    app.innerHTML = `
      <article style="--d:${d.color}">
        ${crumb([{ label: "Map", href: "#/" }, { label: d.title, href: `#/d/${d.id}` }, { label: t.title, href: topicHref }, { label: s.title }])}
        <section class="topic post" id="${t.id}">
          <div class="post-lvl">Deep dive <span class="sep">·</span> ${esc(t.title)} <span class="sep">·</span> ${i + 1} / ${subs.length}</div>
          <h2>${inline(s.title)}</h2>
          <div class="body">${bodyHTML(s.body)}</div>
          ${resourceList(s.resources) ? `<div class="block-label">Read / practice</div>${resourceList(s.resources)}` : ""}
        </section>
        ${pager(prev, next)}
      </article>`;
    window.scrollTo(0, 0);
  }

  // ============================================================
  //  DOMAINS INDEX  &  CONNECTIONS PAGE
  // ============================================================
  function renderDomainsIndex() {
    app.innerHTML = `
      <div class="dpage-head"><h1>All domains</h1>
        <p class="overview">Pick a field to dive in. Each is a self-contained path to mastery,
        but the real value is in the links between them.</p></div>
      <div class="domain-grid">${DOMAINS.map(domainCard).join("")}</div>`;
    window.scrollTo(0, 0);
  }

  function renderConnections() {
    const groups = DOMAINS.map((d) => {
      const edges = [];
      for (const t of d.topics || []) {
        for (const c of t.connections || []) {
          const tgt = resolveTarget(c.to);
          if (!tgt || tgt.domain.id === d.id) continue;
          edges.push(`<div class="edge">
            <a class="e-to" href="${tgt.href}" style="color:${tgt.color}">${esc(tgt.domain.title)} · ${esc(tgt.label)}</a>
            <span class="e-note">${esc(c.note)} <span style="color:var(--faint)">(from ${esc(t.title)})</span></span>
          </div>`);
        }
      }
      if (!edges.length) return "";
      return `<div class="conn-group" style="--d:${d.color}">
        <h3><span>${d.icon || "◆"}</span><a href="#/d/${d.id}" style="color:${d.color}">${esc(d.title)}</a>
          <span style="color:var(--faint);font-weight:400;font-size:.8rem">→ ${edges.length} links</span></h3>
        ${edges.join("")}</div>`;
    }).join("");

    app.innerHTML = `
      <div class="dpage-head"><h1>The connection web</h1>
        <p class="overview">Every cross-domain link in the atlas, grouped by source domain.
        This is the map of how one idea — a Merkle tree, an SSA form, an attention kernel —
        shows up again and again across fields.</p></div>
      <div class="conn-matrix">${groups}</div>`;
    window.scrollTo(0, 0);
  }

  function renderNotFound() {
    app.innerHTML = `<div class="dpage-head"><h1>Not found</h1>
      <p class="overview"><a href="#/">← Back to the map</a></p></div>`;
  }

  // ============================================================
  //  SEARCH
  // ============================================================
  const searchIndex = [];
  for (const d of DOMAINS) {
    for (const t of d.topics || []) {
      const resText = (t.resources || []).map((r) => r.label).join(" ");
      searchIndex.push({
        domain: d, topic: t,
        hay: (t.title + " " + (Array.isArray(t.body) ? t.body.join(" ") : t.body) + " " + resText).toLowerCase(),
        href: `#/d/${d.id}/${t.id}`,
      });
    }
  }
  const searchEl = document.getElementById("search");
  const resultsEl = document.getElementById("search-results");

  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) { resultsEl.hidden = true; return; }
    const terms = q.split(/\s+/);
    const hits = searchIndex
      .map((e) => ({ e, score: terms.reduce((s, term) => s + (e.hay.includes(term) ? 1 : 0), 0) }))
      .filter((x) => x.score === terms.length)
      .slice(0, 24);
    if (!hits.length) { resultsEl.innerHTML = `<div class="sr-empty">No matches for “${esc(q)}”</div>`; resultsEl.hidden = false; return; }
    resultsEl.innerHTML = hits.map(({ e }) => `
      <a class="sr-item" href="${e.href}">
        <span class="sr-dom" style="color:${e.domain.color}">${e.domain.icon} ${esc(e.domain.title)}</span>
        <span class="sr-title">${esc(e.topic.title)}</span>
      </a>`).join("");
    resultsEl.hidden = false;
  }
  if (searchEl) {
    searchEl.addEventListener("input", (e) => runSearch(e.target.value));
    searchEl.addEventListener("blur", () => setTimeout(() => (resultsEl.hidden = true), 180));
    searchEl.addEventListener("focus", (e) => { if (e.target.value) runSearch(e.target.value); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== searchEl) { e.preventDefault(); searchEl.focus(); }
      if (e.key === "Escape") { resultsEl.hidden = true; searchEl.blur(); }
    });
    resultsEl.addEventListener("click", () => (resultsEl.hidden = true));
  }

  // ============================================================
  //  ROUTER
  // ============================================================
  function dispatch() {
    const hash = location.hash || "#/";
    const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (resultsEl) resultsEl.hidden = true;
    if (parts.length === 0) return renderHome();
    if (parts[0] === "domains") return renderDomainsIndex();
    if (parts[0] === "connections") return renderConnections();
    if (parts[0] === "d") {
      if (parts.length >= 4) return renderSubtopic(parts[1], parts[2], parts[3]);
      if (parts.length === 3) return renderTopic(parts[1], parts[2]);
      return renderDomain(parts[1]);
    }
    renderNotFound();
  }

  // Smooth crossfade between views via the View Transitions API; the engine
  // degrades to an instant swap where it is unsupported.
  function route() {
    if (document.startViewTransition) document.startViewTransition(dispatch);
    else dispatch();
  }

  window.addEventListener("hashchange", route);
  if (!DOMAINS.length) {
    app.innerHTML = `<div class="dpage-head"><h1>No data loaded</h1>
      <p class="overview">The <code>data/*.js</code> files did not populate <code>window.ATLAS</code>.</p></div>`;
  } else {
    route();
  }
})();
