atlasAdd({
  id: "lowlevel",
  num: 4,
  title: "Low-Level & Systems",
  icon: "🔩",
  color: "#ff9e64",
  tagline: "From C pointers to lock-free systems and kernel-bypass networking.",
  overview: [
    "This domain is about knowing *exactly* what your code does in memory and on the CPU — no abstraction left unexamined. It sits between OS (what the kernel provides) and compilers (how code is generated), and it's the prerequisite for binary exploitation, HFT, GPU programming, and game engines.",
    "The arc: master C and the memory model → understand the ABI/linker/assembly → make code as fast as the hardware allows (cache, SIMD, branch prediction) → write lock-free and kernel-bypass systems. Rust enters as the modern way to get most of this safety without a GC.",
  ],
  topics: [
    {
      id: "ll-cmemory",
      title: "The C memory model & undefined behavior",
      level: "Beginner",
      body: [
        "Draw the layout: stack frames, heap, `.data`/`.bss`/`.text`. Master pointers (arithmetic, function pointers, `void*`), manual **memory ownership**, **struct layout** (padding/alignment), and — critically — **undefined behavior** (signed overflow, OOB, strict aliasing) and *why the compiler exploits it*.",
        "Build `malloc`/`free` with a free list, and use Compiler Explorer to watch your C become assembly in real time.",
      ],
      resources: [
        { label: "Compiler Explorer (godbolt.org)", url: "https://godbolt.org/", type: "tool", note: "C → asm, live" },
        { label: "Beej's Guide to C Programming (free)", url: "https://beej.us/guide/bgc/", type: "book" },
        { label: "What Every C Programmer Should Know About UB — LLVM blog", url: "https://blog.llvm.org/2011/05/what-every-c-programmer-should-know.html", type: "docs" },
      ],
      connections: [
        { to: "os-memory", note: "Your free-list malloc sits directly on top of sbrk/mmap from the OS" },
        { to: "cyber-pwn", note: "Buffer overflows and UB are exactly what binary exploitation weaponizes" },
        { to: "emb-foundations", note: "volatile, bitfields and manual memory are the daily reality of embedded C" },
      ],
    },
    {
      id: "ll-abi",
      title: "ABI, linking & ELF",
      level: "Intermediate",
      body: [
        "The **System V x86-64 ABI** (arg registers `rdi,rsi,rdx,rcx,r8,r9`, return in `rax`, the red zone), caller- vs callee-saved registers, the **ELF** format (sections vs segments, symbol table, relocations), static vs dynamic linking, and **PLT/GOT** lazy binding. Plus runtime tricks: `LD_PRELOAD`, `dlopen`/`dlsym`.",
        "Understanding the ABI is what lets you call C from Rust/Python, interpose libraries, and read disassembly fluently.",
      ],
      resources: [
        { label: "System V x86-64 psABI (canonical spec)", url: "https://gitlab.com/x86-psABIs/x86-64-ABI", type: "docs" },
        { label: "Eli Bendersky — Position Independent Code, PLT/GOT", url: "https://eli.thegreenplace.net/2011/11/03/position-independent-code-pic-in-shared-libraries", type: "docs" },
        { label: "CS:APP — Linking chapter (CMU 15-213)", url: "https://www.cs.cmu.edu/~213/", type: "course" },
      ],
      connections: [
        { to: "comp-bytecode", note: "Same System V calling convention a compiler backend must emit" },
        { to: "os-boot", note: "ELF, linker scripts and PLT/GOT reappear in the boot/loader path" },
        { to: "cyber-pwn", note: "ROP chains and PLT/GOT overwrites depend on exactly this layout" },
      ],
    },
    {
      id: "ll-asm",
      title: "x86-64 assembly & SIMD",
      level: "Intermediate",
      body: [
        "Read and write basic asm (`mov`, `lea`, `call/ret`, `cmp/test`, addressing modes, the flags register), recognize compiler `-O2` patterns, and vectorize with **SIMD** (SSE2/AVX2 intrinsics like `_mm256_add_epi32`).",
        "You don't write much assembly by hand anymore, but reading it is non-negotiable for performance work, reverse engineering, and exploitation.",
      ],
      resources: [
        { label: "x86-64 Assembly — CS:APP Machine-Level (CMU 15-213)", url: "https://www.cs.cmu.edu/~213/", type: "course" },
        { label: "Intel Intrinsics Guide (SIMD reference)", url: "https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html", type: "docs" },
        { label: "Felix Cloutier — x86 instruction reference", url: "https://www.felixcloutier.com/x86/", type: "docs" },
      ],
      connections: [
        { to: "cyber-re", note: "Reverse engineering IS reading disassembly and recognizing control flow" },
        { to: "web3-evm", note: "The EVM is a stack machine; reading its opcodes uses the same skill" },
        { to: "ai-math", note: "SIMD vectorization is the CPU analogue of GPU SIMT parallelism" },
      ],
    },
    {
      id: "ll-cache",
      title: "Memory performance & cache",
      level: "Intermediate → Advanced",
      body: [
        "The **cache hierarchy** (L1/L2/L3 latency, 64-byte lines, prefetching), cache-friendly layouts (**SoA vs AoS**, **false sharing**), bandwidth vs latency, TLB/huge pages, and profiling with `perf stat`/`perf mem`/cachegrind.",
        "This is where 'why is my correct program slow?' gets answered. The data-layout lessons here are the same ones that make GPU kernels and game engines fast.",
      ],
      resources: [
        { label: "What Every Programmer Should Know About Memory — Drepper (PDF)", url: "https://people.freebsd.org/~lstewart/articles/cpumemory.pdf", type: "paper" },
        { label: "Algorithmica — HPC / cache chapters (free)", url: "https://en.algorithmica.org/hpc/", type: "book", note: "superb modern perf book" },
        { label: "Brendan Gregg — perf examples", url: "https://www.brendangregg.com/perf.html", type: "docs" },
      ],
      connections: [
        { to: "dsa-linear", note: "This is the rigorous version of 'arrays beat linked lists'" },
        { to: "game-ecs", note: "ECS exists precisely to get SoA, cache-friendly entity iteration" },
        { to: "gpu-memory", note: "Coalesced GPU access is the same locality principle on a different machine" },
      ],
    },
    {
      id: "ll-concurrency",
      title: "Lock-free concurrency",
      level: "Advanced",
      body: [
        "C11/C++ atomics, **memory ordering** (`relaxed`/`acquire`/`release`/`seq_cst` — what each guarantees), the happens-before/synchronizes-with model, a **Michael-Scott lock-free queue** (CAS loop, ABA + tagged pointers), **hazard pointers**, and **RCU**.",
        "The hardest correctness work in the field. Done right, it's the difference between a system that scales linearly across cores and one that doesn't.",
      ],
      resources: [
        { label: "cppreference — memory_order", url: "https://en.cppreference.com/w/cpp/atomic/memory_order", type: "docs" },
        { label: "Is Parallel Programming Hard? — McKenney (free)", url: "https://mirrors.edge.kernel.org/pub/linux/kernel/people/paulmck/perfbook/perfbook.html", type: "book" },
        { label: "Preshing — lock-free programming", url: "https://preshing.com/20120612/an-introduction-to-lock-free-programming/", type: "docs" },
      ],
      connections: [
        { to: "os-concurrency", note: "Same atomics/CAS/ABA from the OS-primitives side (futex, deadlock)" },
        { to: "quant-hft", note: "Lock-free SPSC queues are mandatory in trading hot paths" },
        { to: "dsa-linear", note: "The lock-free ring buffer / queue you implement here" },
      ],
    },
    {
      id: "ll-network",
      title: "Network programming & async I/O",
      level: "Advanced",
      body: [
        "BSD sockets, TCP internals (3-way handshake, sliding window, congestion control — Reno/CUBIC/BBR), **epoll** (edge vs level triggered), non-blocking I/O and the **C10K problem**, and the modern answer: **io_uring** (zero-copy async, submission/completion rings).",
        "Build an epoll echo server handling 10k+ connections — it's the foundation of every high-performance server you'll touch.",
      ],
      resources: [
        { label: "Beej's Guide to Network Programming (free)", url: "https://beej.us/guide/bgnet/", type: "book" },
        { label: "io_uring — 'Lord of the io_uring' guide", url: "https://unixism.net/loti/", type: "docs" },
        { label: "The C10K problem (classic)", url: "http://www.kegel.com/c10k.html", type: "docs" },
      ],
      connections: [
        { to: "os-foundations", note: "Sockets are file descriptors; this is the OS I/O model in anger" },
        { to: "web-backend", note: "Node's event loop and high-throughput servers are built on epoll/io_uring" },
        { to: "quant-hft", note: "Kernel-bypass market-data feeds start from understanding TCP/epoll limits" },
      ],
    },
    {
      id: "ll-microarch",
      title: "CPU microarchitecture & perf engineering",
      level: "Advanced → Research",
      body: [
        "Pipeline stages, out-of-order execution (ROB, reservation stations), **branch prediction** (TAGE; 15-20 cycle mispredict penalty), speculative execution (Spectre/Meltdown as a *consequence*), and ILP. Then the engineering: Intel **Top-Down methodology**, `llvm-mca`, branchless programming (`cmov`), and **data-oriented design**.",
        "This is the ceiling of single-thread performance and the model you optimize against with profilers.",
      ],
      resources: [
        { label: "Agner Fog — Optimization Manuals (free)", url: "https://www.agner.org/optimize/", type: "book", note: "the CPU-optimization bible" },
        { label: "Algorithmica — pipelining & branch prediction", url: "https://en.algorithmica.org/hpc/pipelining/", type: "book" },
        { label: "MIT 6.172 — Performance Engineering (free)", url: "https://ocw.mit.edu/courses/6-172-performance-engineering-of-software-systems-fall-2018/", type: "course" },
      ],
      connections: [
        { to: "comp-ssa", note: "Compiler optimizations exist to feed this pipeline well" },
        { to: "cyber-research", note: "Spectre/Meltdown are microarchitectural side-channels — hardware security" },
        { to: "game-rendering", note: "Branchless, data-oriented design is core to 60fps engine code" },
      ],
    },
    {
      id: "ll-kernelbypass",
      title: "Kernel-bypass I/O & Rust systems",
      level: "Research",
      body: [
        "When the kernel is the bottleneck: **DPDK** (poll-mode drivers, no interrupts), **XDP** (eBPF at the NIC driver), **RDMA** (bypass the TCP/IP stack entirely), and shared-memory IPC. On the language side, advanced **Rust**: async runtimes (build a mini-Tokio: executor/waker/reactor), `crossbeam`/epoch-based reclamation, and safe lock-free code.",
        "This is the frontier of throughput — line-rate packet processing and microsecond-scale systems.",
      ],
      resources: [
        { label: "DPDK — programmer's guide", url: "https://doc.dpdk.org/guides/prog_guide/", type: "docs" },
        { label: "The Rust Programming Language (free book)", url: "https://doc.rust-lang.org/book/", type: "book" },
        { label: "Tokio internals — building an async runtime", url: "https://tokio.rs/tokio/tutorial", type: "docs" },
      ],
      connections: [
        { to: "ll-rust", note: "Async runtime internals build directly on Rust ownership & Send/Sync" },
        { to: "os-virtualization", note: "XDP/eBPF is the in-kernel side of kernel-bypass" },
        { to: "quant-hft", note: "DPDK/Solarflare OpenOnload are standard in HFT market-data paths" },
      ],
    },
    {
      id: "ll-rust",
      title: "Rust: ownership, unsafe & async",
      level: "Intermediate → Advanced",
      body: [
        "**Ownership and borrowing** (how it eliminates data races and use-after-free at compile time), lifetimes and elision, `unsafe` (raw pointers, FFI, `extern \"C\"`), the `Send`/`Sync` concurrency contracts, and `async`/`await` (futures, `Pin`, the executor model).",
        "Rust is the pragmatic way to write systems code with C's performance and far fewer footguns — and FFI lets you adopt it incrementally.",
      ],
      resources: [
        { label: "The Rust Book (free)", url: "https://doc.rust-lang.org/book/", type: "book" },
        { label: "The Rustonomicon — unsafe & FFI (free)", url: "https://doc.rust-lang.org/nomicon/", type: "book" },
        { label: "Rust Atomics and Locks — Mara Bos (free)", url: "https://marabos.nl/atomics/", type: "book" },
      ],
      connections: [
        { to: "comp-types", note: "The borrow checker is an ownership/effect type system in production" },
        { to: "ll-concurrency", note: "Send/Sync encode the memory-ordering guarantees at the type level" },
        { to: "web3-tooling", note: "Solana, Substrate and many ZK stacks are written in Rust" },
      ],
    },
  ],
});
