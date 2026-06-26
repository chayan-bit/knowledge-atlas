atlasAdd({
  id: "lowlevel",
  topics: [
    {
      id: "ll-cache",
      title: "Memory performance & cache",
      level: "Intermediate -> Advanced",
      body: [
        "The **cache hierarchy** (L1/L2/L3 latency, 64-byte lines, prefetching), cache-friendly layouts (**SoA vs AoS**, **false sharing**), bandwidth vs latency, TLB/huge pages, and profiling with `perf stat`/`perf mem`/cachegrind.",
        "This is where 'why is my correct program slow?' gets answered. The data-layout lessons here are the same ones that make GPU kernels and game engines fast.",
      ],
      subtopics: [
        {
          title: "The memory hierarchy: latency numbers every programmer should know",
          body: [
            "The memory hierarchy exists because DRAM is fast enough for storage but too slow for computation - and the gap has widened every decade. The rule of thumb for approximate latencies (2024 hardware): **L1 cache hit ~4 cycles** (~1ns); **L2 hit ~12 cycles** (~4ns); **L3 hit ~40 cycles** (~10ns); **DRAM access ~100-200 ns** (200-400 cycles); **NVMe SSD ~100 microseconds** (100,000 ns). An L3 miss to DRAM is 50-100x slower than an L1 hit. A program that misses the cache on every access is memory-bound - it spends 95% of its time waiting for DRAM, and the CPU's out-of-order engine cannot hide the latency.",
            "Every level of cache is organized into **cache lines** (typically 64 bytes on x86 and ARM). A cache line is the unit of transfer between levels - even if you read a single byte, the entire 64-byte line containing that byte is loaded into cache. This has two critical consequences. First, **spatial locality** pays off automatically: if you read `array[0]`, the next 15 ints (`array[1]` through `array[15]`) are already in the L1 cache for free. Second, **false sharing** occurs when two threads write to different variables that happen to share a cache line - even though they never access the same variable, every write invalidates the shared line in the other core's cache, creating invisible contention.",
            "Cache **associativity** determines where in the cache a given line can go. A **fully associative** cache can place any line anywhere (optimal hit rate but expensive hardware). A **direct-mapped** cache places each line in exactly one slot (cheap but frequent evictions). **N-way set-associative** (the universal design) divides the cache into sets of N slots; a line maps to exactly one set (by address bits) and can go into any of the N slots in that set. L1 is typically 4-8 way; L3 is 16-32 way. The practical consequence: accesses that are exactly a power-of-2 apart in memory may map to the same cache set and conflict-evict each other even when total working set is small. This is the 'power-of-2 stride' performance trap, visible in matrix multiply on large square matrices.",
            "**Hardware prefetching**: modern CPUs have prefetch engines that detect stride patterns (sequential, fixed-stride) and issue speculative memory reads before they are needed. A sequential scan over an array benefits enormously from hardware prefetch - the next cache line is being loaded while the current one is being processed. Random-access patterns (pointer chasing, hash table probing) defeat hardware prefetch, which is why linked lists are 5-10x slower than arrays for traversal on modern hardware, even when both fit in cache. Software prefetch (`__builtin_prefetch(addr, 0, 3)`) issues an explicit prefetch instruction, useful when you can compute the next access address a few iterations ahead.",
            "Measuring: `perf stat -e cache-misses,cache-references,cycles,instructions ./prog` shows L3 miss rate, IPC, and total misses. `perf mem record/report` profiles which load/store instructions are causing DRAM accesses. Valgrind's Cachegrind simulates a cache and counts misses per source line - slower than perf but exact. The goal is to understand your program's **working set** (the set of cache lines needed in a given time window) and whether it fits in L1, L2, or L3, because the latency cliff between levels is dramatic.",
          ],
          resources: [
            { label: "What Every Programmer Should Know About Memory - Drepper (the definitive reference)", url: "https://people.freebsd.org/~lstewart/articles/cpumemory.pdf", type: "paper" },
            { label: "Latency Numbers Every Programmer Should Know (interactive)", url: "https://colin-scott.github.io/personal_website/research/interactive_latency.html", type: "docs" },
          ],
        },
        {
          title: "Cache-friendly data layouts: AoS, SoA, and false sharing",
          body: [
            "**Array of Structs (AoS)** is the natural object-oriented layout: one struct per entity, all fields together. `struct Particle { float x, y, z, mass; float vx, vy, vz; int id; }; Particle particles[N];` - all data for particle i is together. AoS is cache-friendly when you access *all* fields of one entity at a time (random access by entity). It is cache-unfriendly when you process *one field* of all entities: a loop `for each p: p.x += p.vx * dt` loads 8 fields per cache line but uses only 2 - 75% of each cache line is wasted bandwidth.",
            "**Struct of Arrays (SoA)** separates each field into its own array: `float xs[N], ys[N], zs[N], masses[N], vxs[N], ...`. The loop `for each i: xs[i] += vxs[i] * dt` loads 64/4 = 16 floats per cache line, all useful - 100% bandwidth utilization. SoA is the right layout for SIMD (load 8 xs at once, 8 vxs at once, compute in parallel), for cache efficiency on field-per-all-entities access patterns, and for GPU (coalesced memory access). The tradeoff: updating all fields of one entity requires accessing N different arrays (poor locality if entities are processed one at a time).",
            "**AoSoA (Array of Struct of Arrays)** is the production hybrid used in physics engines (Bullet, Havok), game engines (Unity DOTS, Unreal), and HPC: group entities into blocks of K (where K = SIMD width, typically 8 or 16), and use SoA layout within each block. This gives SIMD-width locality for vectorization while grouping related entities (e.g. all particles in one simulation cell) in cache-friendly blocks. Intel's `ispc` and Unity's Burst compiler target this layout.",
            "**False sharing** is the performance bug where two threads modify different variables that occupy the same cache line. The **MESI cache coherence protocol** means that a write from Core A to its cache line propagates an invalidation to Core B's copy, forcing Core B to reload the line even though it never touched Core A's variable. A lock-free counter per thread stored in `counters[0]`, `counters[1]`, ... will false-share (they are 4 bytes each, 16 per cache line). The fix: pad each counter to a full cache line: `struct alignas(64) PaddedCounter { atomic<uint64_t> val; char pad[56]; };`. `perf c2c` (cache-to-cache) and Intel VTune's memory access analysis expose false sharing in real programs.",
            "Practical layout checklist for performance-critical code: (1) Identify your hot loop's access pattern - all-fields-of-one-entity or one-field-of-all-entities? (2) If one-field-of-all: use SoA or AoSoA. (3) Ensure hot data fits in L1 (32 KB) by separating hot fields from cold fields (the 'hot/cold field splitting' technique). (4) Align large structures to cache line boundaries (`alignas(64)`) to avoid false sharing. (5) Use `__builtin_prefetch` if you can compute future access addresses 200+ cycles early. (6) Profile before and after with `perf stat -e cache-misses`.",
          ],
          resources: [
            { label: "Algorithmica - memory access patterns and layout (SoA/AoS)", url: "https://en.algorithmica.org/hpc/cpu-cache/", type: "book" },
            { label: "CppCon 2014: Mike Acton - Data-Oriented Design and C++", url: "https://www.youtube.com/watch?v=rX0ItVEVjHc", type: "video" },
          ],
        },
        {
          title: "TLB, huge pages, and virtual memory performance",
          body: [
            "The **TLB (Translation Lookaside Buffer)** is a small, fully-associative cache inside the CPU that stores recent virtual-to-physical address translations. Every memory access (load or store) requires a virtual-to-physical translation, but walking the page table for each access would require 4 additional DRAM accesses on x86-64 (4-level page table). The TLB caches the result so that hot virtual pages are translated in ~1 extra cycle instead of ~200 ns. A **TLB miss** triggers a hardware page table walk, costing ~20-100 cycles (if the page table is in cache) to ~200 ns (if it must go to DRAM).",
            "The TLB has limited capacity: typically 64 entries for L1 ITLB (instruction), 64 entries for L1 DTLB (data), and 1024-2048 entries for the unified L2 TLB. With 4 KB pages, 64 DTLB entries cover only 256 KB of working data - enough for L1/L2 cache, but if your hot data footprint is in the L3 (several MB), you will have frequent TLB misses. Each miss shows up as a TLB miss in `perf stat -e dTLB-load-misses`.",
            "**Huge pages** (2 MB on x86-64, or 1 GB with 'gigantic pages') reduce TLB pressure by increasing the page size: 64 DTLB entries now cover 128 MB instead of 256 KB. The same working set requires far fewer TLB entries. On Linux, transparent huge pages (THP) are the default mechanism: `echo always > /sys/kernel/mm/transparent_hugepage/enabled` enables them globally. For latency-critical code (databases, HPC, HFT), explicit huge page allocation via `mmap(... MAP_HUGETLB ...)` or `hugetlbfs` gives more predictable behavior than THP (which may split and coalesce asynchronously). Redis, PostgreSQL, and JVM garbage collectors all have huge page options.",
            "**NUMA (Non-Uniform Memory Access)** matters on multi-socket servers. Each CPU socket has local DRAM (fast, ~100 ns) and remote DRAM (accessed via QPI/UPI interconnect, ~300 ns). A thread running on socket 0 that accesses memory allocated on socket 1 pays the NUMA penalty. The Linux `numactl` command binds processes to a socket and its local memory. Memory-intensive workloads (databases, in-memory caches) see 2-3x throughput differences with vs without NUMA awareness. `numastat` and `perf stat -e node-load-misses` profile NUMA behavior.",
            "Profiling memory performance: `perf stat` gives the high-level view (cache miss rate, IPC). `perf mem record` annotates which source lines cause memory-bound stalls. Cachegrind and the Intel Memory Latency Checker (`mlc`) measure sustained bandwidth and latency profiles. The key diagnostic question is whether the bottleneck is **latency** (a pointer-chasing traversal that cannot be parallelized) or **bandwidth** (a sequential scan that is limited by DRAM bandwidth). The fix for latency-bound is better data structures (less pointer chasing); for bandwidth-bound, algorithmic restructuring to reduce data volume (compression, better working set management) or hardware upgrade (higher-bandwidth DRAM channels).",
          ],
          resources: [
            { label: "Brendan Gregg - Linux perf examples and TLB miss analysis", url: "https://www.brendangregg.com/perf.html", type: "docs" },
            { label: "What Every Programmer Should Know About Memory - Drepper, section 7 (TLB)", url: "https://people.freebsd.org/~lstewart/articles/cpumemory.pdf", type: "paper" },
          ],
        },
        {
          title: "Profiling: perf, Cachegrind, and bandwidth vs latency diagnosis",
          body: [
            "`perf stat ./prog` is the first tool to reach for: it samples hardware performance counters (cycles, instructions, cache-references, cache-misses, branches, branch-misses) across the full run and reports them. IPC (instructions per cycle) is the health metric: a well-optimized computation-bound program runs at 2-4 IPC; a memory-bound program runs at 0.5-1 IPC. A high cache-miss rate with low IPC immediately suggests the bottleneck is DRAM latency. `perf stat -e cache-misses,dTLB-load-misses,branch-misses` gives the targeted view.",
            "`perf record -g ./prog; perf report` profiles which *functions* consume the most CPU time (via hardware counter sampling, with full call graph if `-g` is passed). This identifies the hot function. Then `perf annotate <function>` shows the assembly with per-instruction sample counts, revealing exactly which instruction is the stall point. On Intel CPUs with LBR (Last Branch Record), the stall is attributed to the load/store that caused the miss rather than the instruction waiting for the result, giving precise attribution.",
            "**Cachegrind** (`valgrind --tool=cachegrind`) simulates an L1/L2/L3 cache and counts cache misses per source line. It is 50-100x slower than real execution (due to simulation) but gives exact counts rather than sampled estimates, and is reproducible. `cg_annotate cachegrind.out.*` shows miss counts per source line. Cachegrind is most useful for small benchmarks where you want to count misses precisely, or for comparing two implementations before profiling on production hardware.",
            "Diagnosing **bandwidth-bound vs latency-bound**: a sequential scan over 100 MB of data - every access is predictable, hardware prefetch hides the latency, and the limit is DRAM bandwidth (typically 30-100 GB/s on a server). A hash table traversal over 100 MB - each probe is random, hardware prefetch fails, and each access waits the full ~100 ns DRAM latency. The simple test: double the data size. If throughput halves (same time), you are bandwidth-bound. If time roughly doubles (same throughput), you are latency-bound and the problem is pointer chasing or random access. Fix bandwidth-bound with data compression; fix latency-bound with cache-oblivious algorithms, better data structures, or software prefetch.",
          ],
          resources: [
            { label: "Brendan Gregg - perf examples (comprehensive reference)", url: "https://www.brendangregg.com/perf.html", type: "docs" },
            { label: "Algorithmica - profiling and performance analysis", url: "https://en.algorithmica.org/hpc/profiling/", type: "book" },
          ],
        },
      ],
      resources: [
        { label: "What Every Programmer Should Know About Memory - Drepper (PDF)", url: "https://people.freebsd.org/~lstewart/articles/cpumemory.pdf", type: "paper" },
        { label: "Algorithmica - HPC / cache chapters (free)", url: "https://en.algorithmica.org/hpc/", type: "book", note: "superb modern perf book" },
        { label: "Brendan Gregg - perf examples", url: "https://www.brendangregg.com/perf.html", type: "docs" },
      ],
      connections: [
        { to: "dsa-linear", note: "This is the rigorous version of 'arrays beat linked lists'" },
        { to: "game-ecs", note: "ECS exists precisely to get SoA, cache-friendly entity iteration" },
        { to: "gpu-memory", note: "Coalesced GPU access is the same locality principle on a different machine" },
      ],
    },
  ],
});
