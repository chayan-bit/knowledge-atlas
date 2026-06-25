# Knowledge Atlas

A local, offline, single-folder website that turns the 12 learning roadmaps in `01_Inbox`
into one connected knowledge graph — plus a 13th domain, **Low-Level AI / GPU Systems**.

Each domain is a page of in-depth topic write-ups, every topic carries **exact** deep-links
(e.g. *EVM internals* → the Ethereum.org EVM page + evm.codes, not a generic homepage), and
every topic links to the same idea wherever it reappears in another field
(*EVM → ECDSA in Cryptography → bytecode VMs in Compilers*).

## Open it

Just open `index.html` in any browser — no server, no build, no network needed.

```
open index.html        # macOS
```

## What's inside

- **13 domains**, 117 topic clusters, 309 curated exact links, 316 cross-domain connections.
- An interactive **knowledge graph** on the home page (hover to light up connections, click to open).
- Global **search** ( press `/` ) across every topic, resource, and description.
- A **Connections** view listing every cross-domain link, grouped by source.

## Structure

```
index.html        # shell + script tags
styles.css        # custom dark "Tech Innovation" theme
app.js            # router, renderer, SVG graph, search (vanilla JS, no deps)
data/
  _init.js        # data contract / schema docs
  01_dsa.js … 13_gpu.js   # one file per domain (the knowledge itself)
```

## Extending it

Add a topic by editing the relevant `data/NN_*.js` file — push a topic object onto its
`topics` array (schema documented in `data/_init.js`). To link it to another domain, add a
`{ to: "<topic-id>", note: "why" }` entry to `connections`; the renderer resolves it
automatically. Add a whole new domain by creating `data/14_*.js` and a `<script>` tag in
`index.html`.

Resource `type` values control the colored badge: `docs · paper · course · book · tool ·
video · repo · practice`.
