atlasAdd({
  id: "cyber",
  topics: [
    {
      id: "cyber-re",
      title: "Reverse engineering",
      level: "Intermediate → Advanced",
      body: [
        "x86-64 for RE (recognizing if/else, loops, calls in disassembly), static analysis with **Ghidra**/IDA (decompiler output, xrefs), dynamic analysis with `gdb`/`strace`/`ltrace`/**Frida**, and identifying anti-debug/packing tricks.",
        "RE is the dual of compilation - you run the pipeline backwards from machine code to intent.",
      ],
      subtopics: [
        {
          title: "x86-64 Assembly for Reverse Engineers",
          body: [
            "A reverse engineer reads disassembly as a language. Core vocabulary: **mov** (data transfer), **lea** (load effective address, used for pointer arithmetic), **push/pop** (stack operations), **call/ret** (function call/return), **cmp/test** (set flags without modifying operands), **jz/jnz/jl/jge** (conditional jumps based on flags), **add/sub/imul/idiv** (arithmetic), **and/or/xor/not** (bitwise - XOR with self zeroes a register efficiently). `xor eax, eax` is the canonical register-clearing idiom.",
            "**Calling convention (System V AMD64 ABI)**: first 6 integer/pointer arguments in rdi, rsi, rdx, rcx, r8, r9; return value in rax. Recognizing argument setup before `call` instructions is how you read function parameters. `mov rdi, rax; call printf` - whatever rax held is the format string. Variadic arguments use `al` (number of float arguments) before the call. Stack arguments beyond 6 are pushed right-to-left.",
            "**Pattern recognition**: `cmp [var], 0; jnz loop_body; jmp loop_exit` is a while loop. `cmp i, limit; jge exit` is a for-loop bound check. A switch statement compiles to either a series of comparisons or a **jump table**: `lea rax, [rip+jump_table]; movsxd rdx, [rax+rcx*4]; add rdx, rax; jmp rdx`. The jump table is an array of relative offsets indexed by the switch value - recognizing this pattern is key to understanding dispatch logic in compilers and malware.",
            "**Struct access**: `mov rax, [rbp-0x28]` followed by `mov rdi, [rax+0x10]` - the first loads a pointer (struct *), the second dereferences it at offset 0x10. With IDA/Ghidra, you can define a struct type and apply it, showing `mystruct->field_at_0x10` in the disassembly. **Virtual dispatch** in C++ uses a vtable pointer at offset 0 of the object; `mov rax, [rdi]; call [rax+0x18]` is a virtual call to the third virtual method.",
            "**SIMD/SSE**: modern compilers auto-vectorize loops with `xmm`/`ymm` register operations. `movdqa` (move aligned double quadword, 16 bytes), `pcmpeqb` (compare bytes), `pmovmskb` (create bitmask from MSBs) appear in `strlen`/`memcpy`/`strcmp` optimized implementations and string processing malware. Recognizing these patterns prevents confusion when a 'simple' function has dozens of xmm instructions.",
          ],
          resources: [
            { label: "x86-64 Assembly Language Programming (book)", url: "https://nostarch.com/assembly", type: "book" },
            { label: "Compiler Explorer - See C to ASM", url: "https://godbolt.org/", type: "tool" },
          ],
        },
        {
          title: "Static Analysis with Ghidra and IDA",
          body: [
            "**Ghidra** (NSA, open source) and **IDA Pro** (Hex-Rays, commercial) are the two dominant static analysis platforms. Both disassemble and decompile binary code to C-like pseudocode. Ghidra's decompiler is production-quality and free; IDA's Hexrays decompiler is considered the gold standard for accuracy. Start with Ghidra for CTFs and non-commercial research.",
            "Key Ghidra workflow: (1) Import binary (auto-analysis runs: decompilation, string finding, cross-reference building, entry-point detection); (2) `Defined Strings` window (`Window → Defined Strings`) - find interesting strings (error messages, format strings, URLs, hardcoded credentials); (3) Click a string, `Xrefs` shows which functions reference it; (4) Navigate to that function's decompiled view; (5) Rename variables and functions as you understand them (`L` key renames). Annotation is iterative - each renamed symbol helps understand callers.",
            "**Cross-references (xrefs)** are the backbone of RE analysis. In Ghidra: right-click any address/symbol → Show References → find all callers or callees. For malware: xref the import `CreateRemoteThread` to find where process injection occurs, xref `RegOpenKeyEx` to find persistence mechanisms, xref `WSAConnect` to find C2 communication. The call graph (`Window → Function Call Graph`) visualizes the entire call hierarchy.",
            "**IDA-specific features**: FLIRT (Fast Library Identification and Recognition Technology) automatically identifies and names common library functions in statically-linked binaries. IDAPython enables scripting - automate renaming, pattern searching, decryption of obfuscated strings. `idat` (IDA terminal mode) enables headless scripting. The **Lumina** server syncs function names from IDA's cloud database - a function with the same hash as a known library function gets automatically named.",
            "For stripped binaries (no symbol table): function identification is by signature. The entry point (`_start`) calls `__libc_start_main` with `main` as argument. In GCC-compiled binaries, `main` is often the first function after `_start`'s three pushes. String references and import patterns are your primary navigation aids. **bindiff** (Zynamics, free) performs binary diffing - comparing a patched binary to its original to find exactly which functions changed, invaluable for patch analysis.",
          ],
          resources: [
            { label: "Ghidra - NSA Tool", url: "https://ghidra-sre.org/", type: "tool" },
            { label: "The Ghidra Book (No Starch Press)", url: "https://nostarch.com/GhidraBook", type: "book" },
          ],
        },
        {
          title: "Dynamic Analysis: GDB, strace, ltrace, and Frida",
          body: [
            "**Dynamic analysis** runs the binary under observation, contrasting with static analysis which analyzes code without execution. It reveals runtime behavior that static analysis can't: decrypted strings, network connections, conditional paths taken with actual inputs, and interactions with the OS. The primary tools are debuggers (GDB), syscall tracers (strace), library call tracers (ltrace), and dynamic instrumentation frameworks (Frida, DynamoRIO, Pin).",
            "`strace ./binary` traces every **system call** with arguments and return values. On a malware sample: `openat(AT_FDCWD, \"/etc/cron.d/backdoor\", O_WRONLY|O_CREAT, 0644)` reveals file writes; `connect(3, {AF_INET, 192.168.1.100, 4444})` reveals C2 connections; `execve(\"/bin/sh\", [\"/bin/sh\", \"-c\", \"...\"], ...)` reveals shell commands. `ltrace` intercepts dynamic **library calls** (`malloc(64)`, `strcmp(input, \"hardcoded_password\")`) - invaluable for finding hardcoded values the binary compares against.",
            "**Frida** is a dynamic instrumentation toolkit for black-box analysis. Inject into running processes without source code or recompilation. Frida scripts (JavaScript) hook functions by name or address: `Interceptor.attach(Module.findExportByName(null, 'SSL_write'), { onEnter: function(args) { console.log(hexdump(args[1])); } })` - dumps all data written via SSL, **decrypting TLS at the application layer** before it's encrypted. Essential for mobile app RE (Android/iOS) where static analysis alone misses runtime-generated logic.",
            "**GDB scripting (Python)**: GDB's Python API (`gdb.Breakpoint`, `gdb.Value`, `gdb.Frame`) enables automated analysis. Set a breakpoint on a decryption function, automatically dump the decrypted result, continue: `python gdb.Breakpoint('decrypt_string').commands = 'x/s $rdi\\ncontinue'`. This automates extracting all decrypted strings from a packer without manual stepping. **gef** (`gef.py`) and **pwndbg** bundle quality-of-life enhancements: heap visualization, register tracking, automatic context display.",
            "**Sandbox analysis**: automated dynamic analysis at scale. Cuckoo Sandbox runs a sample in a VM, captures: file system changes, registry modifications, network traffic (PCAP), process tree (parent-child relationships), API call sequence. Output is a JSON report with IOCs (Indicators of Compromise). Online sandboxes: any.run, Hybrid Analysis, VirusTotal (sandboxes samples on upload). Limitations: malware often detects VM environments (VMware artifacts, timing checks, CPUID) and delays execution or changes behavior.",
          ],
          resources: [
            { label: "Frida Dynamic Instrumentation", url: "https://frida.re/docs/", type: "docs" },
            { label: "Practical Malware Analysis (book)", url: "https://nostarch.com/malware", type: "book" },
          ],
        },
        {
          title: "Anti-Analysis Techniques and Packing",
          body: [
            "**Packers** compress and/or encrypt the original executable, wrapping it in a stub that decompresses/decrypts and executes it at runtime. The packed sample's static analysis sees only the stub - the real code is absent until execution. Classic packers: UPX (compression only, trivially unpacked with `upx -d`), MPRESS, Themida (commercial, strong anti-debug). Detecting packing: high section entropy (>7.0 bits/byte), small import table (only `VirtualAlloc`/`LoadLibrary`), mismatched code size vs section sizes.",
            "**Anti-debugging**: the program detects that it's running under a debugger and changes behavior (exits, crashes, takes a different path). Techniques: (1) **`IsDebuggerPresent()` / `NtQueryInformationProcess()`** (Windows) - check the PEB's `BeingDebugged` flag; (2) **Timing checks** - `RDTSC` instruction reads CPU timestamp; a debugged process has large inter-instruction deltas; (3) **`ptrace(PTRACE_TRACEME)`** (Linux) - a process can only be ptrace'd once; calling it yourself prevents debugger attachment; (4) **INT3 detection** - debuggers set breakpoints by replacing bytes with `0xCC` (INT3); reading the original byte at the breakpoint address reveals the modification.",
            "**Anti-VM**: virtual machines have detectable artifacts. Techniques: checking for `CPUID` hypervisor bit (bit 31 of ECX in leaf 1), VMware backdoor I/O port (`in eax, 0x5658` with magic value in eax), registry keys for VMware/VirtualBox drivers, specific DLL names (`vboxhook.dll`), MAC address OUI for VM vendors (08:00:27 = VirtualBox), CPUID vendor string (`VMwareVMware`, `KVMKVMKVM`). Countermeasure: bare-metal analysis environments or VM hardening (spoofing CPUID, hiding artifacts with hypervisor configuration).",
            "**Obfuscation**: beyond packing. **Control flow obfuscation** inserts opaque predicates (always-true/false conditions that complicate analysis), splits basic blocks, adds dead code. **String obfuscation** XORs or rot-N encodes strings at rest, decodes them at runtime just before use. **API hashing** avoids import table entries by computing a hash of API names at runtime and using `GetProcAddress` with the hash result - `CreateFile` doesn't appear in the IAT. **Code virtualization** (Themida, VMProtect) translates x86 instructions to a custom bytecode executed by a VM embedded in the binary - defeating standard disassembly entirely.",
            "**Unpacking workflow**: run the packed binary in a debugger until the original entry point (OEP - Original Entry Point) is reached (the packer's stub jumps there after unpacking). Dump memory at that point with `Process Dump` (Windows) or `dd if=/proc/PID/mem`. Reconstruct the Import Address Table (IAT) with **Scylla** (Windows) or **ImportRec** - the dumped binary needs its IAT rebuilt from the now-resolved runtime addresses. `upx -d` handles standard UPX automatically. For custom packers, recognize the unpacking loop (often a simple XOR decryption loop over a buffer, then a jump to it) and let it run.",
          ],
          resources: [
            { label: "Anti-Analysis Techniques - Malware Unicorn", url: "https://malwareunicorn.org/workshops/re101.html", type: "course" },
            { label: "The Art of Unpacking (paper)", url: "https://www.blackhat.com/presentations/bh-usa-07/Yason/Whitepaper/bh-usa-07-yason-WP.pdf", type: "paper" },
          ],
        },
        {
          title: "Reconstructing High-Level Semantics",
          body: [
            "The goal of RE is not to read every instruction but to reconstruct the programmer's intent at a level high enough to answer the analysis question: 'What does this malware do?', 'Is this binary safe to run?', 'Where is the license check?'. The process is iterative: identify high-level structure (DLL/ELF imports, section names, entry points), then drill into specific functions guided by strings and xrefs, then understand dataflow within those functions.",
            "**Type reconstruction**: decompilers produce C-like output with generic types (`int`, `void *`). Applying the correct struct layout to a void pointer transforms `*(int *)(v1 + 0x10)` into `node->next`. For well-known protocols (PE header, ELF, TLS structures, Windows HANDLE types), import type libraries in IDA or create struct definitions in Ghidra matching the documented layout. For custom types, infer fields from usage: if offset 0 is always passed to `strlen`, it's a `char *`.",
            "**Crypto identification**: many malware samples implement their own crypto (to avoid suspicious imports). **FindCrypt** (IDA plugin) and **Capa** identify crypto by constant tables - the AES S-box, the SHA-256 constants, the DES permutation tables are unique signatures. **RC4** is recognizable by its KSA loop (256 iterations initializing a state array) and PRGA loop (XOR with a state-derived byte). **Custom XOR cipher** is the simplest: a loop XORing bytes with a key of period k, where k is usually a small integer.",
            "**C2 protocol reconstruction**: network-communicating malware has a protocol for command and data exchange. Follow the `send`/`recv` xrefs; the data is often processed through a serialization function (custom or protobuf-like). Find where commands are dispatched (often a switch on a command ID byte) - each case is a capability. Reconstructing the protocol enables writing detectors (IDS signatures, YARA rules) or C2 impersonators for threat intelligence.",
            "**Automated tools**: **Capa** (Mandiant) analyzes a binary and produces a MITRE ATT&CK mapping ('T1055: Process Injection - calls CreateRemoteThread'). **angr** (symbolic execution) can automatically solve simple license checks or find input-dependent paths without manual analysis. **Binary Ninja** has a IL (Intermediate Language) that's more amenable to analysis automation than raw disassembly. The research frontier is ML-assisted decompilation (LLM-based function naming, semantic similarity search) to speed up human analysis.",
          ],
          resources: [
            { label: "Capa - Malware Capability Detector", url: "https://github.com/mandiant/capa", type: "tool" },
            { label: "OpenSecurityTraining2 - Reverse Engineering", url: "https://opensecuritytraining.info/Training.html", type: "course" },
          ],
        },
      ],
      resources: [
        { label: "Ghidra", url: "https://ghidra-sre.org/", type: "tool" },
        { label: "Practical Reverse Engineering (book)", url: "https://www.wiley.com/en-us/Practical+Reverse+Engineering-p-9781118787311", type: "book" },
        { label: "Malware Unicorn Workshops", url: "https://malwareunicorn.org/", type: "course" },
      ],
      connections: [
        { to: "cyber-pwn", note: "RE is prerequisite for pwn - you must understand the disassembly to exploit it" },
        { to: "cyber-malware", note: "Malware analysis is applied RE in a defensive context" },
        { to: "comp-frontend", note: "Understanding compiler output (calling convention, IR lowering) makes RE dramatically faster" },
        { to: "ll-cmemory", note: "C memory model explains struct layouts, pointer arithmetic, and ABI choices visible in disassembly" },
      ],
    },
  ],
});
