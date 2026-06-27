atlasAdd({
  id: "cyber",
  topics: [
    {
      id: "cyber-pwn",
      title: "Binary exploitation (pwn)",
      level: "Intermediate → Advanced",
      body: [
        "Memory-corruption fundamentals: stack buffer overflows, `gdb` with pwndbg/gef, **stack canaries** and their bypasses, **ASLR** + info leaks, **NX/DEP** (why you need **ROP**), gadget hunting with ROPgadget/ropper, and format-string bugs (`%n` arbitrary write).",
        "This is where the C memory model and ABI become weapons. pwn.college is the most thorough free curriculum.",
      ],
      subtopics: [
        {
          title: "Stack Buffer Overflows and Control Flow Hijacking",
          body: [
            "The x86-64 call stack is a LIFO region growing downward in memory. When `foo()` calls `bar()`, the CPU pushes the return address (the address of the instruction after `call bar`) onto the stack, then jumps to `bar`. Inside `bar`, the compiler generates a prologue: `push rbp; mov rbp, rsp; sub rsp, N` - saving the caller's frame pointer and allocating N bytes for local variables. A local array `char buf[64]` lives at a fixed negative offset from `rbp`.",
            "If `strcpy(buf, user_input)` copies more than 64 bytes, it overwrites memory beyond `buf`. The stack layout (high to low address): `[buf][saved rbp][return address][...]`. Overflowing `buf` first corrupts `saved rbp`, then the **return address**. When `bar` returns (`leave; ret`), the CPU pops the corrupted return address into `rip` and jumps there. The attacker controls execution.",
            "Without mitigations, the classic technique is **ret2shellcode**: stuff shellcode into `buf`, compute its address, overwrite the return address to point to it. The shellcode executes with the process's privileges. On 64-bit Linux, a minimal `execve('/bin/sh', NULL, NULL)` shellcode is ~23 bytes. Finding the exact offset to the return address: `cyclic 200` (pwntools) generates a de Bruijn sequence; observe which 8 bytes land in `rip` at the crash; `cyclic -l <value>` gives the offset.",
            "**GDB with pwndbg/gef** is the essential debugging environment. `pwndbg` enhances GDB with heap visualization, register/memory layout on every breakpoint, `checksec` (shows mitigation flags on a binary), `cyclic`/`cyclic -l`, and `rop` (gadget finding). Workflow: `gdb ./vuln`, `checksec`, set a breakpoint at the vulnerable function, `run < <(python3 -c 'print(\"A\"*200)')`, observe which registers are clobbered.",
            "Real-world relevance: even with all modern mitigations, stack overflows recur in embedded systems firmware (which often has no mitigations), parsing code (CVE-2021-3156 `sudo` heap overflow shared the same mental model), and kernel drivers. The skill of 'find the buffer, find the offset, control rip' is foundational to all binary exploitation.",
          ],
          resources: [
            { label: "pwn.college - Program Security", url: "https://pwn.college/program-security/", type: "course" },
            { label: "pwntools Documentation", url: "https://docs.pwntools.com/en/stable/", type: "docs" },
          ],
        },
        {
          title: "Stack Canaries, ASLR, and Information Leaks",
          body: [
            "**Stack canary** (SSP - Stack Smashing Protector): the compiler inserts a random value (the 'canary') between local variables and the saved return address. On function exit, the canary value is checked; if it changed, the program aborts with 'stack smashing detected'. The canary is read from `fs:0x28` (Thread Local Storage, seeded from `/dev/urandom` at process startup). On 64-bit Linux, the canary's LSB is always `\\x00` to stop `printf`-based leaks.",
            "Canary bypass: (1) **Leak the canary** - if a format string or out-of-bounds read exists before the overflow, read the canary value from the stack and include it in the overflow payload; (2) **Brute force (fork-only)** - forking servers (`apache prefork`, CGI scripts) preserve the same canary across fork children because `fork()` copies the parent address space; one byte at a time, 256 guesses each, 256×8=2048 attempts to recover the 8-byte canary; (3) **Overwrite a stack variable, not the canary** - if the target is a function pointer or a variable below the canary, the canary is never touched.",
            "**ASLR (Address Space Layout Randomization)**: the kernel randomizes the base addresses of stack, heap, and shared libraries on each `execve`. On 64-bit Linux with ASLR level 2, the stack has ~47 bits of entropy, shared libraries ~28 bits. This makes `ret2shellcode` impractical - you don't know where shellcode will land. ASLR does NOT randomize position-independent executables unless PIE (Position-Independent Executable) is enabled at compile time; many CTF binaries disable PIE for pedagogy.",
            "**Information leaks** defeat ASLR by revealing a runtime address. Techniques: (1) **Format string `%p` leak** reads a pointer off the stack - if it's a libc address, compute `libc_base = leaked_addr - offset_of_symbol_in_libc` (find offset with `readelf -s /lib/x86_64-linux-gnu/libc.so.6 | grep ' system'`); (2) **Partial overwrite** - on ASLR, only the page offset (lower 12 bits) is deterministic; overwrite only 1-2 bytes of a saved RIP to redirect within the same page/library; (3) **`/proc/self/maps`** - if the application reads arbitrary files (path traversal or SSRF), `/proc/self/maps` reveals all base addresses.",
            "Combined exploit workflow: exploit a format string bug to leak a libc address → compute `libc_base` → use the buffer overflow to build a ROP chain to `system('/bin/sh')` at the now-known libc address. This two-stage pattern (leak then pivot) is the backbone of modern pwn.",
          ],
          resources: [
            { label: "How ASLR Works - Computerphile", url: "https://www.youtube.com/watch?v=TwpbhT-GQlk", type: "video" },
            { label: "Format String Exploitation Tutorial", url: "https://axcheron.github.io/exploit-101-format-strings/", type: "docs" },
          ],
        },
        {
          title: "Return-Oriented Programming (ROP)",
          body: [
            "**NX/DEP (No-Execute/Data Execution Prevention)**: the CPU marks stack and heap pages non-executable via the NX bit in page table entries. The OS (via `mprotect`/`mmap` flags) sets `PROT_EXEC` only on code segments. If `rip` points to the stack, the CPU raises a fault (#PF) - shellcode on the stack no longer executes. This eliminates ret2shellcode.",
            "**ROP (Return-Oriented Programming)** subverts NX by executing existing code in the binary and loaded libraries. A **ROP gadget** is a short instruction sequence ending in `ret` (or a jump) already present in the program. By controlling the stack, an attacker chains gadgets: each gadget executes its few instructions, then `ret` pops the next address from the stack. The stack becomes a **program** of gadget addresses. The CPU executes legitimate code at legitimate (non-executable-flagged) addresses - NX never triggers.",
            "Building a ROP chain to call `system('/bin/sh')`: need to set `rdi = address_of_\"/bin/sh\"` (first argument in x86-64 System V ABI), then `call system`. Find `pop rdi; ret` gadget (loads next stack value into rdi), find the string `/bin/sh` in libc (or pop it somewhere), and the `system` symbol address. Chain: `[padding][pop_rdi_ret][addr_of_binsh][system_addr]`. `ROPgadget --binary /lib/x86_64-linux-gnu/libc.so.6 --rop` finds gadgets.",
            "**ret2libc** is the simplest ROP: redirect execution to `system()` in libc with `/bin/sh` as argument, bypassing NX without a gadget chain. **ret2plt** uses the PLT (Procedure Linkage Table) trampoline to call libc functions via the dynamic linker - useful when PIE is enabled (PLT offset from base is fixed). **ret2csu** exploits the `__libc_csu_init` function present in almost all ELF binaries, which contains gadgets for controlling `rbx`, `rbp`, `r12-r15` - valuable when few gadgets exist in the binary itself.",
            "**RELRO (Relocation Read-Only)**: Full RELRO makes the GOT (Global Offset Table) read-only after dynamic linking - defeating GOT overwrite techniques. Partial RELRO only protects the `.got` section, leaving `.got.plt` writable. **PIE** randomizes the binary's own base address (not just libraries), requiring a PIE leak to know gadget addresses. The full modern mitigation stack: stack canary + NX + ASLR + PIE + Full RELRO forces a two-stage (leak then ROP) exploit with specific gadget requirements.",
          ],
          resources: [
            { label: "ROP Emporium - ROP Challenges", url: "https://ropemporium.com/", type: "practice" },
            { label: "ROPgadget Tool", url: "https://github.com/JonathanSalwan/ROPgadget", type: "tool" },
          ],
        },
        {
          title: "Format String Vulnerabilities",
          body: [
            "`printf(user_input)` instead of `printf(\"%s\", user_input)` is a format string vulnerability. The format string directives (`%d`, `%x`, `%p`, `%s`, `%n`) control how `printf` reads arguments from the stack. When the programmer provides no arguments, `printf` reads whatever is above the format string on the stack - leaking adjacent memory. `%p %p %p %p %p %p %p %p` prints 8 consecutive stack values as pointers, often revealing canary values, saved `rbp`, return addresses, and libc pointers.",
            "`%s` treats the corresponding stack value as a char pointer and dereferences it - attempting to print the string at that address. If the 'argument' is an invalid address, this causes a segfault; if it's a valid pointer into the binary or libc, it reads memory from that location. `%7$s` reads the 7th 'argument' (7th stack slot above the format string) as a pointer and dereferences it - **direct parameter access** syntax, essential for precision exploitation.",
            "**Arbitrary write via `%n`**: `%n` writes the number of characters printed so far into the corresponding argument pointer. `printf(\"%100d%n\", &target)` writes the value 100 into `target`. Combined with direct parameter access: if the format string itself is on the stack (stack-based format string), an attacker can embed an address as bytes in the format string and then reference it: `AAAA%k$n` where k is the parameter offset to the location storing `AAAA`'s address. This writes 4 (number of chars printed) to the address `0x41414141` (AAAA).",
            "Practical arbitrary write: `%<value>c%k$hn` writes a 2-byte value (h modifier = short). By writing in two 2-byte chunks to consecutive addresses (low and high word), an attacker can overwrite any 4-byte (or 8-byte) value in memory. Targets: GOT entries (redirect function calls), saved return addresses on the stack, function pointers in global data. The GOT overwrite is the cleanest: overwrite `printf@got.plt` with `system` - the next `printf(\"/bin/sh\")` call becomes `system(\"/bin/sh\")`.",
            "Modern mitigations: Full RELRO makes GOT read-only, complicating GOT overwrites. `-Wformat-security` compiler flag rejects `printf(user_input)` as a compile-time warning. Fortify Source (`_FORTIFY_SOURCE=2`) adds runtime checks that abort on detected format string exploitation. CTF challenges still use format strings heavily as they test precise stack understanding; real-world occurrences (CVE-2012-0809 sudo, CVE-2006-2451) still appear in legacy code.",
          ],
          resources: [
            { label: "Format String Exploitation - Exploit Education", url: "https://exploit.education/phoenix/format-zero/", type: "practice" },
            { label: "pwntools FmtStr Helper", url: "https://docs.pwntools.com/en/stable/fmtstr.html", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "pwn.college", url: "https://pwn.college/", type: "course" },
        { label: "LiveOverflow Binary Hacking", url: "https://www.youtube.com/c/LiveOverflow", type: "video" },
        { label: "CTF Wiki Pwn", url: "https://ctf-wiki.org/pwn/", type: "docs" },
      ],
      connections: [
        { to: "ll-cmemory", note: "C memory model (stack layout, calling convention, ABI) is the foundation of all pwn" },
        { to: "cyber-heap", note: "Heap exploitation builds directly on these stack/ROP primitives" },
        { to: "comp-frontend", note: "Compiler-generated stack frames, prologues, and calling conventions" },
      ],
    },
  ],
});
