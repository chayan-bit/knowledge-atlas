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

  // light inline markdown: **bold**, `code`, _em_  (used in bodies)
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])_([^_]+)_/g, "$1<em>$2</em>");
  }
  function bodyHTML(body) {
    const paras = Array.isArray(body) ? body : String(body || "").split(/\n\n+/);
    return paras.map((p) => `<p>${inline(p.trim())}</p>`).join("");
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
      line.setAttribute("stroke", "#2c4055");
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
      c.setAttribute("stroke", "#080b11"); c.setAttribute("stroke-width", 3);

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
      label.setAttribute("fill", "#aab8c8");
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
        e.setAttribute("stroke-opacity", on ? 0.9 : 0.06);
        e.setAttribute("stroke", on ? domainById.get(id).color : "#2c4055");
        if (on) { near.add(e.dataset.a); near.add(e.dataset.b); }
      });
      nodeEls.forEach((nn) => {
        const on = near.has(nn.id);
        nn.g.setAttribute("opacity", on ? 1 : 0.25);
        nn.halo.setAttribute("opacity", nn.id === id ? 0.3 : on ? 0.16 : 0.05);
        nn.label.setAttribute("fill", on ? "#e6edf3" : "#5d6b7d");
      });
    }
    function clearHighlight() {
      edgeEls.forEach((e) => {
        e.setAttribute("stroke-opacity", 0.35); e.setAttribute("stroke", "#2c4055");
      });
      nodeEls.forEach((nn) => {
        nn.g.setAttribute("opacity", 1);
        nn.halo.setAttribute("opacity", 0.12);
        nn.label.setAttribute("fill", "#aab8c8");
      });
    }
    mount.appendChild(svg);
  }

  // ============================================================
  //  DOMAIN PAGE
  // ============================================================
  function renderDomain(domainId, topicId) {
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

    const toc = groups.map((g) => {
      const items = g.topics.map((t) =>
        `<li><a href="#/d/${d.id}/${t.id}" data-tid="${t.id}">${esc(t.title)}</a></li>`).join("");
      return g.level
        ? `<li class="toc-group"><span class="toc-lvl">${esc(g.level)}</span><ul>${items}</ul></li>`
        : items;
    }).join("");

    app.innerHTML = `
      <div style="--d:${d.color}">
        <div class="dpage-head">
          <div class="crumbs"><a href="#/">Map</a> &nbsp;›&nbsp; <a href="#/domains">Domains</a>
            &nbsp;›&nbsp; <span>${esc(d.title)}</span></div>
          <h1><span class="ic">${d.icon || "◆"}</span>${esc(d.title)}
            <span style="font-family:var(--mono);font-size:.5em;color:var(--faint)">
            ${String(d.num).padStart(2,"0")}</span></h1>
          <p class="tagline">${esc(d.tagline)}</p>
          <div class="overview">${bodyHTML(d.overview)}</div>
        </div>

        <div class="dlayout">
          <aside class="toc">
            <p class="section-label">On this page</p>
            <ul>${toc}</ul>
          </aside>
          <div class="dcontent">
            ${groups.map((g) =>
              (g.level ? `<div class="level-head"><span class="level-rule"></span><span class="level-name">${esc(g.level)}</span><span class="level-rule"></span></div>` : "")
              + g.topics.map((t) => topicCard(t, d)).join("")
            ).join("")}
          </div>
        </div>
      </div>
    `;

    setupScrollSpy();
    if (topicId) {
      const el = document.getElementById(topicId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("flash");
        setTimeout(() => el.classList.remove("flash"), 1600);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }

  function resourceList(list, extraClass) {
    const items = (list || []).map((r) => `
      <li><a href="${esc(r.url)}" target="_blank" rel="noopener">
        <span class="res-type ${r.type || "docs"}">${esc(r.type || "docs")}</span>
        <span class="res-label">${esc(r.label)}${r.note ? ` <span class="res-note">— ${esc(r.note)}</span>` : ""}</span>
        <span class="res-host">${esc(hostOf(r.url))}</span>
      </a></li>`).join("");
    return items ? `<ul class="resources${extraClass ? " " + extraClass : ""}">${items}</ul>` : "";
  }

  function topicCard(t, d) {
    const resources = (t.resources || []).map((r) => `
      <li><a href="${esc(r.url)}" target="_blank" rel="noopener">
        <span class="res-type ${r.type || "docs"}">${esc(r.type || "docs")}</span>
        <span class="res-label">${esc(r.label)}${r.note ? ` <span class="res-note">— ${esc(r.note)}</span>` : ""}</span>
        <span class="res-host">${esc(hostOf(r.url))}</span>
      </a></li>`).join("");

    const subs = (t.subtopics || []).map((s) => `
      <details class="subtopic">
        <summary><span class="sub-title">${inline(s.title)}</span><span class="sub-chev">▸</span></summary>
        <div class="sub-body">${bodyHTML(s.body)}${resourceList(s.resources, "sub-res")}</div>
      </details>`).join("");

    const conns = (t.connections || []).map((c) => {
      const tgt = resolveTarget(c.to);
      if (!tgt) return "";
      return `<a class="conn" href="${tgt.href}">
        <span class="conn-to"><span class="dot" style="background:${tgt.color}"></span>
          ${esc(tgt.domain.title)} <span class="arrow">→</span> ${esc(tgt.label)}</span>
        <span class="conn-note">${esc(c.note)}</span>
      </a>`;
    }).join("");

    return `
      <section class="topic" id="${t.id}">
        <h2>${esc(t.title)}</h2>
        <div class="body">${bodyHTML(t.body)}</div>
        ${subs ? `<div class="block-label">Deep dive — textbook subtopics</div><div class="subtopics">${subs}</div>` : ""}
        ${resources ? `<div class="block-label">Read / practice</div><ul class="resources">${resources}</ul>` : ""}
        ${conns ? `<div class="block-label">Connects to</div><div class="connections">${conns}</div>` : ""}
      </section>`;
  }

  function setupScrollSpy() {
    const links = [...document.querySelectorAll(".toc a")];
    const map = new Map(links.map((a) => [a.dataset.tid, a]));
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((a) => a.classList.remove("active"));
          const a = map.get(e.target.id);
          if (a) a.classList.add("active");
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    document.querySelectorAll(".topic").forEach((s) => obs.observe(s));
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
  function route() {
    const hash = location.hash || "#/";
    const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (resultsEl) resultsEl.hidden = true;
    if (parts.length === 0) return renderHome();
    if (parts[0] === "domains") return renderDomainsIndex();
    if (parts[0] === "connections") return renderConnections();
    if (parts[0] === "d") return renderDomain(parts[1], parts[2]);
    renderNotFound();
  }

  window.addEventListener("hashchange", route);
  if (!DOMAINS.length) {
    app.innerHTML = `<div class="dpage-head"><h1>No data loaded</h1>
      <p class="overview">The <code>data/*.js</code> files did not populate <code>window.ATLAS</code>.</p></div>`;
  } else {
    route();
  }
})();
