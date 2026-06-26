atlasAdd({
  id: "lowlevel",
  topics: [
    {
      id: "ll-concurrency",
      title: "Lock-free concurrency",
      level: "Advanced",
      body: [
        "C11/C++ atomics, **memory ordering** (`relaxed`/`acquire`/`release`/`seq_cst` - what each guarantees), the happens-before/synchronizes-with model, a **Michael-Scott lock-free queue** (CAS loop, ABA + tagged pointers), **hazard pointers**, and **RCU**.",
        "The hardest correctness work in the field. Done right, it's the difference between a system that scales linearly across cores and one that doesn't.",
      ],
      subtopics: [
        {
          title: "The memory model: happens-before, visibility, and reordering",
          body: [
            "Modern CPUs do not execute instructions in program order. Out-of-order execution, store buffers, and cache coherence protocols all allow a CPU to delay making a store visible to other cores. The C11/C++11 **memory model** formalizes when a write by one thread is guaranteed to be visible to another. Without this model, multi-threaded code has no semantics - compilers and CPUs are free to reorder anything.",
            "The core relation is **happens-before (HB)**. If operation A happens-before operation B, then A's effects are visible when B executes. Within a single thread, all operations are ordered by program order (sequenced-before, a subset of HB). Across threads, HB is established only through **synchronization operations** - atomic operations with appropriate memory orders, mutex lock/unlock, thread creation/join, and a handful of others. Without any synchronization between threads, there is *no* HB relation - and accessing a shared variable without HB constitutes a **data race**, which is undefined behavior in C++.",
            "The **synchronizes-with** relation is what cross-thread synchronization operations establish. A release-store on atomic variable X by thread A **synchronizes-with** an acquire-load of X by thread B that reads A's value. This pair establishes HB: everything before the release-store happens-before everything after the acquire-load. This is the formal underpinning of a producer-consumer flag: `data = 42; flag.store(1, release)` in thread A; `while(!flag.load(acquire)); use(data)` in thread B. The release-acquire pair ensures the data write is visible when thread B proceeds.",
            "**Total store order (TSO)** is x86's hardware memory model: x86 allows only one reordering - a store can be delayed behind a later load from a different address (the store buffer). All other reorderings are disallowed. ARM and POWER have weaker models (more reorderings allowed). This is why code written for x86 sometimes appears to 'work' without proper synchronization but breaks on ARM - the x86 hardware enforces ordering that the C++ memory model does not guarantee.",
          ],
          resources: [
            { label: "cppreference - memory_order (precise definitions)", url: "https://en.cppreference.com/w/cpp/atomic/memory_order", type: "docs" },
            { label: "Herb Sutter - atomic Weapons (C++ memory model deep dive)", url: "https://herbsutter.com/2013/02/11/atomic-weapons-the-c-memory-model-and-modern-hardware/", type: "video" },
          ],
        },
        {
          title: "C11 atomics and memory orders: relaxed, acquire, release, seq_cst",
          body: [
            "C11/C++11 atomic types (`atomic<T>`, or `_Atomic T` in C11) guarantee that all operations on them are **atomic** - indivisible, no torn reads or writes. But atomicity alone does not prevent reordering. Memory orders control the reordering constraints additionally imposed on surrounding non-atomic operations.",
            "**`memory_order_relaxed`**: only atomicity is guaranteed - no ordering constraints on surrounding memory accesses. Two threads incrementing a relaxed counter will not lose updates (no torn writes), but reads in the same thread can observe writes in arbitrary order relative to other memory operations. Use for statistics counters or reference counts where the exact count does not need to be synchronized with other data.",
            "**`memory_order_acquire`** (on a load): all memory reads and writes in the current thread that come *after* this load in program order are prevented from being reordered to *before* this load. In concrete terms: a load-acquire on a flag ensures that any data 'published' before the corresponding store-release is visible to this thread. **`memory_order_release`** (on a store): all reads and writes in the current thread that come *before* this store are prevented from being reordered *after* it. Acquire/release pair is the mechanism for 'publish and subscribe' patterns: write data, then release-store a flag; the reader acquire-loads the flag, then reads the data. One fence pair suffices; no sequential consistency required.",
            "**`memory_order_seq_cst`** is the default and most expensive: in addition to acquire-release semantics, all seq_cst operations appear in a single total order across all threads on all cores. This is the easiest to reason about but requires a full memory fence on weakly-ordered architectures (ARM, POWER). On x86, seq_cst store requires `lock xchg` or `mfence` instead of a plain `mov`, which is 5-10x more expensive. Use seq_cst when you cannot reason about the correct weaker ordering; switch to acquire-release once you understand the invariant you are protecting.",
            "**The atomic flag spin loop pattern**: `while (flag.load(acquire) == 0) { }` is a spin-wait. For brief waits (microseconds), spinning is faster than blocking (avoids a syscall). For long waits, it wastes CPU. The standard improvement: add a `_mm_pause()` instruction in the spin body - it hints to the CPU that this is a spin loop, reducing power consumption and pipeline pressure without yielding the thread. For longer waits, `std::this_thread::yield()` gives up the CPU timeslice. Production HFT code uses `_mm_pause` loops for sub-microsecond waits and falls back to condition variables for anything longer.",
          ],
          resources: [
            { label: "cppreference - std::atomic (operations, memory orders)", url: "https://en.cppreference.com/w/cpp/atomic/atomic", type: "docs" },
            { label: "Preshing - an introduction to lock-free programming", url: "https://preshing.com/20120612/an-introduction-to-lock-free-programming/", type: "docs" },
          ],
        },
        {
          title: "Lock-free data structures: Michael-Scott queue, CAS, and ABA",
          body: [
            "A **lock-free** data structure guarantees that at any point, at least one thread is making progress (no thread can be blocked indefinitely by another thread's failure or preemption). This contrasts with **wait-free** (every thread makes progress within a bounded number of steps) and with mutex-based structures (where a preempted lock-holder blocks all other threads indefinitely). Lock-free structures are valuable when lock contention is the bottleneck and the overhead of the kernel's mutex implementation (futex, context switch) is unacceptable - primarily in low-latency systems and high-frequency operations.",
            "**Compare-and-swap (CAS)** is the hardware primitive that makes lock-free algorithms possible. `CAS(address, expected, desired)` atomically reads `*address`: if it equals `expected`, it writes `desired` and returns true; otherwise it returns false without writing. The standard pattern for lock-free update: read the current value, compute the new value, attempt CAS. If CAS fails (another thread changed the value), retry from the read. This is the **CAS loop**. Because CAS is atomic, exactly one thread 'wins' each CAS - there is no lost update.",
            "The **Michael-Scott lock-free queue** (1996) is the canonical textbook implementation of a lock-free FIFO queue. It uses a singly-linked list with a sentinel head node. Enqueue: allocate a new node, set its `next` to null, CAS the tail's `next` from null to the new node (retry if another enqueuer won the CAS first), then CAS the tail pointer to the new node (the enqueue is 'linearized' at the first CAS). Dequeue: read head->next (the actual first element), CAS the head pointer from the current head to head->next, return the value. The sentinel node design avoids the case where head == tail when the queue is empty, simplifying concurrency.",
            "The **ABA problem** is the fundamental hazard of CAS-based algorithms. Thread 1 reads value A, gets preempted. Thread 2 pops A, pushes B, then pops B and pushes A again. Thread 1 resumes and CAS(address, A, new) succeeds - but the state has changed non-trivially between reads. The ABA problem causes the lock-free stack to corrupt its next pointer. Solutions: (1) **Tagged pointers** - pair the pointer with a version counter in the same word (possible on 64-bit because pointers only use 48 bits; the upper 16 bits carry the counter, incremented on every CAS). CAS now compares both pointer and counter, so the A->B->A sequence fails the counter comparison. (2) **Hazard pointers** - before dereferencing a pointer, register it in a thread-local hazard pointer; the memory reclaimer checks hazard pointers before freeing. (3) **RCU** - covered next.",
            "Practical implementation notes: lock-free queues are genuinely faster than mutex-based queues only when contention is high (many threads) and the critical section is brief. For an SPSC (single-producer single-consumer) queue, a simple ring buffer with no atomics other than a pair of acquire/release loads/stores on head and tail suffices and is faster than any general-purpose lock-free structure. Lock-free algorithms are hard to write correctly; unless you have profiling evidence that lock contention is the bottleneck, prefer a well-tested mutex-based implementation (or a battle-tested library like `folly::MPMCQueue`).",
          ],
          resources: [
            { label: "Michael and Scott - Simple, Fast, and Practical Non-Blocking Queue (1996, the original paper)", url: "https://dl.acm.org/doi/10.1145/248052.248106", type: "paper" },
            { label: "Preshing - lock-free programming, CAS loops, and ABA", url: "https://preshing.com/20120612/an-introduction-to-lock-free-programming/", type: "docs" },
          ],
        },
        {
          title: "Hazard pointers and epoch-based reclamation",
          body: [
            "The hardest problem in lock-free programming is **safe memory reclamation**: when is it safe to `free` a node that has been removed from a lock-free data structure? The node has been removed from the logical structure (no new thread will find it by traversal), but another thread may have a pointer to it and be about to dereference it. Freeing early causes use-after-free; never freeing causes a memory leak. Mutexes make this trivial (hold the lock while dereferencing), but lock-free structures forgo the lock.",
            "**Hazard pointers** (Maged Michael, 2004) are thread-local pointer slots that a thread declares before dereferencing a shared pointer. Before `node = ptr.load(); use(node->data)`, the thread writes `node` into its hazard pointer slot. The memory reclaimer (running in a background thread or periodically) collects all candidate-for-reclamation nodes and checks each against the set of all threads' hazard pointers. Only nodes not present in any hazard pointer slot are safe to free. The protocol: load the pointer, store it in the hazard pointer, load the pointer *again* and verify it has not changed (barrier against the window between the first load and the hazard pointer store). Hazard pointers bound memory usage: at most `K * H` nodes are deferred per thread (K threads, H hazard pointers per thread).",
            "**Epoch-based reclamation (EBR)**, used by Crossbeam in Rust and many databases, uses a global epoch counter and per-thread epoch tracking. Each thread announces its current epoch at the start of a read-side critical section. Memory is reclaimed in batches: when all threads have advanced past epoch E, all nodes retired in epoch E are safe to free. EBR is lower overhead than hazard pointers (no per-pointer registration, just a single epoch update) and integrates naturally with garbage-collected runtimes. The risk: if a thread is preempted while in a critical section, reclamation is blocked until it resumes - causing memory accumulation under overload.",
            "**RCU (Read-Copy-Update)** is the Linux kernel's mechanism for protecting read-mostly data structures. The core insight: readers run locklessly with no atomic operations (just a `rcu_read_lock()` that disables preemption, essentially free), writers copy the data, modify the copy, atomically swap the pointer, and then wait for all current readers to finish (`synchronize_rcu()`) before freeing the old copy. RCU gives O(1) reads with zero synchronization cost and defers the cost entirely to writers. It is used in the kernel for routing tables, process credentials, and network protocol handlers - structures read millions of times per second but updated rarely. Userspace RCU (liburcu) brings this to userspace.",
          ],
          resources: [
            { label: "Is Parallel Programming Hard? - McKenney (RCU chapter, free PDF)", url: "https://mirrors.edge.kernel.org/pub/linux/kernel/people/paulmck/perfbook/perfbook.html", type: "book" },
            { label: "Rust Atomics and Locks - Mara Bos (ch. 9, hazard pointers and epoch reclamation)", url: "https://marabos.nl/atomics/", type: "book" },
          ],
        },
        {
          title: "Designing for scalability: false sharing, contention, and lock-free queues",
          body: [
            "Scalability analysis starts with **Amdahl's Law**: if a fraction `s` of a computation is serialized (cannot be parallelized), the maximum speedup from N cores is `1 / (s + (1-s)/N)`. For `s = 0.1` (10% serialized), maximum speedup is ~10x regardless of how many cores you add. The practical lesson: identify and eliminate the serialized portion - which is usually lock contention on shared state - rather than adding cores.",
            "**Reducing contention**: the first strategy is to reduce the frequency of contention. Per-thread counters (sum at read time rather than incrementing a shared counter) is the extreme case - each thread updates its own cache line. **Sharding** divides a shared hash table into N independent tables, each with its own lock, so N threads contend 1/N as often. **Lock striping** (`java.util.concurrent.ConcurrentHashMap`, `folly::ConcurrentHashMap`) uses a fixed array of locks over the key space. **Work stealing** (used in task schedulers like Intel TBB and Go's goroutines) gives each thread a private work queue, stealing from others only when empty.",
            "**SPSC (Single-Producer Single-Consumer) ring buffer** is the fastest possible bounded lock-free queue when the producer-consumer relationship is one-to-one. Maintain head and tail indices, each touched by only one thread. The producer writes at `tail % size`, increments tail with a release store. The consumer reads at `head % size`, increments head with a release store. The other thread only reads these indices with acquire loads. No CAS needed - just two atomic variables with acquire/release. Cache line alignment of head and tail is essential (they are written by different threads - putting them in the same cache line causes false sharing). This pattern is universal in HFT market-data pipelines, audio I/O, and any fixed-rate producer-consumer.",
            "**Measuring lock contention**: `perf lock record ./prog; perf lock report` shows per-lock contention statistics. `strace -T ./prog` shows time spent in `futex` calls (mutex contention in glibc). On Linux, `/proc/<pid>/schedstat` tracks time spent waiting for the scheduler. The diagnostic signature of lock contention is: high wall time, low CPU utilization, `futex` calls dominating strace output. The diagnostic signature of false sharing is: high cache-to-cache invalidations in `perf c2c`, good CPU utilization but poor scaling with core count.",
          ],
          resources: [
            { label: "Is Parallel Programming Hard? - McKenney (free)", url: "https://mirrors.edge.kernel.org/pub/linux/kernel/people/paulmck/perfbook/perfbook.html", type: "book" },
            { label: "Preshing - lock-free programming series (practical, blog)", url: "https://preshing.com/20120612/an-introduction-to-lock-free-programming/", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "cppreference - memory_order", url: "https://en.cppreference.com/w/cpp/atomic/memory_order", type: "docs" },
        { label: "Is Parallel Programming Hard? - McKenney (free)", url: "https://mirrors.edge.kernel.org/pub/linux/kernel/people/paulmck/perfbook/perfbook.html", type: "book" },
        { label: "Preshing - lock-free programming", url: "https://preshing.com/20120612/an-introduction-to-lock-free-programming/", type: "docs" },
      ],
      connections: [
        { to: "os-concurrency", note: "Same atomics/CAS/ABA from the OS-primitives side (futex, deadlock)" },
        { to: "quant-hft", note: "Lock-free SPSC queues are mandatory in trading hot paths" },
        { to: "dsa-linear", note: "The lock-free ring buffer / queue you implement here" },
      ],
    },
  ],
});
