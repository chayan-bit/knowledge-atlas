atlasAdd({
  id: "cyber",
  topics: [
    {
      id: "cyber-kernel",
      title: "Kernel exploitation",
      level: "Advanced",
      body: [
        "Linux kernel attack surface (syscalls, drivers), bug classes (kernel UAF, **TOCTOU** races, integer overflow), techniques (ret2usr, kernel ROP, `commit_creds(prepare_kernel_cred(0))`, `modprobe_path` overwrite, `seq_operations` UAF), and mitigations (SMEP/SMAP, KASLR, kCFI).",
        "You're now exploiting the OS itself - privilege escalation from user to root.",
      ],
      subtopics: [
        {
          title: "Linux Kernel Attack Surface: Syscalls and Drivers",
          body: [
            "The Linux kernel runs at privilege level 0 (Ring 0) while user processes run at Ring 3. The **syscall interface** is the controlled boundary: user code executes `syscall` (x86-64) which traps into the kernel's syscall handler. The syscall number in `rax` selects the handler from `sys_call_table[]`. Each syscall handler must validate all pointer arguments (user-provided pointers can point to kernel memory - this is the TOCTOU/SMEP attack surface). Over 400 syscalls exist; each is potential attack surface.",
            "**Kernel modules (drivers)**: loadable kernel modules extend the kernel without recompilation. Vendor drivers (GPU, NIC, storage) run with full kernel privileges. A bug in a driver is a kernel bug. The sysfs/procfs interfaces (`/sys/`, `/proc/`) expose driver functionality to userspace; character device files (`/dev/`) provide ioctl interfaces. `ioctl` is the primary attack surface for driver exploitation: an attacker calls `open('/dev/target_device')` then `ioctl(fd, COMMAND, buf)` where COMMAND and buf are driver-specific. Type confusion in ioctl parsing is a common bug class.",
            "**Kernel namespaces and containers**: Linux namespaces (user, PID, mount, network, UTS, IPC) enable lightweight virtualization. A **user namespace** allows an unprivileged user to appear as root within the namespace. This was historically a kernel attack surface amplifier: many kernel code paths check `capable(CAP_NET_ADMIN)` but don't account for namespace capabilities, allowing a user-namespace root to exercise capabilities they shouldn't have on the host. `unshare(CLONE_NEWUSER)` being available to unprivileged users (default on Ubuntu, not on Debian) has been a repeated exploit escalation primitive.",
            "**BPF (Berkeley Packet Filter)**: eBPF allows userspace to load bytecode that runs in the kernel for observability and networking. The BPF verifier enforces safety (no infinite loops, bounded memory access), but the verifier itself has been a rich bug source: CVE-2020-8835, CVE-2021-3490, CVE-2021-31440 are all BPF verifier bugs enabling privilege escalation. The pattern: a verifier bug allows loading 'invalid' BPF that the verifier incorrectly marks safe, granting read/write of arbitrary kernel memory from a BPF program.",
            "**Netfilter/networking stack**: the network packet processing path has complex, stateful parsing of many protocols. Netfilter hooks allow registering userspace rules (iptables/nftables) that invoke kernel functions on every packet. CVE-2022-1015 (nftables OOB write, exploited as LPE) and CVE-2022-25636 (nf_tables, PoC LPE) are recent examples. The attack surface is high because network processing is complex, performance-critical (security checks are sometimes relaxed), and accessible to network-adjacent attackers.",
          ],
          resources: [
            { label: "Linux Kernel Exploitation - ptr-yudai", url: "https://github.com/ptr-yudai/ptrlib", type: "tool" },
            { label: "Linux Kernel Exploitation Tutorial - lkmidas", url: "https://lkmidas.github.io/posts/20210123-linux-kernel-pwn-part-1/", type: "docs" },
          ],
        },
        {
          title: "Kernel Bug Classes: UAF, TOCTOU, and Integer Overflow",
          body: [
            "**Kernel UAF (Use-After-Free)**: a kernel object (socket, file descriptor, network namespace) is freed but a reference to it persists. If the freed memory is reallocated to a different object type (type confusion), the stale pointer reads the new object's fields through the old type's layout. In the kernel, objects are allocated from the **SLAB/SLUB allocator** in size-specific caches (`kmem_cache`). UAF exploitation targets objects in the same slab size as the freed object, controlling what gets placed at the freed address.",
            "**`seq_file` / `seq_operations` UAF**: `seq_operations` is a kernel struct containing function pointers (`start`, `next`, `stop`, `show`) used by `/proc` file implementations. Many kernel UAF exploits allocate a freed slab slot with a `seq_operations` struct (by opening a `/proc/self/stat` fd after freeing), then trigger the operation - the corrupted function pointer executes. This struct is in the `kmalloc-32` cache, making it a frequent target for any 32-byte UAF.",
            "**TOCTOU (Time-Of-Check Time-Of-Use) races**: the kernel checks a condition then uses a value, but another thread modifies the value between check and use. Classic example: `copy_from_user` in a syscall copies a user pointer; if the user maps the same virtual page to two different physical pages and rapidly switches which physical page backs the VA between the check and the copy, the kernel's security check sees one value and copies another. **Dirty COW** (CVE-2016-5195) was precisely this: a race in `copy_on_write` allowed writing to read-only memory-mapped files, enabling privilege escalation by overwriting `/etc/passwd` or a setuid binary.",
            "**Integer overflow/truncation**: kernel code mixes 32-bit and 64-bit integer types, creating truncation bugs. `size_t` (64-bit on x86-64) truncated to `int` or `unsigned short` wraps around for large values. `kmalloc(user_controlled_size)` with `size = 0` returns a non-NULL pointer to a 0-byte buffer; subsequent writes overflow it immediately. Multiplication before allocation: `kmalloc(count * element_size)` overflows if count is large enough that the product exceeds `SIZE_MAX`, allocating a tiny buffer while the subsequent copy fills a large one. Linux now uses `array_size()` macro with overflow checking.",
            "**Race condition (double-fetch)**: the kernel reads a user-space value twice, and an attacker changes it between reads. A syscall checks `if (user_len < LIMIT)` then later calls `copy_from_user(buf, user_buf, user_len)` - if user_len is changed between check and copy (from 10 to 4096), the check passes but the copy reads 4096 bytes into a 10-byte buffer. Mitigation: read user values once with `get_user()`, store in local variable, use the local throughout.",
          ],
          resources: [
            { label: "Dirty COW - CVE-2016-5195", url: "https://dirtycow.ninja/", type: "docs" },
            { label: "Kernel UAF Exploitation Techniques", url: "https://blog.exodusintel.com/2022/02/23/kernel-userspace-exploitation/", type: "paper" },
          ],
        },
        {
          title: "ret2usr, Kernel ROP, and commit_creds",
          body: [
            "**ret2usr**: before SMEP (Supervisor Mode Execution Prevention), the kernel ran at ring 0 but could execute any virtual address, including user-space addresses. An exploit could overwrite a kernel function pointer (or return address on the kernel stack) to point to a user-space shellcode function that calls `commit_creds(prepare_kernel_cred(0))` to escalate to root, then returns to kernel-space normally. The attack is simple: write privilege-escalation shellcode in user space, point a corrupted kernel pointer to it.",
            "**`commit_creds(prepare_kernel_cred(0))`** is the canonical kernel privilege escalation primitive. `prepare_kernel_cred(0)` creates a new credential structure with all UIDs/GIDs set to 0 (root) and all capabilities set. `commit_creds(cred)` applies those credentials to the current task (`current->cred = cred`). After this call returns, the current process is root. Finding these symbols: `cat /proc/kallsyms | grep prepare_kernel_cred` (requires root, or KASLR disabled). With KASLR enabled, their addresses must be leaked first.",
            "**SMEP (Supervisor Mode Execution Prevention)**: x86 CPUs (Sandy Bridge+) enforce that ring-0 code cannot execute user-space pages (indicated by the U/S bit in the page table entry). SMEP is enabled by setting bit 20 of CR4. Bypassing SMEP requires keeping execution in kernel space - hence **kernel ROP**. The same ROP concept from user-space pwn applies: chain gadgets from the kernel text segment (mapped executable by definition) to achieve `commit_creds`. Find kernel ROP gadgets: `ROPgadget --binary /proc/kcore` (if accessible) or extract them from the uncompressed `vmlinux` image.",
            "**`modprobe_path` overwrite**: a cleaner privilege escalation that doesn't require a ROP chain to `commit_creds`. `modprobe_path` is a global kernel string variable (default `/sbin/modprobe`) executed by the kernel when an unknown file type is executed (via `call_usermodehelper`). If an exploit achieves arbitrary kernel memory write, overwrite `modprobe_path` with `/tmp/rootme` (a script that executes `cp /bin/bash /tmp/bash; chmod +s /tmp/bash`). Then execute a binary with an unknown magic number - the kernel attempts to load a module for it, running `/tmp/rootme` as root. `cat /proc/kallsyms | grep modprobe_path` gives the address.",
            "**Kernel stack pivoting**: on SMEP-enabled systems, kernel ROP needs the stack pointer to be in kernel space containing the ROP chain. If an overflow only corrupts a return address but not the stack pointer, chain a `mov rsp, [kernel_controlled_data]; ret` gadget to pivot to a fake stack in kernel memory containing the full ROP chain. **SMAP (Supervisor Mode Access Prevention)** additionally prevents the kernel from reading/writing user-space memory without `stac`/`clac` instructions, meaning kernel ROP can't read gadget addresses from user space - the chain must be fully in kernel memory.",
          ],
          resources: [
            { label: "Linux Kernel Exploitation Workshop", url: "https://github.com/invictus1306/Workshop-BSidesBCN2019", type: "repo" },
            { label: "Kernel Pwn Tutorial - Hacking the Linux Kernel", url: "https://lkmidas.github.io/posts/20210205-linux-kernel-pwn-part-3/", type: "docs" },
          ],
        },
        {
          title: "KASLR, SMEP/SMAP, kCFI, and Bypass Techniques",
          body: [
            "**KASLR (Kernel Address Space Layout Randomization)**: the kernel image, modules, and kernel stack are loaded at random virtual addresses on each boot. The randomization is applied to the kernel base at boot time - all kernel symbols maintain their relative offsets. To defeat KASLR, leak any single kernel address at a known offset from the base, then compute `kernel_base = leaked_addr - known_offset`. KASLR entropy on x86-64: ~9 bits for the physical memory offset (512 positions), ~8 bits for KASLR slide (256 positions) - not cryptographically strong by modern standards but practically sufficient.",
            "**KASLR leak techniques**: (1) `/proc/kallsyms` - disabled for non-root by default, but historically world-readable on some distros; (2) `dmesg` - kernel prints addresses in startup messages; controlled by `dmesg_restrict`; (3) **Side-channel via page faults** - probing addresses and observing page fault timing (KASLR sidechannel via prefetch instructions, Spectre variants); (4) Kernel info leaks from uninitialized struct fields in syscall responses (`ioctl`, `setsockopt` returned structs often contain uninitialized padding with kernel addresses); (5) `/sys/kernel/fscaps`, `/proc/net/tcp` - various procfs entries historically leaked kernel addresses.",
            "**SMEP bypass**: (1) **CR4 bit flip** - if the exploit achieves arbitrary kernel write, overwrite the value that gets loaded into CR4 on context switches; or use a kernel gadget `mov cr4, rdi; ret` to clear bit 20; (2) **Native_write_cr4 gadget** - modern kernels pin certain CR4 bits making CR4 writes that clear SMEP/SMAP trigger a fault; (3) **Signal handler** (pre-mitigation) - manipulating the kernel's signal delivery to redirect to user space; (4) **No SMEP needed** - the cleanest modern exploits never return to userspace, executing entirely in kernel via ROP/JOP chains.",
            "**kCFI (Kernel Control Flow Integrity)**: prevents indirect calls/jumps to unexpected targets. Implemented in Linux via Clang's CFI sanitizer (enabled in Android kernels) and later via x86 IBT (Indirect Branch Tracking, CET hardware extension). kCFI checks that an indirect call target is a function of the correct type signature (enforced via type hash). Bypassing kCFI requires finding a **confusion gadget**: a function that kCFI permits but whose code performs the attacker's desired action. Research into kCFI bypass is active; the attack surface is any function with the same type signature as the target.",
            "**Heap hardening (kASAN, SLAB hardening)**: KASAN (Kernel Address SANitizer) instruments kernel memory accesses to detect OOB and UAF in debug builds. Slab freelist randomization (enabled by `CONFIG_SLAB_FREELIST_RANDOM`) randomizes the order of objects in a newly-allocated slab cache, complicating heap feng shui. **CONFIG_INIT_ON_ALLOC_DEFAULT_ON** zero-initializes slab allocations, preventing uninitialized memory leaks. These are gradually being upstreamed as default-on, raising the exploitation cost.",
          ],
          resources: [
            { label: "KASLR is Dead, Long Live KASLR (paper)", url: "https://gruss.cc/files/kaslr-is-dead.pdf", type: "paper" },
            { label: "Linux Kernel Defence Map", url: "https://github.com/a13xp0p0v/linux-kernel-defence-map", type: "repo" },
          ],
        },
      ],
      resources: [
        { label: "Linux Kernel Exploitation - pwn.college", url: "https://pwn.college/", type: "course" },
        { label: "kernel-exploit-factory", url: "https://github.com/xairy/kernel-exploit-factory", type: "repo" },
        { label: "LKE Workshop - lkmidas", url: "https://lkmidas.github.io/", type: "docs" },
      ],
      connections: [
        { to: "cyber-pwn", note: "Kernel exploitation uses the same ROP and memory corruption primitives as userspace pwn" },
        { to: "cyber-heap", note: "SLUB allocator exploitation mirrors glibc heap exploitation" },
        { to: "os-kernel", note: "Kernel internals (process model, memory management) are the prerequisite" },
        { to: "ll-cmemory", note: "Kernel code is C; all C memory model bugs apply at ring 0" },
      ],
    },
  ],
});
