atlasAdd({
  id: "dsa",
  num: 1,
  title: "Foundations & DSA",
  icon: "🧮",
  color: "#ff7a93",
  tagline: "From zero to competitive-programming and systems-level algorithmic fluency.",
  overview: [
    "This is the root of the whole atlas. Almost every other domain is an *application* of something here: a database index is a **B-tree**, a blockchain is a **Merkle tree** plus a hash table, a compiler's optimizer is **dataflow analysis on a graph**, a GPU kernel is **cache-aware array layout**, and a trading backtest is **dynamic programming over a time series**.",
    "Treat it in two layers. First, the *mechanical* layer — implement every structure from scratch until the cost model (amortized, cache, branch) is in your fingers. Second, the *design* layer — given an unseen problem, recognize which paradigm collapses it. The milestone that matters is being able to prove **why** an algorithm is correct, not just that it passes tests.",
  ],
  topics: [
    {
      id: "dsa-foundations",
      title: "How a computer actually runs your code",
      level: "Beginner",
      body: [
        "Before any data structure, internalize the substrate: **binary / two's complement / IEEE-754**, the **fetch-decode-execute** cycle, and what *really* happens to the **stack vs heap** on a function call. This is the bedrock that makes pointers, undefined behavior, and cache effects later feel obvious instead of magical.",
        "Pair it with fluency in the tools that surround code — the shell (`stdin`/`stdout`/`stderr`, pipes, redirection) and **Git internals** (blobs, trees, commits, refs — not just `add`/`commit`). Petzold's *Code* builds the machine from a light switch up; CS50 gives you the hands-on reps.",
      ],
      resources: [
        { label: "CS50x — Harvard (full course)", url: "https://cs50.harvard.edu/x/", type: "course", note: "the best on-ramp, no debate" },
        { label: "MIT — The Missing Semester (CLI, Git, shell)", url: "https://missing.csail.mit.edu/", type: "course" },
        { label: "Git Internals — Pro Git, Ch. 10", url: "https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain", type: "book" },
        { label: "Code — Charles Petzold (companion site)", url: "https://www.codehiddenlanguage.com/", type: "book", note: "computers from first principles" },
        { label: "Python Official Tutorial", url: "https://docs.python.org/3/tutorial/", type: "docs" },
      ],
      connections: [
        { to: "ll-cmemory", note: "Stack-vs-heap here becomes the C memory model — segments, UB, pointer arithmetic" },
        { to: "os-foundations", note: "stdin/stdout/fds and the shell are the OS's process abstraction in disguise" },
        { to: "web-platform", note: "Git workflow (branches, rebase, bisect) is the daily loop of every web project" },
      ],
    },
    {
      id: "dsa-linear",
      title: "Linear structures & the cost model",
      level: "Beginner → Intermediate",
      body: [
        "Dynamic arrays, linked lists, stacks, queues, deques, circular buffers. The point is not the API — it is the **cost model**: amortized O(1) array growth (and its doubling proof), why linked lists lose on modern hardware (**cache locality**), and when they still win (stable pointers, O(1) splice).",
        "Master the *techniques* that ride on them: the **monotonic stack** (next-greater-element, histogram), the **sliding-window deque**, and the lock-free **SPSC ring buffer** that shows up in audio, networking, and trading.",
      ],
      resources: [
        { label: "VisuAlgo — animated data structures", url: "https://visualgo.net/en", type: "tool" },
        { label: "CP-Algorithms — data structures", url: "https://cp-algorithms.com/data_structures/", type: "docs" },
        { label: "CLRS — Introduction to Algorithms (MIT 6.006 lectures)", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/", type: "course" },
      ],
      connections: [
        { to: "ll-cache", note: "Why arrays beat lists IS the cache-line / prefetch story, made concrete" },
        { to: "ll-concurrency", note: "The lock-free ring buffer is the canonical SPSC/MPMC concurrency exercise" },
        { to: "os-concurrency", note: "Producer-consumer queues are the OS IPC primitive" },
      ],
    },
    {
      id: "dsa-trees",
      title: "Trees: balanced, disk-friendly, and range",
      level: "Intermediate",
      body: [
        "BSTs → **AVL / red-black** (rotations, the O(log n) height guarantee behind `std::map`) → **B-trees / B+ trees**, the structure every database index and filesystem is built on because they minimize disk seeks.",
        "Then the competitive-programming workhorses: **segment trees** (with lazy propagation for range updates), **Fenwick/BIT** for prefix sums, **tries / radix trees**, and **suffix tries → suffix arrays**. Understand the *why*: fan-out trades height for node size, which is exactly the memory-hierarchy tradeoff.",
      ],
      resources: [
        { label: "CP-Algorithms — Segment Tree", url: "https://cp-algorithms.com/data_structures/segment_tree.html", type: "docs" },
        { label: "CP-Algorithms — Fenwick Tree", url: "https://cp-algorithms.com/data_structures/fenwick.html", type: "docs" },
        { label: "B-Trees — CLRS chapter (MIT OCW notes)", url: "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/", type: "course" },
        { label: "VisuAlgo — BST / AVL / B-tree", url: "https://visualgo.net/en/bst", type: "tool" },
      ],
      connections: [
        { to: "web-databases", note: "B+ trees ARE the PostgreSQL/MySQL index — same structure, on disk" },
        { to: "os-filesystems", note: "ext4 extent trees and directory indexes are B-tree variants" },
        { to: "web3-fundamentals", note: "Merkle trees are hash-augmented binary trees — the inclusion-proof backbone of blockchains" },
      ],
    },
    {
      id: "dsa-hashing",
      title: "Hashing & probabilistic structures",
      level: "Intermediate",
      body: [
        "Hash functions (djb2, MurmurHash3, xxHash) and the **avalanche** property; collision resolution (chaining vs open addressing, **Robin Hood hashing**); load factor and the amortized-O(1) rehash proof.",
        "Then the probabilistic family that powers real systems at scale: **Bloom filters** (false-positive math, used in LevelDB/Cassandra to skip disk reads) and **Count-Min sketch** for streaming frequency estimation.",
      ],
      resources: [
        { label: "CP-Algorithms — Hashing", url: "https://cp-algorithms.com/string/string-hashing.html", type: "docs" },
        { label: "Robin Hood Hashing — original paper context (Sebastian Sylvan)", url: "https://www.sebastiansylvan.com/post/robin-hood-hashing-should-be-your-default-hash-table-implementation/", type: "docs" },
        { label: "Bloom Filters — interactive explainer (Jason Davies)", url: "https://www.jasondavies.com/bloomfilter/", type: "tool" },
      ],
      connections: [
        { to: "web-databases", note: "Redis, LevelDB and Cassandra lean on hash tables + Bloom filters internally" },
        { to: "crypto-symmetric", note: "Cryptographic hashes (SHA-256) add collision-resistance on top of the same idea" },
        { to: "dsa-strings", note: "Rolling hashes (Rabin-Karp) are hashing applied to substrings" },
      ],
    },
    {
      id: "dsa-graphs",
      title: "Graphs: traversal, shortest paths, flow",
      level: "Intermediate → Advanced",
      body: [
        "Representations (adjacency list vs matrix vs **CSR** — the sparse layout used in scientific computing and GNNs). DFS/BFS and *all* their applications: cycle detection, topological sort, bipartiteness, **Union-Find** (union-by-rank + path compression → inverse-Ackermann).",
        "Shortest paths (Dijkstra — and *why* no negative edges — Bellman-Ford, Johnson's), MSTs (Kruskal/Prim), and **network flow** (Dinic's, min-cost max-flow) which quietly solves a huge class of assignment/matching problems.",
      ],
      resources: [
        { label: "William Fiset — Graph Theory playlist", url: "https://www.youtube.com/playlist?list=PLDV1Zeh2NRsDGO4--qE8yH72HFL1Km93P", type: "video" },
        { label: "CP-Algorithms — Graph algorithms", url: "https://cp-algorithms.com/graph/breadth-first-search.html", type: "docs" },
        { label: "CSES Problem Set — Graph section", url: "https://cses.fi/problemset/", type: "practice" },
      ],
      connections: [
        { to: "comp-ssa", note: "Compiler control-flow graphs + dominator/dataflow analysis are graph algorithms" },
        { to: "ai-math", note: "CSR sparse layout and graph traversal underpin GNNs and message passing" },
        { to: "web3-fundamentals", note: "P2P peer discovery uses Kademlia DHT; consensus is graph fork-choice" },
      ],
    },
    {
      id: "dsa-paradigms",
      title: "Design paradigms: sorting, D&C, greedy, DP",
      level: "Advanced",
      body: [
        "The core decision skill: given a problem, name the paradigm. **Sorting** (the Ω(n log n) decision-tree bound, introsort), **divide & conquer** (Master theorem, **FFT** for convolution/polynomial multiply), **greedy** (exchange-argument proofs, matroids), and **dynamic programming** in all its forms — DP on trees, bitmask DP (TSP), digit DP, matrix exponentiation, and the convex-hull-trick / Knuth optimizations.",
        "DP is the single highest-leverage topic in this domain because it reappears literally everywhere downstream (Bellman equations in RL, sequence alignment, parsing).",
      ],
      resources: [
        { label: "Competitive Programmer's Handbook (free PDF)", url: "https://cses.fi/book/book.pdf", type: "book", note: "Laaksonen — read cover to cover" },
        { label: "CSES Problem Set — 300 problems", url: "https://cses.fi/problemset/", type: "practice", note: "solving all ≈ competitive" },
        { label: "AtCoder Educational DP Contest", url: "https://atcoder.jp/contests/dp", type: "practice" },
        { label: "FFT — CP-Algorithms", url: "https://cp-algorithms.com/algebra/fft.html", type: "docs" },
      ],
      connections: [
        { to: "ai-rl", note: "Value/policy iteration are dynamic programming on the Bellman equation" },
        { to: "quant-options", note: "Binomial option pricing is backward-induction DP on a tree" },
        { to: "comp-parsing", note: "CYK parsing is DP; the Master theorem governs parser/optimizer complexity" },
      ],
    },
    {
      id: "dsa-strings",
      title: "String algorithms",
      level: "Advanced",
      body: [
        "**KMP** (understand the failure function, don't memorize it), the **Z-algorithm** (same power, simpler), **Rabin-Karp** rolling hashes, **Aho-Corasick** for multi-pattern matching, and the heavy artillery: **suffix arrays + LCP** (O(n) SA-IS construction) and **suffix automata** for counting distinct substrings.",
        "These power full-text search, bioinformatics, plagiarism/diff tools, and intrusion-detection signature matching.",
      ],
      resources: [
        { label: "CP-Algorithms — String processing", url: "https://cp-algorithms.com/string/prefix-function.html", type: "docs" },
        { label: "Stanford CS97SI — Suffix arrays notes", url: "https://web.stanford.edu/class/cs97si/suffix-array.pdf", type: "course" },
      ],
      connections: [
        { to: "cyber-malware", note: "Aho-Corasick is how AV / IDS match many signatures in one pass (YARA-style)" },
        { to: "comp-frontend", note: "Lexing is finite-automaton string matching — the same theory" },
        { to: "ai-llm", note: "BPE tokenization is a greedy substring-merging string algorithm" },
      ],
    },
    {
      id: "dsa-complexity",
      title: "Complexity, advanced DS & geometry",
      level: "Research",
      body: [
        "Where the right structure is non-obvious: **link-cut trees** and Euler-tour trees (dynamic connectivity), **persistent** data structures, **wavelet trees**, and **sqrt-decomposition / Mo's algorithm**. On the theory side: P/NP/PSPACE/#P, NP-completeness reductions, approximation hardness (PCP intuition), and **computational geometry** (convex hull, line sweep, Voronoi/Delaunay).",
        "Capstone the domain by writing a **SAT solver** (DPLL → CDCL) — it ties complexity theory to a tool used in verification, crypto, and program analysis.",
      ],
      resources: [
        { label: "MIT 6.851 — Advanced Data Structures (Demaine)", url: "https://courses.csail.mit.edu/6.851/", type: "course" },
        { label: "Parameterized Algorithms (free PDF) — Cygan et al.", url: "https://www.mimuw.edu.pl/~malcin/book/parameterized-algorithms.pdf", type: "book" },
        { label: "Computational Geometry — CP-Algorithms", url: "https://cp-algorithms.com/geometry/basic-geometry.html", type: "docs" },
      ],
      connections: [
        { to: "crypto-pqc", note: "Lattice problems (SVP/CVP) and LLL reduction are computational-geometry / complexity results" },
        { to: "cyber-research", note: "SAT/SMT solvers drive symbolic execution and automated vuln discovery" },
        { to: "game-physics", note: "Convex hull + line-sweep are the collision-geometry primitives" },
      ],
    },
  ],
});
