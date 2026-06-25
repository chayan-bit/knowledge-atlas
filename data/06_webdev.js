atlasAdd({
  id: "webdev",
  num: 6,
  title: "Web Development",
  icon: "🌐",
  color: "#9ece6a",
  tagline: "From HTML/CSS to distributed systems, performance, and production architecture.",
  overview: [
    "Web dev is the most-shipped discipline here, and the trap is staying at the framework surface. The real depth is in the platform (how the browser, the event loop, and HTTP actually work) and in the backend systems (databases, caching, distributed architecture) that the framework hides.",
    "The arc: own the platform → build full-stack apps with real auth and databases → engineer performance and design systems at scale. The distributed-systems and database material here is the bridge to everything from quant infra to ML serving.",
  ],
  topics: [
    {
      id: "web-platform",
      title: "The web platform: HTML, CSS, the browser",
      level: "Beginner",
      body: [
        "Semantic HTML + accessibility (ARIA, screen readers), CSS the way it's actually designed (cascade, specificity, inheritance, **flexbox/grid**, `clamp()`/container queries), and the JS runtime model: **event loop**, call stack, **microtasks vs macrotasks**, DOM, and the Fetch API.",
        "Understanding the event loop is the single concept that separates people who 'use' JS from people who reason about it.",
      ],
      resources: [
        { label: "The Odin Project — full-stack curriculum (free)", url: "https://www.theodinproject.com/", type: "course" },
        { label: "MDN Web Docs — the platform reference", url: "https://developer.mozilla.org/en-US/", type: "docs" },
        { label: "Jake Archibald — In The Loop (event loop talk)", url: "https://www.youtube.com/watch?v=cCOL7MC4Pl0", type: "video" },
        { label: "Josh Comeau — CSS mental model articles", url: "https://www.joshwcomeau.com/", type: "docs" },
      ],
      connections: [
        { to: "cyber-web", note: "Cookies/sessions/CSP you learn here are what web attacks target" },
        { to: "comp-parsing", note: "Browsers parse HTML/CSS with error-recovering parsers from compiler theory" },
        { to: "dsa-foundations", note: "The Git workflow (branches/rebase/bisect) is the daily web-dev loop" },
      ],
    },
    {
      id: "web-js",
      title: "JavaScript & TypeScript deeply",
      level: "Intermediate",
      body: [
        "Prototypes and the `[[Prototype]]` chain, **closures** (and the `let` vs `var` loop bug), event-loop internals (`queueMicrotask`, `requestAnimationFrame`), and **TypeScript** in depth: generics, conditional/mapped types, template literal types, `infer`. Plus module systems (ESM vs CJS, tree shaking) and Web Workers/SharedArrayBuffer.",
        "TS's type system is genuinely a small functional language — and it's applied type theory.",
      ],
      resources: [
        { label: "javascript.info (free deep dive)", url: "https://javascript.info/", type: "course" },
        { label: "TypeScript Handbook", url: "https://www.typescriptlang.org/docs/handbook/intro.html", type: "docs" },
        { label: "Type Challenges (practice TS type system)", url: "https://github.com/type-challenges/type-challenges", type: "practice" },
      ],
      connections: [
        { to: "comp-types", note: "TS generics/conditional types are Hindley-Milner-adjacent type theory" },
        { to: "comp-runtime", note: "V8 hidden classes & inline caches explain JS performance" },
        { to: "web-react", note: "React is built on closures and the JS execution model" },
      ],
    },
    {
      id: "web-react",
      title: "React internals & rendering",
      level: "Intermediate",
      body: [
        "The rendering model: reconciliation, **fiber architecture**, lanes/priority, when components re-render and how to stop them (`memo`/`useMemo`/`useCallback` — when they help vs hurt), the `useEffect` model, concurrent features (`useTransition`, Suspense), and **Server Components** (zero-JS components, streaming).",
        "Knowing *why* React re-renders is what turns 'it's slow and I don't know why' into deliberate optimization.",
      ],
      resources: [
        { label: "React — official docs (new)", url: "https://react.dev/", type: "docs" },
        { label: "Josh Comeau — Why React Re-Renders", url: "https://www.joshwcomeau.com/react/why-react-re-renders/", type: "docs" },
        { label: "Build your own React — Rodrigo Pombo", url: "https://pomb.us/build-your-own-react/", type: "docs" },
      ],
      connections: [
        { to: "web-perf", note: "Re-render control is the front-end half of Core Web Vitals (INP)" },
        { to: "web-js", note: "Hooks and reconciliation lean entirely on closures and the event loop" },
        { to: "game-loop", note: "requestAnimationFrame render loops mirror the game-loop pattern" },
      ],
    },
    {
      id: "web-backend",
      title: "Backend: APIs, auth, real-time",
      level: "Intermediate",
      body: [
        "HTTP internals → Express/Hono as abstraction, REST design (idempotency, versioning), the middleware pattern, **authentication** (sessions, JWT access/refresh, OAuth 2.0 PKCE, httpOnly cookies), input validation with **zod**, production hardening (rate limiting, CORS, Helmet), and **WebSockets vs SSE vs polling**.",
        "Auth is where most real-world security bugs live; build it carefully and you've covered a huge part of the attack surface.",
      ],
      resources: [
        { label: "Full Stack Open (free) — React, Node, testing, Docker", url: "https://fullstackopen.com/en/", type: "course" },
        { label: "OAuth 2.0 — official site & flows", url: "https://oauth.net/2/", type: "docs" },
        { label: "zod — schema validation docs", url: "https://zod.dev/", type: "docs" },
      ],
      connections: [
        { to: "cyber-web", note: "OWASP attacks target exactly this auth/validation/CORS layer" },
        { to: "ll-network", note: "High-throughput servers bottom out in epoll/io_uring you study low-level" },
        { to: "ai-mlops", note: "Model-serving endpoints reuse the same API/auth/rate-limit patterns" },
      ],
    },
    {
      id: "web-databases",
      title: "Databases & caching",
      level: "Intermediate → Advanced",
      body: [
        "SQL deeply (JOINs, **window functions**, CTEs, `EXPLAIN ANALYZE`), **PostgreSQL internals** (**MVCC**, vacuum, index types: B-tree/GiST/GIN/BRIN), index strategy (composite/covering/partial), the **N+1 problem**, **Redis** data structures + cache-aside, and transactions/isolation levels (phantom reads, deadlocks).",
        "Kleppmann's *DDIA* is the one book that makes databases and distributed systems click as a coherent whole.",
      ],
      resources: [
        { label: "Designing Data-Intensive Applications — Kleppmann", url: "https://dataintensive.net/", type: "book", note: "the best DB/distributed-systems book" },
        { label: "PostgreSQL — official documentation", url: "https://www.postgresql.org/docs/current/", type: "docs" },
        { label: "Use The Index, Luke — SQL indexing", url: "https://use-the-index-luke.com/", type: "docs" },
      ],
      connections: [
        { to: "dsa-trees", note: "Every B-tree index is the structure you implemented in DSA" },
        { to: "os-filesystems", note: "WAL/journaling and MVCC mirror filesystem durability mechanics" },
        { to: "quant-hft", note: "Time-series stores (kdb+/Parquet) are the quant analogue of these DBs" },
      ],
    },
    {
      id: "web-perf",
      title: "Performance engineering",
      level: "Advanced",
      body: [
        "**Core Web Vitals** (LCP, INP, CLS — what affects each), the **critical rendering path** (HTML→CSSOM→render tree→layout→paint→composite), resource loading (preload/prefetch/priority hints), V8 optimization (hidden classes, deopt triggers), bundle splitting, image formats (AVIF/WebP), caching (`stale-while-revalidate`, CDN edge), and Service Workers.",
        "Measure with the DevTools Performance panel — taking an LCP from >4s to <1.5s is the canonical reps.",
      ],
      resources: [
        { label: "web.dev — performance (Google)", url: "https://web.dev/explore/learn-core-web-vitals", type: "docs" },
        { label: "High Performance Browser Networking — Grigorik (free)", url: "https://hpbn.co/", type: "book" },
      ],
      connections: [
        { to: "comp-runtime", note: "V8 hidden classes / JIT deopt are the compiler-runtime cause of JS perf" },
        { to: "ll-cache", note: "Same 'measure, find the real bottleneck' discipline as CPU perf" },
        { to: "web-react", note: "INP is dominated by render cost — React optimization lands here" },
      ],
    },
    {
      id: "web-systemdesign",
      title: "System design at scale",
      level: "Advanced",
      body: [
        "Load balancing (consistent hashing), horizontal scaling (stateless services, shared cache), CDN internals (anycast, PoPs, origin shield), DB scaling (read replicas, connection pooling, partitioning), the **CAP theorem** (what it actually constrains), **message queues** (Kafka vs RabbitMQ vs SQS, at-least-once vs exactly-once), and event sourcing/CQRS.",
        "This is the vocabulary of building things that don't fall over at 100k req/s.",
      ],
      resources: [
        { label: "System Design Primer (free, GitHub)", url: "https://github.com/donnemartin/system-design-primer", type: "repo" },
        { label: "Designing Data-Intensive Applications — Kleppmann", url: "https://dataintensive.net/", type: "book" },
      ],
      connections: [
        { to: "os-virtualization", note: "VMs vs containers is the deployment substrate of these systems" },
        { to: "web-databases", note: "Replication/partitioning/CAP are database-scaling decisions" },
        { to: "ai-mlops", note: "ML inference at scale is a system-design problem (queues, autoscaling)" },
      ],
    },
    {
      id: "web-advanced",
      title: "Browser internals, WASM & the edge",
      level: "Expert",
      body: [
        "Rendering pipeline internals (Blink/WebKit, compositor thread, layer promotion), **V8 deep dive** (TurboFan, Maglev, Sparkplug), **HTTP/3 + QUIC** (0-RTT, connection migration), **WebAssembly** (linear memory, WASI, porting C/Rust to the browser), and edge computing (Cloudflare Durable Objects/KV, V8 isolates).",
        "WASM in particular is where web dev meets low-level systems — you ship compiled C/Rust to a browser sandbox.",
      ],
      resources: [
        { label: "V8 blog (engine internals)", url: "https://v8.dev/blog", type: "docs" },
        { label: "MDN — WebAssembly", url: "https://developer.mozilla.org/en-US/docs/WebAssembly", type: "docs" },
        { label: "Cloudflare blog — edge & QUIC", url: "https://blog.cloudflare.com/", type: "docs" },
      ],
      connections: [
        { to: "ll-rust", note: "WASM's sweet spot is shipping compiled Rust/C to the browser" },
        { to: "comp-llvm", note: "WASM is an LLVM backend target; the toolchain is compiler tech" },
        { to: "game-gpu-api", note: "WebGPU brings Vulkan-style GPU access to the browser" },
      ],
    },
  ],
});
