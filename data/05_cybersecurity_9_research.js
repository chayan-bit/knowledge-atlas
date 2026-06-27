atlasAdd({
  id: "cyber",
  topics: [
    {
      id: "cyber-research",
      title: "Vulnerability research, fuzzing & symbolic execution",
      level: "Research",
      body: [
        "The frontier: coverage-guided **fuzzing** (AFL++, libFuzzer, structure-aware), **symbolic/concolic execution** (angr) for automated bug discovery, browser exploitation (V8 JIT type confusion, sandbox escape), hardware side-channels, and formal protocol verification (ProVerif/Tamarin).",
        "This is how 0-days are found systematically rather than by luck.",
      ],
      subtopics: [
        {
          title: "Coverage-Guided Fuzzing with AFL++ and libFuzzer",
          body: [
            "**Fuzzing** generates mutated inputs and feeds them to a program, watching for crashes (memory safety violations, assertion failures, sanitizer reports). **Coverage-guided fuzzing** instruments the binary at compile time to track which code paths each input exercises. When a mutated input reaches a new basic block (not seen before), it's added to the corpus as an 'interesting' input for further mutation. This feedback loop guides the fuzzer toward unexplored code without the randomness of blind fuzzing.",
            "**AFL++ (American Fuzzy Lop++)** is the dominant open-source coverage-guided fuzzer. Workflow: (1) Compile target with AFL++ instrumentation (`afl-clang-fast++ target.cpp -o target`); (2) Prepare a seed corpus of valid inputs (`mkdir seeds && echo 'test' > seeds/1`); (3) Run: `afl-fuzz -i seeds -o findings -- ./target @@`. AFL++ mutates inputs (bit flips, byte substitutions, dictionary splice, havoc stage with random combinations) and tracks coverage. The `findings/crashes/` directory accumulates inputs that caused crashes - each is a potential vulnerability.",
            "**libFuzzer** (LLVM) is library-based: instead of fuzzing a full binary, you write a **fuzz target** function `LLVMFuzzerTestOneInput(const uint8_t *Data, size_t Size)` that parses `Data` using the library under test. libFuzzer runs this function in-process (no fork overhead), making it ~100x faster than AFL for some targets. Integration with **AddressSanitizer (ASan)** (`-fsanitize=address,undefined`) detects heap overflows, UAF, use-of-uninitialized-memory, and UB that wouldn't cause an immediate crash - dramatically increasing bug detection sensitivity.",
            "**Structure-aware fuzzing** defeats the limitation that naive byte mutation rarely produces valid inputs for complex parsers (image formats, PDF, network protocols). Techniques: (1) **Grammar-based generation** (AFL++'s `afl-cmin`, `grammarinator`): define the input grammar (BNF, protobuf), generate valid-structure inputs with random content; (2) **Corpus distillation**: minimize a large corpus to the smallest set that maintains coverage; (3) **Custom mutators**: AFL++ supports shared-library custom mutators (`afl_custom_mutator()`) that understand the input format; (4) **Protobuf-based fuzzing** (libprotobuf-mutator): test protocol implementations by fuzzing protobuf-serialized messages directly.",
            "**Fuzzing at scale**: Google's **OSS-Fuzz** runs continuous fuzzing of 1000+ open-source projects on Google's infrastructure, using both AFL++ and libFuzzer. Found 10,000+ vulnerabilities since 2016. **ClusterFuzz** is Google's distributed fuzzing infrastructure. The key metric is **edges per second** (coverage-weighted throughput). Optimization: `afl-cmin` minimizes corpus to remove inputs that don't add coverage; persistent mode (`AFL_LOOP`) keeps the target in-process across inputs, removing fork() overhead; AFL++ CMPLOG mode instruments comparison instructions to generate inputs that satisfy specific byte equality checks.",
          ],
          resources: [
            { label: "AFL++ GitHub and Documentation", url: "https://github.com/AFLplusplus/AFLplusplus", type: "tool" },
            { label: "libFuzzer Tutorial - LLVM", url: "https://llvm.org/docs/LibFuzzer.html", type: "docs" },
            { label: "OSS-Fuzz - Continuous Fuzzing for Open Source", url: "https://github.com/google/oss-fuzz", type: "repo" },
          ],
        },
        {
          title: "Symbolic and Concolic Execution with angr",
          body: [
            "**Symbolic execution** treats program inputs as symbolic variables (mathematical unknowns) rather than concrete values. The engine tracks a **path condition** - a conjunction of constraints that must hold for execution to reach the current point. At each conditional branch (`if (x > 5)`), the engine forks two states: one adding constraint `x > 5` (true branch) and one adding `x <= 5` (false branch). At a target (crash site, assert, `win()` function), the engine calls an SMT solver (Z3) to find concrete values satisfying the accumulated constraints - producing an input that triggers the target.",
            "**angr** is the dominant Python-based binary analysis framework with symbolic execution. Core API: `proj = angr.Project('./binary')`, `state = proj.factory.entry_state()`, `simgr = proj.factory.simgr(state)`, `simgr.explore(find=0x401234, avoid=0x401100)` - explores execution paths until it finds states that reach address `0x401234` while avoiding `0x401100`. `found_state.posix.stdin.concretize()` returns the concrete input bytes. Used heavily in CTF to automatically solve license key challenges, maze problems, and complex input-dependent paths.",
            "**Path explosion** is the fundamental limitation: branching doubles the number of states. A program with 100 independent if-statements has 2^100 paths - infeasible to enumerate. Mitigations: (1) **Concolic execution** (concrete + symbolic) runs the program concretely with a real input, collecting the path constraints for that execution, then queries the SMT solver for inputs that would take a different branch at each decision point; (2) **Veritesting** hybridizes symbolic and concrete execution at loop boundaries; (3) **Pruning**: merge states that differ only in symbolic memory (summarization), use heuristics to prefer states closer to targets; (4) **Taint analysis** first identifies which input bytes influence a target condition, then apply symbolic execution only to those bytes.",
            "**angr for vulnerability research**: `angr` can detect when a state reaches a `win()` function (for CTF), or more generally when symbolic memory constraints indicate a dangerous state (a symbolic value flowing into a `malloc()` size or `memcpy()` destination). Combined with CFG recovery (`proj.analyses.CFGFast()`), angr builds a call graph and data-flow summaries of a binary without running it. **Vulnerability finding**: constrain the symbolic inputs to cause `[rbp-0x8]` to contain an attacker-controlled value, then query for satisfying inputs.",
            "**SAGE (Microsoft)** and **KLEE** are production symbolic execution tools. KLEE (LLVM-based) operates on LLVM bitcode, enabling deeper analysis with better coverage than binary-level analysis. SAGE powered a decade of Microsoft's internal product fuzzing by using concolic execution to generate inputs that cover new code paths from existing test suites. The hybrid approach - AFL++ for broad coverage at high speed, angr/KLEE for targeted constraint solving to reach deep paths - is the state-of-the-art for industrial vulnerability research.",
          ],
          resources: [
            { label: "angr Documentation", url: "https://docs.angr.io/", type: "docs" },
            { label: "KLEE Symbolic Execution Engine", url: "https://klee-se.org/", type: "tool" },
            { label: "angr CTF Solutions (GitHub)", url: "https://github.com/jakespringer/angr_ctf", type: "repo" },
          ],
        },
        {
          title: "Browser Exploitation: V8 JIT and Sandbox Escape",
          body: [
            "Modern browsers are among the most complex and security-sensitive software. The attack surface is enormous: HTML/CSS parsing, JavaScript JIT compilation, WebGL/WebGPU, WebAssembly, network protocols, media decoders. The security model is **sandboxing**: the renderer process (running page JS) is sandboxed with OS mechanisms (Seccomp-BPF on Linux, AppContainer on Windows) and can only communicate with the privileged browser process via a restricted IPC channel. A full browser compromise typically requires two vulnerabilities: a **renderer bug** (code execution in the sandbox) plus a **sandbox escape** (IPC vulnerability or kernel exploit to escape the sandbox).",
            "**V8 JIT type confusion** is historically the dominant bug class. V8 (Chrome's JS engine) compiles hot JS functions to native code via a multi-tier JIT (Ignition interpreter → Sparkplug → Maglev → TurboFan). TurboFan performs **speculative optimization**: if a property `x.a` is always observed to be a `Smi` (small integer), TurboFan compiles a version assuming it's always Smi, adding a **deoptimization guard**. A type confusion occurs when TurboFan's type inference believes a value is type A, but at runtime it's type B - if the guard is wrong or missing, the JIT code operates on type B data with type A's layout assumptions, corrupting memory.",
            "**Exploit primitive from type confusion**: V8 represents JS objects as C++ objects with a `Map` (hidden class) pointer describing their layout. A type confusion between `JSObject` (user-controlled data) and `JSFunction` (has a `code` pointer to native code) allows reading the `code` pointer of a function and redirecting it to shellcode. More commonly: type confusion between a `JSTypedArray` and `JSArrayBuffer` - the `TypedArray`'s `backing_store` pointer (interpreted from a data field at a known offset) can be set to any address, enabling arbitrary read/write of the renderer process memory.",
            "**V8 sandbox (2022+)**: Chrome implemented a V8 sandbox that wraps V8's heap in a 1TB reservation. V8 heap pointers are stored as 32-bit offsets from the sandbox base rather than absolute 64-bit pointers. A type confusion that achieves arbitrary write within the V8 heap can't directly write arbitrary kernel pointers - it's confined to the sandbox region. Escaping requires finding a pointer to outside the sandbox (e.g., in `Wasm.Memory`'s base pointer which references an external C++ allocation) and corrupting it. This substantially raises the bar for V8 exploitation.",
            "**Sandbox escape techniques**: the browser IPC surface (Mojo in Chrome) exposes hundreds of interfaces from the sandboxed renderer to the privileged browser process. Each interface is a potential sandbox escape: send a malformed IPC message that causes a buffer overflow, UAF, or type confusion in the browser process. **GPU process** exploitation: the GPU process (less sandboxed, needs GPU access) processes WebGL commands; CVE-2022-1096 (Chrome zero-day, exploited in the wild) was a V8 type confusion; CVE-2021-21166 was a UAF in the browser process's audio component triggered via IPC from the renderer.",
          ],
          resources: [
            { label: "Chrome V8 Exploits - GitHub Awesome", url: "https://github.com/nicowillis/awesome-browser-security", type: "repo" },
            { label: "V8 Exploitation - Project Zero Blog", url: "https://googleprojectzero.blogspot.com/", type: "docs" },
          ],
        },
        {
          title: "Hardware Side-Channel Attacks: Spectre and Meltdown",
          body: [
            "**Side-channel attacks** exploit physical or micro-architectural properties of hardware rather than logical flaws in software. The CPU is a physical system with timing, power, electromagnetic emissions, and acoustic signatures that leak information about computation. **Cache timing** is the most exploited: cache hits (data already in L1/L2) complete in ~4 cycles; cache misses (fetching from RAM) take ~200 cycles. An attacker who can time memory accesses can determine whether a specific cache line is hot or cold - recovering which addresses were recently accessed by a victim process.",
            "**Meltdown (CVE-2017-5754)**: exploits out-of-order execution to read kernel memory from user space. The CPU speculatively executes instructions before completing security checks. Attacker code: (1) speculatively reads `kernel_memory[offset]`; (2) uses the byte value to index a user-space array: `probe_array[secret_byte * 4096]`. The security check then raises #PF and rolls back the speculative read - but the cache line at `probe_array[secret_byte * 4096]` remains cached. A timing probe of all 256 cache lines reveals which index was accessed, recovering `secret_byte`. Mitigated by **KPTI (Kernel Page Table Isolation)**: separates kernel and user page tables, incurring a TLB flush on every syscall.",
            "**Spectre (CVE-2017-5753, 5715)**: trains the CPU's branch predictor to speculatively execute an out-of-bounds array access. The attacker mistrain the branch predictor on the pattern `if (x < array.length) access(array[x])` by calling with valid x many times. Then call with `x = secret_offset` - the branch predictor speculatively executes the access even though `x >= array.length`. The speculative access leaks `array[secret_offset]` via a cache side-channel. Unlike Meltdown, Spectre crosses the **trust boundary** between processes and even within the same process (JIT engines). Mitigation requires **retpoline** (prevents indirect branch speculation), `lfence` barriers, and architecture changes (eIBRS).",
            "**Flush+Reload** is the core cache side-channel technique: (1) Flush a cache line (`clflush`); (2) Wait for the victim to potentially access it; (3) Reload (time the access) - cache hit means the victim accessed it, cache miss means they didn't. This enables recovering AES key bytes (if the victim uses a table-based AES implementation, each encryption access pattern leaks key-dependent byte values), recovering RSA private key bits (timing modular exponentiation), and breaking address-space isolation.",
            "**Rowhammer**: a DRAM-level attack exploiting physical coupling between adjacent memory rows. Repeatedly reading ('hammering') the same DRAM row within a refresh interval causes bit flips in physically adjacent rows. **rowhammer.js** demonstrated bit flipping from JavaScript. **RAMBleed** extends this to reading secret values via differential bit-flip analysis. **Rowhammer for LPE**: flip a bit in a page table entry, changing a user-writable page to map to a kernel page - enabling arbitrary kernel memory write. Mitigated by **Target Row Refresh (TRR)** in LPDDR4+ and ECC memory (detects but doesn't always correct multi-bit flips).",
          ],
          resources: [
            { label: "Spectre and Meltdown Papers", url: "https://spectreattack.com/", type: "paper" },
            { label: "Flush+Reload Attack Paper", url: "https://eprint.iacr.org/2013/448.pdf", type: "paper" },
          ],
        },
        {
          title: "Formal Protocol Verification with ProVerif and Tamarin",
          body: [
            "**Formal verification** applies mathematical proof to security protocols: rather than testing specific attacks, it proves (or disproves) security properties for **all possible adversary strategies** in a defined attacker model. This is the only way to establish that a protocol is secure in principle, before implementation bugs are considered. Significant real-world impact: formal verification found flaws in TLS 1.2, EMV card protocols, Signal, and OAuth - before those protocols were widely deployed.",
            "**Dolev-Yao attacker model**: the standard adversary assumption for symbolic protocol verification. The attacker controls the entire network: can intercept, modify, replay, and inject messages. The attacker cannot break cryptographic primitives (perfect cryptography assumption) - they can't decrypt without the key, can't forge signatures, can't invert hash functions. This is the symbolic model: messages are algebraic terms, encryption is a function that only reverses with the correct key. Computationally sound models (Computational Complexity-based) replace this with probability-based assumptions over actual algorithms.",
            "**ProVerif** verifies cryptographic protocols in the **applied pi calculus**. A protocol is described as concurrent processes communicating over channels; attacker knowledge is modeled as accessible channels. ProVerif proves reachability properties ('can the attacker learn the session key?') and correspondence properties ('if the server completed a session, was there a matching client session?') via resolution-based automated theorem proving. It's fully automatic - no manual proofs needed. Limitation: overapproximates (may report a false attack), works on unbounded sessions but can miss session-specific issues.",
            "**Tamarin** verifier uses a term-rewriting formalism and can verify both **secrecy** and **authentication** properties with **equational theories** (modeling XOR, DH, bilinear pairings). Tamarin found a previously unknown attack on the Signal protocol's double ratchet in a specific multi-device scenario. The **Tamarin prover** requires writing rules as multiset rewriting rules and specifying lemmas in a temporal logic. Unlike ProVerif, Tamarin allows interactive proofs where the automated prover gets stuck - a human can supply lemmas to help it proceed.",
            "**Impact on protocol design**: TLS 1.3's design was formally verified with TLS-Attacker (fuzzing) and miTLS/F* (formal verification) before standardization, making it arguably the most well-analyzed protocol in history. IEEE 802.11 (WPA2/3) formal verification revealed the DRAGONBLOOD attacks on WPA3-SAE before the standard was finalized for wide deployment. The lesson: formally verify before deploying, not after. For implementation-level security (not just protocol-level), use memory-safe languages or apply fuzzing + symbolic execution to the implementation itself.",
          ],
          resources: [
            { label: "ProVerif Tool and Documentation", url: "https://bblanche.gitlabpages.inria.fr/proverif/", type: "tool" },
            { label: "Tamarin Prover", url: "https://tamarin-prover.github.io/", type: "tool" },
            { label: "Security Protocol Verification Course - Cortier", url: "https://www.loria.fr/~cortier/slides/", type: "course" },
          ],
        },
      ],
      resources: [
        { label: "AFL++ Fuzzing Framework", url: "https://github.com/AFLplusplus/AFLplusplus", type: "tool" },
        { label: "Google Project Zero Blog", url: "https://googleprojectzero.blogspot.com/", type: "docs" },
        { label: "The Art of Software Security Assessment (book)", url: "https://www.amazon.com/Software-Security-Assessment-Vulnerabilities-Analysis/dp/0321444426", type: "book" },
      ],
      connections: [
        { to: "cyber-re", note: "Fuzzing and symbolic execution find bugs; RE is needed to understand and exploit them" },
        { to: "cyber-pwn", note: "Fuzzer-found crashes are exploited using the pwn techniques" },
        { to: "crypto-tls", note: "Formal verification is the gold standard for protocol security - TLS 1.3 was formally verified" },
        { to: "ll-concurrency", note: "Hardware side-channels exploit CPU micro-architectural behaviors: speculative execution, cache sharing" },
      ],
    },
  ],
});
