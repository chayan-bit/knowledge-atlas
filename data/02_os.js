atlasAdd({
  id: "os",
  num: 2,
  title: "Operating Systems",
  icon: "🐧",
  color: "#7dcfff",
  tagline: 'From "what is an OS" to writing kernel modules and building your own OS.',
  overview: [
    "The OS is the contract between hardware and every program you'll ever write. Understanding it converts a thousand mysteries into one mental model: processes are the CPU abstraction, virtual memory is the RAM abstraction, files/sockets are the I/O abstraction, and the kernel is the trusted referee enforcing all three.",
    "Learn it by *building*: a shell, an allocator, a FUSE filesystem, a kernel module, and finally a bare-metal OS. The payoff compounds — debugging performance, concurrency, containers, and security all bottom out in OS mechanics.",
  ],
  topics: [
    {
      id: "os-foundations",
      title: "What an OS provides; the syscall boundary",
      level: "Beginner",
      body: [
        "The abstractions: CPU→processes, RAM→virtual memory, disk→filesystem. The **fork/exec** model (orphans, zombies, init/systemd as PID 1), **file descriptors** (\"everything is a file\" — sockets, pipes, `/dev/null`), and **signals** (why `SIGKILL` can't be caught).",
        "Get fluent at the syscall level with `strace`/`ltrace`. Build a shell that handles `fork`, `exec`, pipes, and redirection — it forces every concept here into working code.",
      ],
      resources: [
        { label: "The Linux Programming Interface — Kerrisk (TLPI)", url: "https://man7.org/tlpi/", type: "book", note: "the POSIX bible" },
        { label: "Julia Evans — Linux/debugging zines", url: "https://wizardzines.com/", type: "docs" },
        { label: "The Linux Command Line — Shotts (free)", url: "https://linuxcommand.org/tlcl.php", type: "book" },
      ],
      connections: [
        { to: "dsa-foundations", note: "fds, pipes, and the shell are the concrete form of stdin/stdout you met first" },
        { to: "cyber-foundations", note: "setuid/setgid, /etc/shadow, and process privilege are the attack surface in security" },
        { to: "ll-network", note: "Sockets are file descriptors; the BSD sockets API lives here" },
      ],
    },
    {
      id: "os-process",
      title: "Processes & scheduling",
      level: "Intermediate",
      body: [
        "**Context switching** (what the kernel saves/restores), scheduling algorithms ending at Linux's **CFS** (a red-black tree keyed on virtual runtime), **priority inversion** and its fixes, and the container substrate: **cgroups v2** (CPU/mem/IO throttling) and **namespaces** (PID/net/mount/user).",
        "cgroups + namespaces are the entire magic trick behind Docker — there is no \"container\" object in the kernel, just these two features composed.",
      ],
      resources: [
        { label: "OSTEP — Scheduling chapters (free)", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/", type: "book", note: "best OS textbook, bar none" },
        { label: "Linux CFS scheduler — kernel docs", url: "https://docs.kernel.org/scheduler/sched-design-CFS.html", type: "docs" },
        { label: "cgroups v2 — kernel docs", url: "https://docs.kernel.org/admin-guide/cgroup-v2.html", type: "docs" },
      ],
      connections: [
        { to: "dsa-trees", note: "CFS literally is a red-black tree of runnable tasks" },
        { to: "web-systemdesign", note: "cgroups/namespaces are why Docker works the way it does in production" },
        { to: "cyber-ad", note: "Container escape & isolation breaks target seccomp/namespaces" },
      ],
    },
    {
      id: "os-memory",
      title: "Virtual memory & allocators",
      level: "Intermediate",
      body: [
        "**Page tables**, the **TLB**, page faults (minor vs major), x86-64 4-level paging (PML4→PT), **mmap** (how both `malloc` and file I/O use it), **copy-on-write** after fork, and page-replacement (LRU/clock/working-set).",
        "Then allocator internals: `sbrk` vs `mmap`, ptmalloc2/jemalloc/tcmalloc, and **NUMA**. Writing your own `malloc` is the single best way to make all of this concrete.",
      ],
      resources: [
        { label: "OSTEP — Virtual Memory (free)", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/", type: "book" },
        { label: "What Every Programmer Should Know About Memory — Drepper (PDF)", url: "https://people.freebsd.org/~lstewart/articles/cpumemory.pdf", type: "paper" },
        { label: "Memory allocators 101 — write a simple malloc", url: "https://danluu.com/malloc-tutorial/", type: "docs" },
      ],
      connections: [
        { to: "ll-cmemory", note: "mmap, sbrk and the free-list ARE the C allocator you implement from scratch" },
        { to: "cyber-heap", note: "ptmalloc2 bins/tcache are exactly what heap exploitation corrupts" },
        { to: "ll-cache", note: "TLB, huge pages and NUMA are the performance side of the same paging machinery" },
      ],
    },
    {
      id: "os-concurrency",
      title: "Concurrency: futexes, deadlock, lock-free",
      level: "Intermediate → Advanced",
      body: [
        "Race conditions and the happens-before model, **mutex internals** (the `futex` fast-path/slow-path split), condition variables (why you always loop on the predicate), deadlock (the four CHMR conditions + Banker's), and reader-writer locks.",
        "Then lock-free programming with atomics: compare-and-swap, the **ABA problem**, and memory ordering. This is the hardest correctness topic in systems and it pays off across kernels, databases, and trading engines.",
      ],
      resources: [
        { label: "futex(2) — man page", url: "https://man7.org/linux/man-pages/man2/futex.2.html", type: "docs" },
        { label: "Is Parallel Programming Hard? — McKenney (free)", url: "https://mirrors.edge.kernel.org/pub/linux/kernel/people/paulmck/perfbook/perfbook.html", type: "book", note: "definitive concurrency reference" },
        { label: "Preshing on Programming — memory ordering", url: "https://preshing.com/archives/", type: "docs" },
      ],
      connections: [
        { to: "ll-concurrency", note: "Same atomics/memory-ordering material from the hardware side (acquire/release)" },
        { to: "web-databases", note: "Isolation levels, MVCC and deadlocks are concurrency control in DBs" },
        { to: "quant-hft", note: "Lock-free queues are mandatory in low-latency trading hot paths" },
      ],
    },
    {
      id: "os-filesystems",
      title: "Filesystems & storage",
      level: "Intermediate",
      body: [
        "Disk layout (MBR/GPT), **ext4** internals (inodes, extent trees), **journaling** (write-ahead logging, ordered vs writeback), the **VFS** layer (`struct inode`/`file`/`dentry`), and copy-on-write filesystems (ZFS/Btrfs — snapshots, checksums, RAID-Z).",
        "Write-ahead logging is the same durability idea databases use; learning it once explains both.",
      ],
      resources: [
        { label: "OSTEP — File Systems (free)", url: "https://pages.cs.wisc.edu/~remzi/OSTEP/", type: "book" },
        { label: "ext4 — kernel docs", url: "https://docs.kernel.org/filesystems/ext4/index.html", type: "docs" },
        { label: "Write a FUSE filesystem — libfuse examples", url: "https://github.com/libfuse/libfuse", type: "repo" },
      ],
      connections: [
        { to: "web-databases", note: "WAL journaling and B-tree indexing are shared between filesystems and databases" },
        { to: "dsa-trees", note: "Extent trees / directory indexes are B-tree variants" },
        { to: "emb-memory", note: "Flash wear-leveling and log-structured FS matter on embedded storage" },
      ],
    },
    {
      id: "os-kernel",
      title: "Kernel development",
      level: "Advanced",
      body: [
        "Kernel vs user space (privilege rings, the `SYSCALL` path), writing a **kernel module** (`module_init`, `printk`, `kmalloc`), character device drivers (`file_operations`, `copy_to_user`), interrupt handling (top/bottom half), and the kernel's most important lock: **RCU**.",
        "Internal allocators (buddy + slab/SLUB) and dynamic instrumentation with **kprobes/eBPF** round this out.",
      ],
      resources: [
        { label: "The Linux Kernel Module Programming Guide (free)", url: "https://sysprog21.github.io/lkmpg/", type: "book" },
        { label: "Linux kernel — official docs", url: "https://docs.kernel.org/", type: "docs" },
        { label: "xv6 — MIT teaching OS (book + source)", url: "https://pdos.csail.mit.edu/6.828/2023/xv6.html", type: "course", note: "read & modify every line" },
      ],
      connections: [
        { to: "os-concurrency", note: "Spinlocks, RCU and memory barriers are kernel concurrency in practice" },
        { to: "cyber-kernel", note: "Driver UAF, ret2usr and commit_creds are kernel-exploitation of this code" },
        { to: "emb-rtos-own", note: "Writing a kernel module mirrors writing your own RTOS scheduler" },
      ],
    },
    {
      id: "os-boot",
      title: "Boot, linkers & ELF; build your own OS",
      level: "Advanced",
      body: [
        "The full chain: BIOS/UEFI → bootloader (GRUB2) → decompress kernel → `start_kernel()` → init. Write a bootloader that walks **real → protected → long mode**, understand **linker scripts** (`.text`/`.data`/`.bss`, entry point) and the **ELF** format (sections vs segments, PLT/GOT).",
        "Then build a bare-metal x86-64 OS: GDT, IDT, paging, a physical/virtual memory manager, a scheduler, keyboard driver, and VGA text output.",
      ],
      resources: [
        { label: "OSDev Wiki — bare-metal reference", url: "https://wiki.osdev.org/Main_Page", type: "docs" },
        { label: "Writing an OS in Rust — Phil Opp (blog_os)", url: "https://os.phil-opp.com/", type: "course", note: "modern, hands-on" },
        { label: "xv6 book (RISC-V, PDF)", url: "https://pdos.csail.mit.edu/6.S081/2023/xv6/book-riscv-rev3.pdf", type: "book" },
      ],
      connections: [
        { to: "ll-abi", note: "ELF, linker scripts and PLT/GOT are the linking material, kernel-side" },
        { to: "comp-bytecode", note: "Code generation + assembling end at the same ELF/loader the kernel runs" },
        { to: "emb-baremetal", note: "Vector tables, linker scripts and reset handlers are the embedded analogue of boot" },
      ],
    },
    {
      id: "os-virtualization",
      title: "Virtualization, containers & eBPF",
      level: "Advanced",
      body: [
        "Hardware virtualization (Intel VT-x/AMD-V, VMCS, VM entry/exit), **KVM** (how Linux becomes a hypervisor), **QEMU** + virtio paravirtualization, and container isolation internals (seccomp, AppArmor, SELinux).",
        "**eBPF** deserves special attention: a verified, JIT-compiled VM *inside* the kernel for tracing, networking (XDP), and security — one of the most important systems technologies of the decade.",
      ],
      resources: [
        { label: "KVM — kernel docs", url: "https://docs.kernel.org/virt/kvm/index.html", type: "docs" },
        { label: "ebpf.io — what is eBPF", url: "https://ebpf.io/what-is-ebpf/", type: "docs" },
        { label: "Brendan Gregg — BPF Performance Tools", url: "https://www.brendangregg.com/bpf-performance-tools-book.html", type: "book" },
      ],
      connections: [
        { to: "ll-kernelbypass", note: "XDP/eBPF at the NIC is the kernel-bypass networking story" },
        { to: "cyber-research", note: "eBPF powers modern EDR/detection and sandboxing" },
        { to: "web-systemdesign", note: "VMs vs containers is the substrate of cloud deployment" },
      ],
    },
  ],
});
