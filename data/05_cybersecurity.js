atlasAdd({
  id: "cyber",
  num: 5,
  title: "Cybersecurity",
  icon: "🛡️",
  color: "#f7768e",
  tagline: "From networking basics to exploit development, malware analysis, and red teaming.",
  overview: [
    "Security is adversarial systems thinking: you can't break (or defend) what you don't understand at the level below the abstraction. That's why this domain is the great integrator — web security needs HTTP/databases, binary exploitation needs the C memory model and ABI, kernel exploitation needs OS internals, and crypto attacks need number theory.",
    "Learn it offensively *and* ethically: stand up labs, solve CTFs, and always operate with permission. The milestone path runs web → binary/pwn → reverse engineering → heap/kernel → AD/red-team, with research-grade fuzzing and symbolic execution at the top.",
  ],
  topics: [
    {
      id: "cyber-foundations",
      title: "Networking, TLS & Linux foundations",
      level: "Beginner",
      body: [
        "The non-negotiable base: the **CIA triad** and threat modeling (STRIDE), the OSI/TCP-IP stack (what each layer *does*), the TCP state machine, DNS, HTTP/HTTPS, **TLS** (cert chains, handshake, pinning), and Linux permission internals (`setuid`/`setgid`, `/etc/shadow`).",
        "Tooling fluency: `nmap`, Wireshark, Burp Suite. Capture and dissect a real TLS handshake to make it concrete.",
      ],
      resources: [
        { label: "TryHackMe — Pre-Security & SOC L1 paths", url: "https://tryhackme.com/path/outline/presecurity", type: "course", note: "best for absolute beginners" },
        { label: "Professor Messer — Security+ (free)", url: "https://www.professormesser.com/security-plus/sy0-701/sy0-701-video/sy0-701-comptia-security-plus-course/", type: "video" },
      ],
      connections: [
        { to: "os-foundations", note: "Linux permissions/processes are both the defense and the attack surface" },
        { to: "crypto-tls", note: "The TLS handshake here is the applied side of key exchange & certificates" },
        { to: "web-platform", note: "HTTP/cookies/sessions you learn here are what web attacks abuse" },
      ],
    },
    {
      id: "cyber-web",
      title: "Web application security",
      level: "Intermediate",
      body: [
        "**OWASP Top 10** deeply: SQL injection (UNION, blind, second-order), **XSS** (reflected/stored/DOM, CSP bypass), CSRF, **SSRF** (cloud metadata endpoints), XXE, insecure deserialization (Java gadget chains, ysoserial), and IDOR/broken access control. Plus HTTP request smuggling (CL.TE/TE.CL), OAuth attacks, and **JWT** attacks (`alg:none`, HS256/RS256 confusion).",
        "PortSwigger's Academy is the gold standard — free, lab-driven, written by the Burp team.",
      ],
      resources: [
        { label: "PortSwigger Web Security Academy (free)", url: "https://portswigger.net/web-security", type: "course", note: "best web-security training, period" },
        { label: "OWASP Top 10 (2021)", url: "https://owasp.org/Top10/", type: "docs" },
        { label: "HackTricks — pentesting web", url: "https://book.hacktricks.xyz/", type: "docs" },
      ],
      connections: [
        { to: "web-backend", note: "These attacks target the exact auth/validation/CORS layer web devs build" },
        { to: "web-databases", note: "SQLi is a database-layer attack; parameterized queries are the fix" },
        { to: "web3-security", note: "Smart-contract auditing reuses this 'enumerate the vuln classes' mindset" },
      ],
    },
    {
      id: "cyber-pwn",
      title: "Binary exploitation (pwn)",
      level: "Intermediate → Advanced",
      body: [
        "Memory-corruption fundamentals: stack buffer overflows, `gdb` with pwndbg/gef, **stack canaries** and their bypasses, **ASLR** + info leaks, **NX/DEP** (why you need **ROP**), gadget hunting with ROPgadget/ropper, and format-string bugs (`%n` arbitrary write).",
        "This is where the C memory model and ABI become weapons. pwn.college is the most thorough free curriculum.",
      ],
      resources: [
        { label: "pwn.college (free, ASU)", url: "https://pwn.college/", type: "course", note: "best binary-exploitation curriculum" },
        { label: "Nightmare — binary exploitation course (free)", url: "https://guyinatuxedo.github.io/", type: "course" },
        { label: "LiveOverflow — binary exploitation playlist", url: "https://www.youtube.com/playlist?list=PLhixgUqwRTjxglIswKp9mpkfPNfHkzyeN", type: "video" },
      ],
      connections: [
        { to: "ll-cmemory", note: "Overflows are UB/memory-model violations turned into control" },
        { to: "ll-abi", note: "ROP chains are built from the System V ABI and PLT/GOT layout" },
        { to: "cyber-heap", note: "After stack pwn comes the heap — same mindset, harder primitives" },
      ],
    },
    {
      id: "cyber-re",
      title: "Reverse engineering",
      level: "Intermediate → Advanced",
      body: [
        "x86-64 for RE (recognizing if/else, loops, calls in disassembly), static analysis with **Ghidra**/IDA (decompiler output, xrefs), dynamic analysis with `gdb`/`strace`/`ltrace`/**Frida**, and identifying anti-debug/packing tricks.",
        "RE is the dual of compilation — you run the pipeline backwards from machine code to intent.",
      ],
      resources: [
        { label: "Ghidra — official site & docs (NSA, free)", url: "https://ghidra-sre.org/", type: "tool" },
        { label: "Frida — dynamic instrumentation docs", url: "https://frida.re/docs/home/", type: "docs" },
        { label: "Practical malware/RE — OpenSecurityTraining2", url: "https://ost2.fyi/", type: "course" },
      ],
      connections: [
        { to: "ll-asm", note: "RE is fundamentally fluent disassembly reading" },
        { to: "comp-llvm", note: "Decompilers are compilers in reverse; RetDec/Ghidra lift to IR" },
        { to: "cyber-malware", note: "RE is the core skill for malware analysis" },
      ],
    },
    {
      id: "cyber-heap",
      title: "Heap exploitation",
      level: "Advanced",
      body: [
        "**glibc ptmalloc2** internals (`malloc_chunk`, fastbin/unsorted/small/large bins, tcache) and the attack catalog: tcache poisoning, double-free bypass, fastbin/unsorted-bin attacks, the 'House of' techniques, and modern mitigations (**safe-linking**, PROTECT_PTR).",
        "This is the deep end of pwn — it requires holding the allocator's exact state in your head.",
      ],
      resources: [
        { label: "how2heap — shellphish (free)", url: "https://github.com/shellphish/how2heap", type: "repo", note: "glibc heap, technique by technique" },
        { label: "glibc malloc internals — sploitfun / Azeria", url: "https://azeria-labs.com/heap-exploitation-part-1-understanding-the-glibc-heap-implementation/", type: "docs" },
      ],
      connections: [
        { to: "os-memory", note: "ptmalloc2 bins/tcache are the allocator internals from the OS side" },
        { to: "ll-cmemory", note: "Use-after-free and double-free are C ownership violations" },
        { to: "cyber-pwn", note: "Heap is the natural progression after stack exploitation" },
      ],
    },
    {
      id: "cyber-kernel",
      title: "Kernel exploitation",
      level: "Advanced",
      body: [
        "Linux kernel attack surface (syscalls, drivers), bug classes (kernel UAF, **TOCTOU** races, integer overflow), techniques (ret2usr, kernel ROP, `commit_creds(prepare_kernel_cred(0))`, `modprobe_path` overwrite, `seq_operations` UAF), and mitigations (SMEP/SMAP, KASLR, kCFI).",
        "You're now exploiting the OS itself — privilege escalation from user to root.",
      ],
      resources: [
        { label: "pawnyable.cafe — Linux kernel exploitation (free)", url: "https://pawnyable.cafe/linux-kernel/", type: "course" },
        { label: "Linux Kernel Exploitation — collection repo", url: "https://github.com/xairy/linux-kernel-exploitation", type: "repo" },
      ],
      connections: [
        { to: "os-kernel", note: "You're exploiting exactly the modules/drivers/RCU code OS dev teaches" },
        { to: "cyber-research", note: "Kernel bugs are increasingly found via coverage-guided fuzzing (syzkaller)" },
        { to: "cyber-heap", note: "Kernel heap (kmalloc/SLUB) exploitation reuses heap-shaping skills" },
      ],
    },
    {
      id: "cyber-malware",
      title: "Malware analysis",
      level: "Advanced",
      body: [
        "Static analysis (PE/ELF headers, imports, strings, **YARA** rules), dynamic analysis (sandboxes, REMnux, API monitoring), anti-analysis (anti-VM/anti-debug, packing — UPX & custom), unpacking + IAT reconstruction, **rootkits** (DKOM, SSDT hooking), and ransomware internals.",
        "The defensive counterpart to RE — understand attacker tradecraft to detect and respond.",
      ],
      resources: [
        { label: "Practical Malware Analysis (book site)", url: "https://nostarch.com/malware", type: "book" },
        { label: "YARA — documentation", url: "https://yara.readthedocs.io/", type: "docs" },
        { label: "REMnux — malware analysis toolkit", url: "https://remnux.org/", type: "tool" },
      ],
      connections: [
        { to: "cyber-re", note: "Malware analysis is RE plus adversarial anti-analysis defeats" },
        { to: "dsa-strings", note: "YARA / signature matching is Aho-Corasick multi-pattern matching" },
        { to: "os-kernel", note: "Rootkits manipulate kernel objects (DKOM) you learned in OS dev" },
      ],
    },
    {
      id: "cyber-ad",
      title: "Active Directory & red teaming",
      level: "Advanced",
      body: [
        "AD auth internals (LDAP, **Kerberos**, NTLM), enumeration (BloodHound/SharpHound), the Kerberos attack family (Kerberoasting, AS-REP roasting, Pass-the-Hash/Ticket, Silver/Golden Ticket, **DCSync**), lateral movement, and persistence. Then red-team tradecraft: C2 (Sliver/Havoc/Mythic), EDR evasion, OPSEC, and **MITRE ATT&CK** for purple-teaming.",
        "This is enterprise compromise end-to-end — the bread and butter of professional offensive engagements.",
      ],
      resources: [
        { label: "ired.team — red team / AD notes", url: "https://www.ired.team/", type: "docs" },
        { label: "The Hacker Recipes — AD attacks", url: "https://www.thehacker.recipes/", type: "docs" },
        { label: "MITRE ATT&CK framework", url: "https://attack.mitre.org/", type: "docs" },
      ],
      connections: [
        { to: "crypto-symmetric", note: "Kerberos relies on symmetric crypto; ticket forging abuses key handling" },
        { to: "os-virtualization", note: "EDR evasion and detection engineering increasingly use eBPF/seccomp" },
        { to: "web-backend", note: "OAuth/JWT attacks overlap enterprise SSO and identity" },
      ],
    },
    {
      id: "cyber-research",
      title: "Vulnerability research, fuzzing & symbolic execution",
      level: "Research",
      body: [
        "The frontier: coverage-guided **fuzzing** (AFL++, libFuzzer, structure-aware), **symbolic/concolic execution** (angr) for automated bug discovery, browser exploitation (V8 JIT type confusion, sandbox escape), hardware side-channels, and formal protocol verification (ProVerif/Tamarin).",
        "This is how 0-days are found systematically rather than by luck.",
      ],
      resources: [
        { label: "AFL++ — documentation", url: "https://aflplus.plus/docs/", type: "docs" },
        { label: "angr — symbolic execution docs", url: "https://docs.angr.io/", type: "docs" },
        { label: "Google Project Zero — research blog", url: "https://googleprojectzero.blogspot.com/", type: "docs", note: "industry-leading vuln research" },
      ],
      connections: [
        { to: "comp-ssa", note: "Symbolic execution and taint tracking are dataflow analysis on programs" },
        { to: "dsa-complexity", note: "Symbolic execution bottoms out in SAT/SMT solving (the solver you wrote)" },
        { to: "ll-microarch", note: "Spectre-class side-channels are microarchitectural vulnerability research" },
      ],
    },
  ],
});
