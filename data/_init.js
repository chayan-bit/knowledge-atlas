/* ============================================================
   Knowledge Atlas — data contract
   Each data/NN_*.js file calls atlasAdd({...}) with one domain.

   Domain schema:
   {
     id:       "web3",                // unique slug, used in URLs
     num:      12,                    // ordering / display number
     title:    "Web3 & Blockchain",
     icon:     "⛓️",
     color:    "#f7931a",            // accent (per-domain)
     tagline:  "one-line scope",
     overview: ["paragraph", ...],   // domain framing (markdown-lite)
     topics: [ Topic, ... ]
   }

   Topic schema:
   {
     id:    "web3-evm",              // globally-unique; targets for connections
     title: "The EVM & Ethereum execution",
     level: "Beginner → Intermediate",
     body:  ["paragraph", ...],      // supports **bold** `code` _em_
     resources: [ { label, url, type, note? }, ... ],
     connections: [ { to: "<topicId|domainId>", note: "why" }, ... ]
   }

   Resource `type` ∈ docs | paper | course | book | tool | video | repo | practice
   ============================================================ */

window.ATLAS = window.ATLAS || [];

// atlasAdd merges by domain id, so a single domain can be split across several
// files: the first call establishes the domain (meta + initial topics), and
// later calls with the same id simply append more topics. This lets a large
// domain (e.g. web3) live as one file per topic without bloating any file.
window.atlasAdd = function atlasAdd(domain) {
  const existing = window.ATLAS.find((d) => d.id === domain.id);
  if (existing) {
    existing.topics = (existing.topics || []).concat(domain.topics || []);
    // later files may fill in meta the first file omitted
    for (const k of ["num", "title", "icon", "color", "tagline", "overview"]) {
      if (existing[k] == null && domain[k] != null) existing[k] = domain[k];
    }
    return existing;
  }
  window.ATLAS.push(domain);
  return domain;
};
