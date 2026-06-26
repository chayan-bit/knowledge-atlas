atlasAdd({
  id: "lowlevel",
  topics: [
    {
      id: "ll-asm",
      title: "x86-64 assembly & SIMD",
      level: "Intermediate",
      body: [
        "Read and write basic asm (`mov`, `lea`, `call/ret`, `cmp/test`, addressing modes, the flags register), recognize compiler `-O2` patterns, and vectorize with **SIMD** (SSE2/AVX2 intrinsics like `_mm256_add_epi32`).",
        "You don't write much assembly by hand anymore, but reading it is non-negotiable for performance work, reverse engineering, and exploitation.",
      ],
      subtopics: [
        {
          title: "x86-64 registers, instructions, and addressing modes",
          body: [
            "x86-64 has 16 general-purpose 64-bit registers: `rax`, `rbx`, `rcx`, `rdx`, `rsi`, `rdi`, `rsp`, `rbp`, and `r8`-`r15`. Each has 32-bit (`eax`, `r8d`), 16-bit (`ax`, `r8w`), and 8-bit (`al`/`ah`, `r8b`) sub-registers aliased to the same physical register. Writing to a 32-bit register (`eax`) zero-extends to the full 64-bit register - a historical design that catches many bugs when porting 32-bit code. Writing to a 16-bit or 8-bit sub-register leaves the upper bits unchanged, which is why you sometimes see `xor eax, eax` instead of `mov eax, 0` to zero a register (the XOR is one byte shorter and avoids a partial-register dependency).",
            "The **RFLAGS register** holds condition codes set by arithmetic operations: `ZF` (zero flag - result was zero), `SF` (sign flag - result was negative), `CF` (carry flag - unsigned overflow or borrow), `OF` (overflow flag - signed overflow), `PF` (parity flag - rarely used). Comparison instructions `cmp a, b` subtract b from a and set flags without storing the result. `test a, b` computes `a AND b` and sets ZF/SF. Conditional jumps (`je`, `jne`, `jl`, `jge`, `jb`, etc.) branch based on flag states. Most programs spend 30-40% of instructions on compare-and-branch.",
            "**Addressing modes** are the ways memory operands can be specified. AT&T syntax: `(%rax)` - indirect (dereference rax); `8(%rax)` - base + displacement (rax+8); `(%rax,%rcx,4)` - base + index*scale + displacement (rax + rcx*4); `array(%rip)` - RIP-relative (for PIC). Intel syntax reverses operand order and uses brackets: `[rax+8]`. The `lea` (load effective address) instruction computes an address *without* dereferencing it - useful for arithmetic: `lea rax, [rax + rax*4]` computes `rax = rax * 5` in one instruction, faster than `imul`.",
            "Core instructions to know fluently: `mov` (copy), `push`/`pop` (stack), `call`/`ret` (function call/return - push/pop return address), `jmp` and conditional jumps, `add`/`sub`/`imul`/`idiv`, `and`/`or`/`xor`/`not`/`shl`/`shr`/`sar` (arithmetic shift right preserves sign), `cmp`/`test`, `movsx`/`movzx` (sign/zero extend), `lea`, `nop`. The instruction encoding is variable-width (1-15 bytes) - `nop` is 1 byte (0x90), `mov rax, [rbx+rcx*8+0x10]` with a 64-bit immediate is 10+ bytes. Disassemblers need to parse this stream from a known boundary (typically a function entry) because parsing backwards is ambiguous.",
            "The compiler's **prologue and epilogue** pattern: a function starts with `push rbp; mov rbp, rsp; sub rsp, N` (save frame pointer, set up new frame, allocate N bytes for locals) and ends with `leave; ret` (`leave` is equivalent to `mov rsp, rbp; pop rbp`). With `-fomit-frame-pointer` (default at -O2), the prologue/epilogue is just `sub rsp, N` / `add rsp, N`, and `rbp` is used as a general-purpose register. This makes stack unwinding harder (debuggers and profilers need frame pointer or DWARF unwind tables) but frees a register for the compiler's use.",
          ],
          resources: [
            { label: "Felix Cloutier - x86 instruction reference (encoding, flags per instruction)", url: "https://www.felixcloutier.com/x86/", type: "docs" },
            { label: "CS:APP - ch. 3 Machine-Level Programming (CMU 15-213 textbook)", url: "https://www.cs.cmu.edu/~213/", type: "course" },
          ],
        },
        {
          title: "Reading compiler output: O2 patterns to recognize",
          body: [
            "Compiler Explorer (godbolt.org) is the essential tool: paste C code on the left, see assembly on the right, instantly, for any compiler and optimization level. The skill of reading assembly is fundamentally pattern recognition - the compiler applies a relatively small set of transformations, and once you have seen each pattern once, you can parse disassembly at a useful rate.",
            "**Inlining** is the most impactful optimization: the compiler replaces a function call with the function body, eliminating the call/ret overhead, register save/restore, and enabling further optimizations across the call boundary. At `-O2`, small functions (under ~20 instructions) are almost always inlined if visible to the compiler. You will not see a `call` instruction for them in the output - their body appears directly at the call site. This is why `static inline` and `__attribute__((always_inline))` exist: they force inlining even for larger functions where the compiler might not.",
            "**Constant folding and propagation**: if all inputs to an expression are compile-time constants, the compiler evaluates it at compile time and emits just a `mov rax, <result>` or even nothing. `printf(\"hello\")` with a constant format string becomes a `puts` call. A loop `for (int i = 0; i < 100; i++) sum += arr[i]` with all values known at compile time may produce just `mov rax, <precomputed_sum>`.",
            "**Loop transformations** are the highest-impact backend optimizations for numerical code. **Unrolling** reduces branch overhead by replicating the loop body N times, advancing the induction variable by N per iteration. **Vectorization** replaces scalar iterations with SIMD instructions processing N elements at once (N=4 for float with AVX, N=8 for short with AVX2). Look for `vmovdqu`, `vpaddd`, `vpcmpeqd` - these are the vectorized memory, add, and compare instructions. If the loop has a dependency between iterations or a conditional break, auto-vectorization often fails and the compiler falls back to scalar. `#pragma omp simd` or manually written intrinsics force it.",
            "**Tail call optimization**: a function that ends with a `return f(args)` (tail call) does not need its own stack frame - it can reuse it and jump to `f` instead of calling it. This turns tail-recursive functions into loops. C compilers do this under `-O2` when the call truly is a tail call. You will see a `jmp` where you expect a `call ret` pair. Rust and functional-language backends rely on this for recursive style without stack overflow. GCC's `__attribute__((optimize(\"O2\")))` or `-foptimize-sibling-calls` controls this explicitly.",
          ],
          resources: [
            { label: "Compiler Explorer (godbolt.org) - paste C and see asm live", url: "https://godbolt.org/", type: "tool" },
            { label: "Algorithmica - compiler optimizations chapter", url: "https://en.algorithmica.org/hpc/compilation/", type: "book" },
          ],
        },
        {
          title: "SIMD: SSE2, AVX2, and writing intrinsics",
          body: [
            "**SIMD (Single Instruction, Multiple Data)** executes one instruction on a vector of values simultaneously. SSE2 (2001, guaranteed on all x86-64 CPUs) has 16 128-bit XMM registers. AVX2 (2013, Haswell and later) has 16 256-bit YMM registers. AVX-512 (2017, server Skylake and later) has 32 512-bit ZMM registers. The width of a SIMD register divided by element size gives the **lane count**: a 256-bit register holds 8 floats (32-bit each) or 4 doubles or 32 bytes.",
            "**Intrinsics** are C/C++ functions that map 1:1 to a SIMD instruction, using special vector types (`__m256i` for 256-bit integer, `__m256` for float, `__m256d` for double). The Intel Intrinsics Guide at intel.com/content/www/us/en/docs/intrinsics-guide/ lists every intrinsic with latency, throughput, and the corresponding instruction. A typical vectorized inner loop: load 8 floats with `_mm256_loadu_ps`, add with `_mm256_add_ps`, store with `_mm256_storeu_ps`. The `u` suffix means unaligned - always use unaligned loads/stores unless you have verified 32-byte alignment, as the performance difference on modern CPUs is negligible and misaligned `_mm256_load_ps` crashes.",
            "**Data layout for SIMD**: the most common bottleneck is that the data is in **AoS (Array of Structs)** layout - `struct Particle { float x, y, z, mass; }` laid out as `xyzm xyzm xyzm...` - but SIMD wants to process 8 x-coordinates at once. The transformation to **SoA (Struct of Arrays)** - separate `float xs[], ys[], zs[], masses[]` - enables efficient SIMD: load 8 xs at once, 8 ys at once, and compute in parallel. ECS game engines and physics simulators use SoA as their fundamental data design principle. The cache locality section (ll-cache) discusses the broader tradeoffs, but for SIMD: AoS = scalar-friendly, SoA = vector-friendly.",
            "**Horizontal operations** (summing all elements within one SIMD register) are much more expensive than vertical operations (processing corresponding elements of two registers). To sum 8 floats in a `__m256`, you need a sequence of shuffle and add operations, often called a 'horizontal reduction'. The lesson: design algorithms to avoid horizontal reductions in the inner loop. Sum accumulators vertically (accumulate 8 partial sums in a `__m256`), then reduce horizontally once at the very end.",
            "**Masked operations and gather/scatter** (AVX-512 and AVX2 respectively): `_mm256_i32gather_ps` loads floats from arbitrary indices (non-contiguous memory), enabling SIMD over pointer-chasing structures. Gather is 3-10x slower than contiguous load due to cache misses - use it when the alternative is scalar but data layout prevents contiguous access. AVX-512's mask registers enable conditional SIMD: process all 16 elements but only write back those where a condition mask is set, eliminating branch mispredictions in conditional loops.",
          ],
          resources: [
            { label: "Intel Intrinsics Guide - latency, throughput, every intrinsic", url: "https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html", type: "docs" },
            { label: "Algorithmica - SIMD chapter (practical, with benchmarks)", url: "https://en.algorithmica.org/hpc/simd/", type: "book" },
          ],
        },
        {
          title: "Inline assembly and compiler barriers",
          body: [
            "**Inline assembly** (`asm volatile` in GCC/Clang) lets you embed assembly instructions directly within C/C++ code. The syntax is: `asm volatile(\"instruction\" : outputs : inputs : clobbers)`. The outputs section specifies which C variables receive written values; inputs which provide input values; clobbers which registers or memory the assembly modifies (informing the compiler to save/restore them). This is how low-level code accesses instructions the C language cannot express: `rdtsc` (read timestamp counter for cycle-accurate timing), `cpuid` (CPU feature detection), `clflush` (cache line flush), `mfence`/`lfence`/`sfence` (memory fences).",
            "The `volatile` qualifier on `asm` is crucial: it prevents the compiler from moving, removing, or deduplicating the assembly block. Without it, the compiler may conclude the block has no side effects and delete it. Similarly, listing `\"memory\"` in the clobber list acts as a **compiler barrier** - it tells the compiler to flush all live variables to memory and reload them after the asm, preventing the compiler from reordering memory accesses across the barrier. This is the C-level half of memory ordering; the hardware level is separate (memory fences).",
            "**Compiler barriers vs hardware barriers**: `asm volatile(\"\" : : : \"memory\")` is a compiler barrier - it prevents the *compiler* from reordering memory accesses across it, but the CPU is still free to reorder them at the hardware level (OOO execution, store buffers). For cross-thread correctness, you need both: a compiler barrier to prevent the compiler from reordering, and a hardware fence (`mfence`, `sfence`, `lfence`) to prevent the CPU. C11/C++11 atomics with appropriate memory orders handle both sides correctly and are preferable to hand-rolling fence instructions.",
            "When inline assembly is necessary (for performance-critical code using CPU-specific features) vs. when it is not: most low-level operations are better expressed as C11 intrinsics or compiler builtins (`__builtin_clz`, `__builtin_popcount`, `__atomic_*`). The compiler knows more about register allocation and scheduling than hand-written asm. Use inline asm only for instructions that have no C equivalent (e.g., `rdtsc`, hardware-specific instructions, or architecturally mandated sequences like the CPUID serialization idiom). For SIMD, always prefer intrinsics over inline asm.",
          ],
          resources: [
            { label: "GCC inline assembly HOWTO (constraint syntax, clobbers)", url: "https://gcc.gnu.org/onlinedocs/gcc/Using-Assembly-Language-with-C.html", type: "docs" },
            { label: "Compiler Explorer - see how asm volatile blocks affect optimization", url: "https://godbolt.org/", type: "tool" },
          ],
        },
      ],
      resources: [
        { label: "x86-64 Assembly - CS:APP Machine-Level (CMU 15-213)", url: "https://www.cs.cmu.edu/~213/", type: "course" },
        { label: "Intel Intrinsics Guide (SIMD reference)", url: "https://www.intel.com/content/www/us/en/docs/intrinsics-guide/index.html", type: "docs" },
        { label: "Felix Cloutier - x86 instruction reference", url: "https://www.felixcloutier.com/x86/", type: "docs" },
      ],
      connections: [
        { to: "cyber-re", note: "Reverse engineering IS reading disassembly and recognizing control flow" },
        { to: "web3-evm", note: "The EVM is a stack machine; reading its opcodes uses the same skill" },
        { to: "ai-math", note: "SIMD vectorization is the CPU analogue of GPU SIMT parallelism" },
      ],
    },
  ],
});
