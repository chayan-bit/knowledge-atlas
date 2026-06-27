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
// later calls with the same id contribute more topics. Topics merge BY TOPIC ID:
// a base file can define a topic's blurb (body/resources/connections) and a
// per-topic file can later enrich that same id with a `subtopics` array - the
// two are merged into one topic instead of producing a duplicate. Topics with a
// new id are appended. This lets a large domain (e.g. web3, ai/ml) live as one
// file per topic without bloating any file.
window.atlasAdd = function atlasAdd(domain) {
  const existing = window.ATLAS.find((d) => d.id === domain.id);
  if (!existing) {
    window.ATLAS.push(domain);
    return domain;
  }
  existing.topics = existing.topics || [];
  for (const t of domain.topics || []) {
    const prev = t.id && existing.topics.find((x) => x.id === t.id);
    if (prev) {
      // later, more-specific fields win (subtopics, fuller body, etc.);
      // fields the new object omits are preserved from the first definition.
      for (const k of Object.keys(t)) if (t[k] != null) prev[k] = t[k];
    } else {
      existing.topics.push(t);
    }
  }
  // later files may fill in meta the first file omitted
  for (const k of ["num", "title", "icon", "color", "tagline", "overview"]) {
    if (existing[k] == null && domain[k] != null) existing[k] = domain[k];
  }
  return existing;
};
