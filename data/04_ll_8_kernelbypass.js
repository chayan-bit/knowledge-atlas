atlasAdd({
  id: "lowlevel",
  topics: [
    {
      id: "ll-kernelbypass",
      title: "Kernel-bypass I/O & Rust systems",
      level: "Research",
      body: [
        "When the kernel is the bottleneck: **DPDK** (poll-mode drivers, no interrupts), **XDP** (eBPF at the NIC driver), **RDMA** (bypass the TCP/IP stack entirely), and shared-memory IPC. On the language side, advanced **Rust**: async runtimes (build a mini-Tokio: executor/waker/reactor), `crossbeam`/epoch-based reclamation, and safe lock-free code.",
        "This is the frontier of throughput - line-rate packet processing and microsecond-scale systems.",
      ],
      subtopics: [
        {
          title: "Why the kernel is a bottleneck: the I/O path cost model",
          body: [
            "A standard kernel I/O path for a network packet: the NIC raises a hardware interrupt, the interrupt handler runs (copying the packet from DMA buffer to a socket buffer), a softirq processes it (traversing the TCP/IP stack, demultiplexing to the right socket), `epoll` wakes a waiting userspace thread, the userspace thread calls `recv`, which copies the data from the kernel socket buffer to a userspace buffer. Each step has costs: the interrupt context switch (~1-2 microseconds), the softirq processing (~5-10 microseconds for TCP), the `recv` syscall (mode switch + copy, ~1-5 microseconds), and the `epoll_wait` wakeup latency (several microseconds). Total: 10-20 microseconds from NIC to application at low load.",
            "At high packet rates, interrupts themselves become the bottleneck. Modern NICs (100 Gbps) can deliver 150 million packets per second. At one interrupt per packet, that is 150 million interrupts per second - each requiring the OS to save/restore registers, run the interrupt handler, schedule the softirq, and return. The interrupt overhead alone can saturate a CPU core. **Interrupt coalescing** (`ethtool -C eth0 rx-usecs 50`) batches interrupts by waiting up to 50 microseconds, trading latency for throughput. But for latency-sensitive workloads (HFT, real-time), coalescing is unacceptable.",
            "**NUMA effects** compound the bottleneck: the NIC's DMA engine writes to whatever NUMA node's memory it is connected to. If the processing thread is on a different NUMA node, every packet reception incurs a cross-NUMA memory access (300+ ns vs ~100 ns). `ethtool -X eth0` and interrupt affinity (`/proc/irq/N/smp_affinity`) must be tuned to pin NIC interrupts to the same NUMA node as the processing threads.",
            "The fundamental limit is that the kernel TCP/IP stack was designed for correctness and generality, not microsecond latency. For applications where network latency is the primary constraint - HFT market data, financial order routing, distributed storage, video streaming at scale - kernel bypass is the engineering answer: eliminate the kernel from the data path entirely.",
          ],
          resources: [
            { label: "DPDK programmer's guide - introduction and motivation", url: "https://doc.dpdk.org/guides/prog_guide/", type: "docs" },
            { label: "Linux kernel networking - receive path in detail", url: "https://www.kernel.org/doc/html/latest/networking/driver.html", type: "docs" },
          ],
        },
        {
          title: "DPDK: poll-mode drivers and line-rate packet processing",
          body: [
            "**DPDK (Data Plane Development Kit)** is Intel's open-source framework (now Linux Foundation) for building high-throughput network applications that bypass the kernel entirely. The key mechanism: DPDK uses a **Poll Mode Driver (PMD)** that directly programs the NIC's DMA rings from userspace (via memory-mapped PCI registers) and polls for new packets in a tight loop - no interrupts, no syscalls, no kernel involvement in the data path. A dedicated core spins 100% of the time polling the NIC; this looks wasteful but removes all interrupt latency and context switches.",
            "DPDK's architecture: **huge pages** for the packet memory pool (2 MB pages to reduce TLB pressure and eliminate page faults), **lockless ring buffers** (`rte_ring`) for inter-core communication, **memory pools** (`rte_mempool`) for zero-copy packet allocation (packets are DMA'd directly into pool memory and passed between pipeline stages by reference, never copied), and **NUMA-aware allocation** (memory pools and rings allocated on the same NUMA node as the NIC and processing cores). A single core running a DPDK PMD can process 10-80 million packets per second depending on packet size and processing logic.",
            "**RSS (Receive Side Scaling)** distributes incoming packets across multiple NIC hardware queues based on a hash of the flow tuple (src IP, dst IP, src port, dst port). Each queue is assigned to a different core, enabling parallel packet processing without locks: core 0 gets all packets for flow hash 0..N, core 1 for flow hash N+1..2N, etc. Flows within a queue are processed by one core, maintaining TCP ordering without synchronization. RSS is the mechanism that allows a 100 Gbps NIC to saturate 20+ cores.",
            "A minimal DPDK pipeline: `rte_eal_init` (initializes EAL, pins threads to cores, maps huge pages), `rte_eth_dev_configure` (configures the NIC, sets rx/tx queues), `rte_pktmbuf_pool_create` (allocates packet pool), `rte_eth_dev_start` (starts the NIC). The main loop: `rte_eth_rx_burst(port, queue, pkts, 32)` receives up to 32 packets in a burst (batching is critical for throughput), processes each packet, then `rte_eth_tx_burst` sends the results. The burst API is the key abstraction: batching amortizes the NIC access overhead across 32 packets instead of 1.",
          ],
          resources: [
            { label: "DPDK programmer's guide (comprehensive reference)", url: "https://doc.dpdk.org/guides/prog_guide/", type: "docs" },
            { label: "DPDK getting started guide - sample applications", url: "https://doc.dpdk.org/guides/sample_app_ug/", type: "docs" },
          ],
        },
        {
          title: "XDP and eBPF: programmable packet processing in the kernel",
          body: [
            "**XDP (eXpress Data Path)** runs eBPF programs at the earliest possible point in the kernel's receive path - in the NIC driver, before the SKB (socket buffer) is allocated, before the TCP/IP stack sees the packet. An XDP program can: pass the packet up the normal network stack (`XDP_PASS`), drop it at line rate (`XDP_DROP`), redirect it to another interface or CPU (`XDP_REDIRECT`), or send it back out (`XDP_TX`). XDP does not require full kernel bypass - it is a hybrid: normal kernel networking for most traffic, XDP for high-throughput or security-critical paths.",
            "The canonical use cases: **DDoS mitigation** (XDP_DROP at the NIC, before any state is allocated, at 100 Gbps line rate - Cloudflare uses this); **load balancing** (Facebook's Katran L4 load balancer uses XDP to redirect flows without per-connection kernel state); **custom packet parsers** (match on specific protocol fields and redirect to userspace via AF_XDP). The key advantage over DPDK: XDP runs in the kernel context, so you retain full access to kernel networking primitives (routing table, conntrack, tc filters) and do not need dedicated cores.",
            "**eBPF** is the general mechanism underlying XDP. An eBPF program is a small, verified bytecode program loaded into the kernel at runtime (via the `bpf()` syscall). The kernel's eBPF verifier ensures the program terminates (no loops with unbounded iteration), accesses only valid memory, and cannot crash the kernel. eBPF programs can be attached to many kernel hook points: XDP (NIC), tc (traffic control), kprobes (arbitrary kernel functions), uprobes (userspace functions), tracepoints, and more. The `bpf()` syscall is the loader; `libbpf` and the BPF CO-RE mechanism handle portability across kernel versions.",
            "**AF_XDP** (zero-copy userspace networking via XDP) is the path when you need userspace processing but want lower latency than DPDK: XDP redirects packets into a UMEM (userspace memory) region that the userspace application reads from directly, with shared rings (similar to io_uring). This is not full kernel bypass (you still pay for the XDP hook), but it avoids the full kernel TCP/IP stack. AF_XDP latency is between epoll (~10 us) and DPDK (~1 us), and it requires no huge pages and no dedicated cores, making it practical for applications that cannot dedicate hardware.",
          ],
          resources: [
            { label: "XDP paper - Fast Programmable Packet Processing in the Operating System Kernel", url: "https://dl.acm.org/doi/10.1145/3281411.3281443", type: "paper" },
            { label: "BPF and XDP reference guide (Cilium)", url: "https://docs.cilium.io/en/latest/bpf/", type: "docs" },
          ],
        },
        {
          title: "RDMA: remote direct memory access and bypassing TCP/IP",
          body: [
            "**RDMA (Remote Direct Memory Access)** allows a machine to directly read or write the memory of another machine over the network, bypassing the CPU and OS on both sides. The NIC handles DMA into/out of registered memory regions without involving the kernel or any userspace code on the remote host. Latency: sub-microsecond (200-300 ns) vs ~50 us for kernel TCP; throughput: line rate (100 Gbps+) with near-zero CPU utilization on the data path.",
            "The RDMA API has two operation types. **One-sided operations** (RDMA_READ, RDMA_WRITE): the initiator directly reads from or writes to a pre-registered remote memory region, without the remote CPU being involved at all. Used for distributed shared memory, disaggregated storage (reading a remote block without involving the remote node's CPU). **Two-sided operations** (SEND/RECV): both sides are involved; a send on one machine completes a posted receive on the other, transferring a message. Used for request-response protocols where the remote side needs to react.",
            "**Infiniband** was the original RDMA fabric (used in HPC clusters, still dominant in supercomputers and ML training). **RoCE (RDMA over Converged Ethernet)** brought RDMA to standard Ethernet, making it accessible for datacenter deployment. RoCE v2 runs over UDP/IP, allowing routing across subnets. Most hyperscalers (AWS EFA, Azure RDMA, Google GRDMA) use RoCE v2 or proprietary variants for inter-machine GPU training (AllReduce over RDMA is how GPT-4-scale models are trained). The `libibverbs` library provides the userspace API; `ibv_post_send`, `ibv_poll_cq`, `ibv_reg_mr` are the core operations.",
            "Memory registration is the critical performance consideration: before an application can use a memory region for RDMA, it must **register** it with the NIC (`ibv_reg_mr`). Registration is expensive (pins the memory in physical RAM, builds page tables in the NIC firmware) and should be done at startup for fixed buffers. For dynamic workloads, buffer pools (pre-registered, reused) are the standard pattern. Memory registration overhead is why RDMA applications always use large buffers and avoid small, frequent allocations - the registered buffer pool pattern is analogous to DPDK's `rte_mempool`.",
          ],
          resources: [
            { label: "RDMA programming with InfiniBand, OmniPath, iWARP and RoCE (book)", url: "https://github.com/jcxue/RDMA-Tutorial", type: "repo" },
            { label: "ibv_post_send and libibverbs man pages", url: "https://man7.org/linux/man-pages/man3/ibv_post_send.3.html", type: "docs" },
          ],
        },
        {
          title: "Shared-memory IPC and zero-copy inter-process communication",
          body: [
            "**Shared memory IPC** is the fastest mechanism for communicating between processes on the same machine - faster than pipes (which copy data through the kernel), sockets (which copy twice, through the kernel socket buffer), and signals (asynchronous, no data). With shared memory, data is written by one process and read by another with no kernel involvement and no data copying - the same physical page is mapped into both processes' address spaces.",
            "Linux shared memory: `shm_open` + `mmap` (POSIX shared memory, backed by tmpfs in `/dev/shm`) or `shmget`/`shmat` (System V shared memory, older API). `mmap(NULL, size, PROT_READ|PROT_WRITE, MAP_SHARED, fd, 0)` maps the shared region. Synchronization: the shared memory region itself has no built-in synchronization, so you need a lock or lock-free structure (e.g., a ring buffer with acquire/release atomics on head and tail). The ring buffer pattern from `ll-concurrency` is the canonical shared-memory IPC primitive.",
            "**`memfd_create`** (Linux 3.17+) creates an anonymous file in memory that can be passed to other processes via Unix socket file descriptor passing (`SCM_RIGHTS`). Unlike POSIX shm which uses a named file in `/dev/shm`, `memfd_create` creates a file with no filesystem path - it exists only as a file descriptor. The producing process creates the memfd, resizes it, maps it, writes data, and sends the fd over a Unix socket. The receiving process maps the same fd. Zero copy, no filesystem name space pollution, auto-cleaned on close.",
            "**huge pages for IPC**: shared memory regions used for high-frequency data exchange should use huge pages (`MAP_HUGETLB` or `madvise(MADV_HUGEPAGE)`) to reduce TLB pressure. A 10 MB shared ring buffer mapped with 4 KB pages requires 2500 TLB entries; with 2 MB huge pages it needs only 5. For market data feedhandlers and real-time control systems that read shared memory in tight loops, TLB miss elimination is often the difference between meeting latency targets and missing them. DMA buffers (used in DPDK and io_uring zero-copy) are always huge-page-backed for this reason.",
          ],
          resources: [
            { label: "Linux IPC facilities - shm_open, mmap (man 7 shm_overview)", url: "https://man7.org/linux/man-pages/man7/shm_overview.7.html", type: "docs" },
            { label: "io_uring zero-copy networking (Axboe, LSFMM 2022)", url: "https://lore.kernel.org/io-uring/", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "DPDK - programmer's guide", url: "https://doc.dpdk.org/guides/prog_guide/", type: "docs" },
        { label: "The Rust Programming Language (free book)", url: "https://doc.rust-lang.org/book/", type: "book" },
        { label: "Tokio internals - building an async runtime", url: "https://tokio.rs/tokio/tutorial", type: "docs" },
      ],
      connections: [
        { to: "ll-rust", note: "Async runtime internals build directly on Rust ownership & Send/Sync" },
        { to: "os-virtualization", note: "XDP/eBPF is the in-kernel side of kernel-bypass" },
        { to: "quant-hft", note: "DPDK/Solarflare OpenOnload are standard in HFT market-data paths" },
      ],
    },
  ],
});
