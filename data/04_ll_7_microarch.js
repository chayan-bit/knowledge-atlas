atlasAdd({
  id: "lowlevel",
  topics: [
    {
      id: "ll-microarch",
      title: "CPU microarchitecture & perf engineering",
      level: "Advanced -> Research",
      body: [
        "Pipeline stages, out-of-order execution (ROB, reservation stations), **branch prediction** (TAGE; 15-20 cycle mispredict penalty), speculative execution (Spectre/Meltdown as a *consequence*), and ILP. Then the engineering: Intel **Top-Down methodology**, `llvm-mca`, branchless programming (`cmov`), and **data-oriented design**.",
        "This is the ceiling of single-thread performance and the model you optimize against with profilers.",
      ],
      subtopics: [
        {
          title: "The out-of-order pipeline: ROB, reservation stations, and ILP",
          body: [
            "A modern CPU does not execute instructions sequentially. The **out-of-order (OOO) execution engine** reorders instructions dynamically to maximize utilization of its multiple execution units. The pipeline is: fetch -> decode -> rename -> dispatch -> execute (out of order) -> retire (in order). The critical components are the **Reorder Buffer (ROB)** and the **Reservation Stations (RS)**.",
            "The **ROB** is a circular buffer that holds all in-flight instructions in program order. Decoded instructions are allocated an ROB entry at the rename stage and freed when they **retire** (commit their results to architectural state, in order). The ROB holds 200-300 entries on recent Intel/AMD CPUs - this is the 'instruction window': the CPU can look up to 200-300 instructions ahead, find independent ones, and execute them early. An instruction retires only after all preceding instructions have retired (in order), ensuring that exceptions and interrupts are handled at the correct program point.",
            "**Reservation stations** are the scheduler's waiting room: an instruction dispatched to a RS waits there until all its input operands are ready (produced by preceding instructions), then it is issued to an execution unit. This is **dynamic scheduling**. There are typically 5-6 different execution ports (arithmetic, load, store, branch, etc.), each with its own queue. The CPU issues up to 4-6 instructions per cycle to different ports, achieving **ILP (Instruction-Level Parallelism)**. ILP is the number of instructions that execute simultaneously - limited by data dependencies (a chain `a = f(x); b = f(a); c = f(b)` has zero ILP, each must wait for the previous), resource availability (only 2 integer multiply units), and the instruction window size.",
            "**Register renaming** eliminates false dependencies. The compiler outputs `mov eax, [a]; add eax, 1; mov eax, [b]; add eax, 2` - the second `add eax` appears to depend on the first (both use `eax`), but this is just name reuse, not a true data dependency. The rename stage maps each architectural register to a fresh physical register from a large file (180-256 entries), eliminating the false dependency and allowing both add operations to proceed in parallel. This is **Static Single Assignment (SSA)** at the hardware level - the same transformation that compilers do for optimization.",
            "**Execution units and throughput vs latency**: each instruction has both a **latency** (cycles until its result is available to dependent instructions) and a **throughput** (how often one can be issued per cycle). `ADD` has latency 1, throughput 1/4 (can issue 4 per cycle). `IMUL` (32-bit) has latency 3, throughput 1. `IDIV` (64-bit) has latency 20-90 cycles (!), throughput much less. A loop body dominated by a single `IMUL` may be limited not by throughput (you can issue 1 per cycle) but by the dependency chain through the induction variable. Breaking the dependency - e.g., unrolling and using two accumulators - allows two independent `IMUL` chains to interleave, hiding the latency.",
          ],
          resources: [
            { label: "Agner Fog - microarchitecture.pdf (the definitive CPU internals reference)", url: "https://www.agner.org/optimize/microarchitecture.pdf", type: "book" },
            { label: "MIT 6.172 - lec 13 performance engineering, pipeline and ILP", url: "https://ocw.mit.edu/courses/6-172-performance-engineering-of-software-systems-fall-2018/", type: "course" },
          ],
        },
        {
          title: "Branch prediction: TAGE, mispredict penalty, and branchless code",
          body: [
            "Branch prediction is the mechanism that allows an OOO CPU to speculatively execute past a conditional branch before knowing the branch outcome. Without prediction, the CPU would stall for 15-20 cycles at every branch (waiting for the branch condition to resolve and the branch target to be computed). With prediction, those cycles are used for speculative work - which is correct ~99% of the time in well-predicted code. A **misprediction** costs the full 15-20 cycles: all speculatively executed instructions must be squashed and re-fetched from the correct path.",
            "Modern CPUs use sophisticated prediction algorithms. The dominant design is **TAGE (TAgged GEometric history)**, used in Intel Skylake and later, AMD Zen, and ARM Cortex-A. TAGE uses multiple predictor tables, each indexed by a different length suffix of the global branch history (e.g., last 4 branches, last 8 branches, ..., last 64 branches), tagged with the remainder of the history to avoid aliasing. The prediction with the longest matching history wins. TAGE achieves >99.5% accuracy on most integer workloads. The branches it consistently mispredicts: data-dependent branches (e.g., a binary search over random data), 50/50 random branches, and branches with period > 64 (too long for the history table).",
            "The **branch misprediction penalty** on modern CPUs is 15-20 cycles. In a tight inner loop running at 4 cycles per iteration (1 GHz throughput), a 1% misprediction rate adds 15 * 0.01 = 0.15 cycles per iteration - insignificant. But in a 3-cycle loop with 50% misprediction (e.g., sorting with random comparisons), the penalty is 15 * 0.5 = 7.5 cycles per iteration - 2.5x slowdown. The rule: optimize branch prediction only when `perf stat -e branch-misses` shows a significant misprediction rate in the hot loop.",
            "**Branchless programming** eliminates branches by expressing conditions as arithmetic. The compiler often does this automatically (conditional moves, `cmov`), but sometimes manual transformation is needed. Classic: replace `if (a < b) x = a; else x = b;` with `x = (a < b) ? a : b;` - the compiler generates `cmov` (conditional move), which is a single instruction with no branch. More complex: `result += (condition) * value;` - computes both paths and masks with 0 or 1 (valid when both sides have no side effects). Branchless sorting networks (used in SIMD sort) achieve higher throughput than comparison-based sort with branches despite doing more comparisons, because zero mispredictions outweigh extra work.",
            "When branchless is wrong: `cmov` has a dependency on both input operands and the condition. If computing the 'not taken' path is expensive (null pointer dereference, function call with side effects, or long latency chain), branchless is worse than a well-predicted branch. Profile before transforming: the misprediction rate (from `perf stat`) tells you whether a branch is worth eliminating. A branch predicted >95% correctly should almost never be replaced with branchless code.",
          ],
          resources: [
            { label: "Algorithmica - branch prediction and branchless programming", url: "https://en.algorithmica.org/hpc/pipelining/", type: "book" },
            { label: "Agner Fog - Optimizing Software in C++ (optimization manual)", url: "https://www.agner.org/optimize/optimizing_cpp.pdf", type: "book" },
          ],
        },
        {
          title: "Speculative execution: Spectre, Meltdown, and microarchitectural side channels",
          body: [
            "Spectre (January 2018, CVE-2017-5753, CVE-2017-5715) and Meltdown (CVE-2017-5754) are the direct consequences of speculative execution and out-of-order execution interacting with the cache in a way that violates process isolation. Understanding them is not just security knowledge - it is the deepest demonstration of how microarchitectural optimizations have architectural (and security) consequences.",
            "**Meltdown** exploits the fact that out-of-order execution can speculatively execute a memory load from a privileged (kernel) address before the CPU checks whether the access is permitted. The access check fails and raises an exception, but the speculative load has already fetched the kernel data into the cache. The attacker then uses a **cache side channel** (Flush+Reload or Prime+Probe) to infer which cache line was loaded. The CPU's exception prevents the direct register value from being used, but the cache state is an architectural side effect that persists. Meltdown allows a userspace process to read arbitrary kernel memory on affected Intel CPUs. Mitigated by KPTI (Kernel Page Table Isolation), which unmaps the kernel from user-space page tables, preventing the speculative load from even reaching the TLB. KPTI costs 5-30% performance on syscall-heavy workloads.",
            "**Spectre** is harder to mitigate. It exploits **indirect branch prediction** (the CPU's prediction for where an indirect branch will go). An attacker trains the branch predictor to mispredict a victim process's indirect branch to a 'gadget' - a fragment of the victim's code that loads from an attacker-controlled address. The speculative execution of the gadget loads the secret data into the cache; Flush+Reload reveals it. Spectre variant 1 (bounds check bypass) is mitigated with `LFENCE` barriers that serialize speculative execution. Variant 2 (branch target injection) requires either Retpoline (replaces indirect jumps with a return loop that the predictor cannot speculatively target) or microcode-based IBRS (Indirect Branch Restricted Speculation). Retpoline has 0-5% overhead; IBRS has 10-30% overhead on older CPUs.",
            "The general class of **microarchitectural side channels** is now an active research area. Every shared hardware resource (cache, TLB, branch predictor, store buffer, execution ports, prefetcher) is a potential side channel if two security domains share the same core. MDS attacks (Fallout, RIDL, ZombieLoad, 2019) use the store buffer and load ports. ÆPIC Leak (2022) uses the APIC MMIO register region. Prefetch attacks use the data prefetcher. The lesson: any optimization that involves a resource shared between security domains is a potential side channel, and the history of Spectre/Meltdown variants will continue as researchers find new shared resources.",
          ],
          resources: [
            { label: "Spectre paper - Kocher et al. (the original, readable)", url: "https://spectreattack.com/spectre.pdf", type: "paper" },
            { label: "Meltdown paper - Lipp et al.", url: "https://meltdownattack.com/meltdown.pdf", type: "paper" },
          ],
        },
        {
          title: "Intel Top-Down analysis and llvm-mca",
          body: [
            "The **Intel Top-Down Microarchitecture Analysis (TMA)** methodology (Yasin, 2014) gives a structured way to find which microarchitectural resource limits performance. Instead of guessing, you hierarchically allocate cycles to one of four top-level buckets: **Frontend-bound** (the decoder cannot supply enough instructions - due to I-cache misses, branch mispredictions, or decode bottlenecks), **Backend-bound** (execution units or memory are the bottleneck), **Bad Speculation** (cycles wasted due to branch mispredictions or machine clears), and **Retiring** (cycles doing useful work). Within Backend-bound: **Memory-bound** vs **Core-bound** (execution unit bottleneck).",
            "TMA is implemented in `perf stat` via the `topdown` events group: `perf stat -M TopdownL1 ./prog` (Linux perf) or Intel VTune. The output tells you which bucket dominates. If Frontend-bound: look at I-cache misses and code size. If Memory-bound: look at cache misses, TLB misses, bandwidth. If Core-bound: look at port utilization and dependency chains. If Bad Speculation: look at branch mispredict rate. The methodology eliminates the trial-and-error approach to microarchitectural optimization.",
            "**`llvm-mca`** (LLVM Machine Code Analyzer) is a static analysis tool that models instruction throughput and resource pressure on a given CPU microarchitecture, without running the code. Input: a snippet of assembly (or the assembly output of a loop). Output: per-instruction latency/throughput analysis, timeline view, port pressure, and bottleneck identification. It is invaluable for tight inner loops: paste the loop's assembly, select the target CPU (e.g., `skylake`, `znver3`), and immediately see whether the bottleneck is a load port, the multiply unit, or a dependency chain - without needing the actual hardware or a representative dataset.",
            "**Data-oriented design (DOD)** is the programming paradigm that emerges from taking microarchitecture seriously. DOD starts with data (what are the memory layouts? what are the access patterns?) rather than with objects and methods. The canonical talk is Mike Acton's 'Data-Oriented Design and C++' (CppCon 2014): the three lies of OOP (the world is not objects, code does not matter, performance is not important). DOD's concrete practices: prefer arrays over linked structures (cache lines, no pointer chasing), separate hot from cold data (the fields accessed every frame from those accessed occasionally), use SoA over AoS for bulk processing, and represent 'absence' as a separate array (sparse bitset) rather than a flag field in every object. These are the same practices that make ECS (Entity Component System) fast in game engines and column stores fast in databases.",
          ],
          resources: [
            { label: "Agner Fog - Optimization Manuals (free, the CPU optimization bible)", url: "https://www.agner.org/optimize/", type: "book", note: "cpu optimization bible" },
            { label: "MIT 6.172 - Performance Engineering of Software Systems (free)", url: "https://ocw.mit.edu/courses/6-172-performance-engineering-of-software-systems-fall-2018/", type: "course" },
          ],
        },
      ],
      resources: [
        { label: "Agner Fog - Optimization Manuals (free)", url: "https://www.agner.org/optimize/", type: "book", note: "the CPU-optimization bible" },
        { label: "Algorithmica - pipelining & branch prediction", url: "https://en.algorithmica.org/hpc/pipelining/", type: "book" },
        { label: "MIT 6.172 - Performance Engineering (free)", url: "https://ocw.mit.edu/courses/6-172-performance-engineering-of-software-systems-fall-2018/", type: "course" },
      ],
      connections: [
        { to: "comp-ssa", note: "Compiler optimizations exist to feed this pipeline well" },
        { to: "cyber-research", note: "Spectre/Meltdown are microarchitectural side-channels - hardware security" },
        { to: "game-rendering", note: "Branchless, data-oriented design is core to 60fps engine code" },
      ],
    },
  ],
});
