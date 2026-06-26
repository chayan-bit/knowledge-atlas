atlasAdd({
  id: "lowlevel",
  topics: [
    {
      id: "ll-abi",
      title: "ABI, linking & ELF",
      level: "Intermediate",
      body: [
        "The **System V x86-64 ABI** (arg registers `rdi,rsi,rdx,rcx,r8,r9`, return in `rax`, the red zone), caller- vs callee-saved registers, the **ELF** format (sections vs segments, symbol table, relocations), static vs dynamic linking, and **PLT/GOT** lazy binding. Plus runtime tricks: `LD_PRELOAD`, `dlopen`/`dlsym`.",
        "Understanding the ABI is what lets you call C from Rust/Python, interpose libraries, and read disassembly fluently.",
      ],
      subtopics: [
        {
          title: "The System V x86-64 calling convention",
          body: [
            "A **calling convention** is the agreed protocol by which a caller passes arguments to a function and receives results back - agreed between compilers, the OS, and linkers so that code compiled by different tools can interoperate. The **System V AMD64 ABI** (the standard on Linux, macOS, and BSDs for x86-64) specifies this protocol in exact detail, and every C/C++/Rust/Go/... compiler on those platforms follows it for external functions.",
            "**Integer and pointer arguments** are passed in registers in this order: `rdi`, `rsi`, `rdx`, `rcx`, `r8`, `r9`. If there are more than six integer/pointer arguments, the rest are pushed onto the stack in right-to-left order. **Floating-point arguments** go into `xmm0`-`xmm7`. **Return values**: integers and pointers in `rax` (and `rdx` for 128-bit returns); floats in `xmm0`. This register-first convention is why modern function calls are so fast: for functions with six or fewer arguments, no stack writes happen at all during argument passing.",
            "**Caller-saved registers** (also called 'clobbered' or 'volatile'): `rax`, `rcx`, `rdx`, `rsi`, `rdi`, `r8`-`r11`, `xmm0`-`xmm15`. The callee may freely modify these without restoring them. If the caller needs a value across a function call, it must save those registers (push them onto the stack) before the call and restore (pop) them after. **Callee-saved registers**: `rbx`, `rbp`, `r12`-`r15`. The callee must restore these to their original values before returning. This is why you see function prologues that push `rbx`/`r12`/etc. and epilogues that pop them - the function is fulfilling its ABI obligation.",
            "The **red zone** is a 128-byte region *below* the current stack pointer (`rsp`) that the ABI guarantees will not be clobbered by asynchronous events (signals, interrupts) on the normal execution path. Leaf functions (functions that call no other functions) can use this region for temporary storage without adjusting `rsp` - saving the prologue/epilogue overhead of allocating a stack frame. Compilers use this aggressively for small leaf functions. The catch: OS signal handlers and debugger breakpoints violate the guarantee (signals use the red zone area), so signal handler stacks and interrupt handlers must use `-mno-red-zone`.",
            "The **stack alignment requirement**: the stack pointer must be 16-byte aligned *at the point of the `call` instruction*. A `call` pushes the 8-byte return address, leaving `rsp` at (16n - 8). The callee's prologue typically adjusts `rsp` to realign. This requirement comes from SSE/AVX instructions that need 16-byte-aligned memory operands - violating it causes a segfault on the first SIMD load/store. When writing assembly stubs or JIT code, forgetting alignment is the first bug you will hit.",
          ],
          resources: [
            { label: "System V AMD64 ABI specification (the primary document)", url: "https://gitlab.com/x86-psABIs/x86-64-ABI", type: "docs" },
            { label: "CS:APP - Procedure Calls and the ABI (CMU 15-213)", url: "https://www.cs.cmu.edu/~213/", type: "course" },
          ],
        },
        {
          title: "ELF format: sections, segments, symbols, and relocations",
          body: [
            "**ELF (Executable and Linkable Format)** is the binary format for executables, shared libraries, and object files on Linux and most Unix systems. Understanding ELF is understanding how your source code becomes a running process - and it is the foundation for writing linkers, loaders, debuggers, and exploit tools.",
            "An ELF file has two views. The **section view** (used by the linker) divides the file into named sections: `.text` (machine code), `.data` (initialized globals), `.bss` (uninitialized globals, zero-size in the file), `.rodata` (read-only data like string literals and switch jump tables), `.symtab` (symbol table for debugging and linking), `.strtab` (string table for symbol names), `.rel.text` or `.rela.text` (relocation entries). The **segment view** (used by the loader/OS) groups sections into loadable **program headers**: typically one PT_LOAD segment for read-execute (text + rodata) and one for read-write (data + bss). The OS `mmap`s each PT_LOAD segment into the virtual address space with the specified permissions.",
            "The **symbol table** is a list of `(name, value, size, type, binding, section)` entries. `value` is the address (or offset) of the symbol. `type` is STT_FUNC (function), STT_OBJECT (variable), STT_NOTYPE (raw address). `binding` is STB_LOCAL (not visible outside the file), STB_GLOBAL (visible and linkable), or STB_WEAK (visible but overridable). The linker resolves references across object files by matching undefined global symbols in one file with definitions in another. `nm` prints the symbol table; `readelf -s` shows the full entries.",
            "**Relocations** are fixup instructions that the linker applies after deciding final addresses. When the compiler generates an object file, references to external symbols are left as placeholder addresses; a relocation entry records: 'at offset X in section Y, apply fixup of type T using symbol S plus addend A'. The linker, knowing final addresses, applies the formula. Relocation types include R_X86_64_PC32 (PC-relative 32-bit, used for calls to nearby functions), R_X86_64_PLT32 (call via PLT, for dynamic symbols), R_X86_64_64 (absolute 64-bit address). `objdump -r` shows relocation entries in object files. Understanding relocations is essential for writing linker scripts, JIT compilers, and binary patching tools.",
            "`readelf -a` and `objdump -d` are the two essential tools. `readelf` shows the ELF headers, sections, symbols, relocations, and dynamic section in human-readable form. `objdump -d` disassembles the `.text` section, annotating with symbol names. For a deep audit of any binary (security research, reverse engineering, debugging a stripped release binary), these tools plus `nm`, `strings`, and `strace` cover 90% of the investigative surface.",
          ],
          resources: [
            { label: "ELF-64 Object File Format specification", url: "https://uclibc.org/docs/elf-64-gen.pdf", type: "docs" },
            { label: "Eli Bendersky - load-time relocation of shared libraries", url: "https://eli.thegreenplace.net/2011/08/25/load-time-relocation-of-shared-libraries/", type: "docs" },
          ],
        },
        {
          title: "Static vs dynamic linking: tradeoffs and mechanics",
          body: [
            "**Static linking** combines all object files and library archives (`.a` files) into a single self-contained executable at link time. Every symbol reference is resolved by the linker; the resulting binary contains all code it will ever execute. Advantages: no runtime dependency on library versions (deploys cleanly, no 'missing .so' errors), slightly faster at startup (no dynamic linker work), and full link-time optimization (LTO) across all code including library code. Disadvantages: larger binary, and if a library has a security bug, every binary statically linked against it must be recompiled and redeployed.",
            "**Dynamic linking** produces an executable that lists its needed shared libraries (`.so` files) in a PT_DYNAMIC segment, with undefined symbols to be resolved at load time by the **dynamic linker** (`ld.so`). At startup, `ld.so` is mapped into the process, reads the needed libraries, maps them into the address space, and resolves (patches) the undefined symbols by matching them against the libraries' exported symbol tables. Advantages: shared code in memory (50 processes using `libc.so` share one physical copy), libraries can be updated independently (security patches), and smaller per-binary disk usage. Disadvantages: startup overhead, dependency on matching library versions, and the attack surface of the dynamic linker itself.",
            "**PLT/GOT lazy binding** is the mechanism that makes dynamic linking fast at the call site. For each externally-defined function, the compiler generates a call to a stub in the **Procedure Linkage Table (PLT)** rather than directly to the function. The PLT stub jumps through a pointer in the **Global Offset Table (GOT)**. Initially, the GOT entry points back into the PLT (to a resolver stub); on the first call, the resolver asks `ld.so` to find the function's real address and patches the GOT entry to point directly to it. All subsequent calls go through the GOT directly to the function - a single indirect jump at runtime. This lazy resolution means unused library functions are never resolved, reducing startup time.",
            "Security implications of PLT/GOT: because the GOT is a writable table of function pointers, **GOT overwrite** is a classic exploit technique - if you can write an arbitrary address into a GOT entry (via a buffer overflow or format string), all subsequent calls to that function instead call your injected code. Modern mitigations: **RELRO (Relocation Read-Only)** makes the GOT read-only after startup (full RELRO marks it non-writable before `main` runs), and **PIE (Position Independent Executable)** randomizes the base address (ASLR) so the GOT's address is unpredictable. Check a binary's security features with `checksec --file=binary`.",
            "`LD_PRELOAD` is an environment variable that tells `ld.so` to load a specified shared library *before* all others, allowing its symbols to **shadow** same-named symbols in later libraries (including libc). This is used for: debugging (override `malloc` with a tracking version), profiling, security testing (intercept syscalls), and - if set maliciously - preloading a rootkit. `dlopen`/`dlsym` extend this to runtime: `dlopen(path, RTLD_LAZY)` loads a shared library, `dlsym(handle, symbol)` looks up a symbol by name, returning a function pointer or data pointer. This is how plugin architectures and scripting language FFIs work.",
          ],
          resources: [
            { label: "Eli Bendersky - position independent code and the PLT/GOT", url: "https://eli.thegreenplace.net/2011/11/03/position-independent-code-pic-in-shared-libraries", type: "docs" },
            { label: "How the ELF ruined Christmas - symbol preemption deep dive", url: "https://www.macieira.org/blog/2012/01/sorry-for-the-hack/", type: "docs" },
          ],
        },
        {
          title: "Runtime introspection: LD_PRELOAD, dlopen, and dlsym",
          body: [
            "The ability to interpose on library calls at runtime without modifying source is one of the most powerful (and most abused) features of the dynamic linker. It enables live debugging, performance profiling, security testing, and - in adversarial contexts - stealthy code injection. Understanding the mechanism demystifies a wide range of tools: `strace`, `ltrace`, `asan`, `tsan`, and most security hooking frameworks all use variations of this technique.",
            "A minimal `LD_PRELOAD` interposer: create a shared library that defines a function with the same name as a libc function (e.g., `malloc`). At runtime, the dynamic linker resolves `malloc` to your version first. To call the original, use `dlsym(RTLD_NEXT, \"malloc\")` - RTLD_NEXT searches the library load order starting after the current library, finding the next `malloc` (the real one). This is the standard pattern for wrapping: intercept, record/transform/validate, call through. `mallochooks` in glibc and AddressSanitizer's allocator use exactly this.",
            "`dlopen` and `dlsym` implement explicit dynamic loading at any point during program execution, not just at startup. `dlopen(path, flags)` maps the library, resolves its dependencies, and runs its initializers (the `.init_array` section). `RTLD_NOW` resolves all symbols immediately; `RTLD_LAZY` defers to first call. `RTLD_GLOBAL` makes the library's symbols available to later `dlopen` calls (and can cause symbol collisions across plugins). `dlsym(handle, name)` looks up a symbol name in the given library handle. The returned `void *` is cast to the appropriate function pointer type - there is no type-safety here, and casting wrong is UB.",
            "The **hidden/default visibility** mechanism (`__attribute__((visibility(\"hidden\")))`) controls which symbols are exported from a shared library. Default visibility symbols are exported to the dynamic linker's global namespace and can be preempted by `LD_PRELOAD`. Hidden visibility symbols are internal - not exported, not preemptable, and faster to call (no PLT indirection needed, the compiler can use a direct call). Large libraries (libc, libstdc++) mark internal helpers as hidden to prevent external interposition and enable inlining. When you write a shared library for distribution, mark non-API symbols hidden to reduce the exported symbol table and prevent accidental coupling.",
            "Practical uses in systems programming and security: (1) **Memory profiling**: wrap `malloc`/`free` to track allocations, detect leaks, record stack traces. (2) **Fault injection**: randomly make `malloc` fail 1% of the time to test error paths. (3) **Timing attacks in security research**: wrap `memcmp` to make it constant-time. (4) **Rootkit detection**: check whether well-known libc symbols have been preempted (`dlsym(RTLD_DEFAULT, \"malloc\") != dlsym(RTLD_NEXT, \"malloc\")` indicates interposition). (5) **Scripting language FFI**: Python's `ctypes` and Rust's `libloading` use `dlopen`/`dlsym` to call C libraries without a compilation step.",
          ],
          resources: [
            { label: "dlopen(3) and dlsym(3) man pages (Linux)", url: "https://man7.org/linux/man-pages/man3/dlopen.3.html", type: "docs" },
            { label: "LD_PRELOAD tricks - interposing library calls", url: "https://rafalcieslak.wordpress.com/2013/04/02/dynamic-linker-tricks-using-ld_preload-to-cheat-inject-features-and-investigate-programs/", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "System V x86-64 psABI (canonical spec)", url: "https://gitlab.com/x86-psABIs/x86-64-ABI", type: "docs" },
        { label: "Eli Bendersky - Position Independent Code, PLT/GOT", url: "https://eli.thegreenplace.net/2011/11/03/position-independent-code-pic-in-shared-libraries", type: "docs" },
        { label: "CS:APP - Linking chapter (CMU 15-213)", url: "https://www.cs.cmu.edu/~213/", type: "course" },
      ],
      connections: [
        { to: "comp-bytecode", note: "Same System V calling convention a compiler backend must emit" },
        { to: "os-boot", note: "ELF, linker scripts and PLT/GOT reappear in the boot/loader path" },
        { to: "cyber-pwn", note: "ROP chains and PLT/GOT overwrites depend on exactly this layout" },
      ],
    },
  ],
});
