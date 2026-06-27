atlasAdd({
  id: "dsa",
  num: 1,
  title: "Foundations & DSA",
  icon: "🧮",
  color: "#ff7a93",
  tagline: "From zero to competitive-programming and systems-level algorithmic fluency.",
  overview: [
    "This is the root of the whole atlas. Almost every other domain is an *application* of something here: a database index is a **B-tree**, a blockchain is a **Merkle tree** plus a hash table, a compiler's optimizer is **dataflow analysis on a graph**, a GPU kernel is **cache-aware array layout**, and a trading backtest is **dynamic programming over a time series**.",
    "Treat it in two layers. First, the *mechanical* layer - implement every structure from scratch until the cost model (amortized, cache, branch) is in your fingers. Second, the *design* layer - given an unseen problem, recognize which paradigm collapses it. The milestone that matters is being able to prove **why** an algorithm is correct, not just that it passes tests.",
  ],
  topics: [
    {
      id: "dsa-foundations",
      title: "How a computer actually runs your code",
      level: "Beginner",
      body: [
        "Before any data structure, internalize the substrate: **binary / two's complement / IEEE-754**, the **fetch-decode-execute** cycle, and what *really* happens to the **stack vs heap** on a function call. This is the bedrock that makes pointers, undefined behavior, and cache effects later feel obvious instead of magical.",
        "Pair it with fluency in the tools that surround code - the shell (`stdin`/`stdout`/`stderr`, pipes, redirection) and **Git internals** (blobs, trees, commits, refs - not just `add`/`commit`). Petzold's *Code* builds the machine from a light switch up; CS50 gives you the hands-on reps.",
      ],
      subtopics: [
        {
          title: "Bits, bytes, and the representation of numbers",
          body: [
            "Every value in a running program is ultimately a pattern of bits stored in transistors. Understanding how numbers map to bits is not trivia - it is the foundation for reasoning about overflow, signed vs unsigned comparison bugs, and the behavior of bitwise operations. A byte is 8 bits and can represent 256 distinct states. **Unsigned integers** use all bits for magnitude: an 8-bit unsigned integer ranges from 0 to 255. **Signed integers** use **two's complement**, the dominant encoding since the 1970s: the most significant bit has weight $-2^{n-1}$, so an 8-bit signed integer ranges from -128 to 127. Negating a number in two's complement is: flip all bits, add 1. This is why overflow wraps: `127 + 1 = -128` in signed 8-bit.",
            "**Two's complement** has a critical property: addition and subtraction are the same operation for both signed and unsigned values at the hardware level. The CPU's adder does not know or care whether operands are signed - it just adds bits. Signedness is a software interpretation. This means that a C comparison `a < b` where `a` and `b` are of different signedness (one `int`, one `unsigned int`) can silently produce wrong results because the signed operand is promoted to unsigned before comparison - a classic source of security vulnerabilities in C.",
            "**IEEE 754** is the standard for floating-point. A 32-bit float has 1 sign bit, 8 exponent bits (biased by 127), and 23 mantissa bits. The value is $(-1)^s \\times 1.mantissa \\times 2^{exponent - 127}$. The implicit leading 1 is why floats have 24 bits of precision despite a 23-bit field. Special values: `±Infinity` (exponent = 255, mantissa = 0), `NaN` (exponent = 255, mantissa ≠ 0), and `-0` (sign bit = 1, everything else 0). `NaN != NaN` is true by definition - the only value not equal to itself. This matters when sorting: a comparator containing NaN will violate the strict weak ordering contract and cause undefined behavior in `std::sort`.",
            "**Hexadecimal** (`0x`) is the standard lens for looking at bit patterns because one hex digit maps exactly to 4 bits. Memory addresses, SHA hashes, IPv6 addresses, and register dumps are all presented in hex. **Bitwise operations**: AND (`&`) for masking, OR (`|`) for setting bits, XOR (`^`) for toggling and parity, NOT (`~`) for inverting, left-shift (`<<`) for multiplying by powers of two, right-shift (`>>`) for dividing (arithmetic shift preserves sign for signed types; logical shift inserts zeros). The canonical tricks: test bit k with `(x >> k) & 1`; set bit k with `x | (1 << k)`; clear bit k with `x & ~(1 << k)`; toggle bit k with `x ^ (1 << k)`; isolate lowest set bit with `x & (-x)` (used in Fenwick trees); clear lowest set bit with `x & (x - 1)` (counting set bits).",
            "The gap between abstraction and hardware becomes concrete here: integer overflow is **undefined behavior** in C/C++ for signed types (the compiler may assume it never happens and optimize accordingly, breaking your program in subtle ways) but **defined** (wraps modulo $2^n$) for unsigned types. Floating-point arithmetic is not associative: `(a + b) + c` can differ from `a + (b + c)` due to rounding at each step. These are not bugs - they are the price of using finite representations for infinite-precision mathematics.",
          ],
          resources: [
            { label: "CS:APP - Computer Systems: A Programmer's Perspective (bits/integers chapter)", url: "https://csapp.cs.cmu.edu/", type: "book" },
            { label: "IEEE 754 Floating Point - Wikipedia", url: "https://en.wikipedia.org/wiki/IEEE_754", type: "docs" },
            { label: "Bit Twiddling Hacks - Sean Anderson", url: "https://graphics.stanford.edu/~seander/bithacks.html", type: "docs" },
          ],
        },
        {
          title: "Fetch-decode-execute: what the CPU actually does",
          body: [
            "The **fetch-decode-execute** cycle is the heartbeat of a CPU. **Fetch**: the program counter (PC/IP register) holds the address of the next instruction; the CPU fetches those bytes from memory (or cache) into the instruction register. **Decode**: the control unit interprets the opcode and operand fields, determining which functional unit to use and where to find the inputs. **Execute**: the ALU performs the operation (add, compare, shift), or the load/store unit accesses memory, or the branch unit updates the PC. After execute, results are written back to registers. This single description applies from a 1970s 8-bit microprocessor to a modern out-of-order superscalar CPU - the complexity is entirely in how aggressively each stage is pipelined and parallelized.",
            "**Registers** are the fastest memory: a modern CPU has 16-32 general-purpose integer registers (x86-64 has 16: `rax`, `rbx`, ..., `r15`), each 64 bits. Register access takes ~0-1 cycles (depending on pipeline). L1 cache: ~4 cycles. L2: ~12 cycles. L3: ~40 cycles. DRAM: ~100-300 cycles. A cache miss to DRAM is 100x slower than a register access. This is why data structure choice matters far more than instruction count: an algorithm that causes cache misses will lose to a worse algorithm that stays in cache. The **memory hierarchy** (registers → L1 → L2 → L3 → DRAM → SSD → HDD) is the single most important architectural fact for a systems programmer.",
            "**Pipelining** overlaps the stages of multiple instructions: while instruction $i$ is in the execute stage, instruction $i+1$ is being decoded, and instruction $i+2$ is being fetched. A 5-stage pipeline can theoretically execute one instruction per cycle. **Hazards** break this: data hazards (instruction B needs the result of A, which is not yet written back) are handled by forwarding or stalling. Control hazards (branches) require **branch prediction**: the CPU speculatively executes past a branch; if the prediction is wrong, the pipeline is flushed and the wrong-path instructions discarded. Modern CPUs predict correctly >99% of the time on regular code. The Spectre and Meltdown vulnerabilities (2018) exploited speculative execution to leak secret data from cache side channels - a reminder that the abstraction of a simple sequential machine is a convenient fiction.",
            "**Instruction set architectures (ISAs)** define the interface between software and hardware. **RISC** (Reduced Instruction Set Computer - ARM, RISC-V) uses a small, regular instruction set where all operations are on registers and memory is accessed only via explicit load/store instructions. **CISC** (Complex Instruction Set Computer - x86) has complex, variable-length instructions that can directly operate on memory. Modern x86 CPUs internally decode CISC instructions into micro-ops (RISC-like internal instructions) before execution - the CISC complexity is handled at decode time. Assembly is the programming language of this level: understanding `mov`, `add`, `cmp`, `jne`, `call`, `ret`, and the calling convention (which registers are caller-saved vs callee-saved) demystifies what the compiler produces and what the debugger shows.",
            "**The compiler's job** is to transform source code into machine instructions while preserving semantics and optimizing for the target ISA. Key optimizations: constant folding, common subexpression elimination, dead code elimination, loop unrolling, inlining. The compiler can reorder instructions as long as the observable behavior is unchanged - this is why `volatile` and memory barriers exist for concurrent programming. Writing `x = y = 0` in C does not guarantee that both stores happen before another thread sees either - the compiler and CPU are both free to reorder. Understanding the compiler's view (and limits) is what separates programmers who debug correctness issues at the assembly level from those who guess.",
          ],
          resources: [
            { label: "CS:APP Chapter 3 - Machine-Level Representation", url: "https://csapp.cs.cmu.edu/", type: "book" },
            { label: "Nand2Tetris - build a computer from logic gates", url: "https://www.nand2tetris.org/", type: "course" },
            { label: "x86-64 Assembly - Guide (University of Virginia)", url: "https://www.cs.virginia.edu/~evans/cs216/guides/x86.html", type: "docs" },
          ],
        },
        {
          title: "Stack and heap: the memory model under every function call",
          body: [
            "When a program runs, the OS maps several distinct regions into its address space. The **text segment** holds the compiled machine instructions (read-only). The **data segment** holds initialized global/static variables. The **BSS segment** holds zero-initialized globals. The **heap** is for dynamically allocated memory (`malloc`/`new`), growing upward. The **stack** is for local variables and function call state, growing downward. The gap between stack and heap is virtual address space - it looks huge (48 bits on x86-64) but may not be backed by physical RAM until accessed.",
            "Every function call creates a **stack frame** (also called activation record). The frame holds: the return address (where to resume after the function returns), the saved caller's frame pointer (so the caller's frame can be restored), local variables, and space for outgoing arguments. The `call` instruction pushes the return address and jumps; `ret` pops the return address and jumps back. The **frame pointer** (`rbp` on x86-64) points to the base of the current frame, making it easy to address local variables at fixed negative offsets (`rbp - 8`, `rbp - 16`, ...). In practice, modern compilers often omit the frame pointer (`-fomit-frame-pointer`) and use `rsp`-relative addressing instead, gaining a free register.",
            "**Stack overflow** occurs when the stack grows beyond its limit (typically 8MB on Linux). Infinite recursion is the classic cause, but deeply nested calls on large stack frames can also trigger it. The OS maps a **guard page** just below the stack - any access to it triggers a segfault. Unlike heap exhaustion, stack overflow is not gracefully recoverable because the handler itself needs stack space. This is why embedded systems use fixed-size stacks and embedded coding standards (MISRA-C) forbid recursion.",
            "The **heap** is managed by the allocator (`malloc`/`free` in C, `new`/`delete` in C++). The allocator maintains free lists and uses system calls (`brk`/`sbrk` or `mmap`) to request pages from the OS. Common allocators: `ptmalloc2` (glibc default, per-thread arenas to reduce contention), `jemalloc` (Firefox, Redis - better fragmentation), `tcmalloc` (Google - per-thread caches). **Heap fragmentation** occurs when many small allocations and frees leave unusable holes; a 100MB heap can run out of space for a 1MB allocation due to fragmentation. **Buffer overflows** on the heap (writing past the end of a `malloc`'d buffer) corrupt adjacent allocations and are a critical exploit class - they can overwrite allocator metadata or other objects to gain code execution.",
            "**The stack frame layout is the foundation of calling conventions**, which specify: which registers hold the first arguments (on x86-64 System V: `rdi`, `rsi`, `rdx`, `rcx`, `r8`, `r9` for the first 6 integer/pointer args, then the stack), which register holds the return value (`rax`), which registers must be preserved across calls (callee-saved: `rbx`, `rbp`, `r12-r15`), and which can be freely trashed (caller-saved: `rax`, `rcx`, `rdx`, `rsi`, `rdi`, `r8-r11`). Understanding the calling convention lets you read compiler output, write assembly that interoperates with C, and understand how exploits like ROP (return-oriented programming) corrupt the control flow by overwriting saved return addresses on the stack.",
          ],
          resources: [
            { label: "CS:APP Chapter 3.7 - Procedures (stack frames)", url: "https://csapp.cs.cmu.edu/", type: "book" },
            { label: "Linux kernel - process memory layout", url: "https://www.kernel.org/doc/html/latest/admin-guide/mm/", type: "docs" },
            { label: "Malloc tutorial - Arjun Sreedharan", url: "https://arjunsreedharan.org/post/148675821737/memory-allocators-101-write-a-simple-memory", type: "docs" },
          ],
        },
        {
          title: "Git internals: content-addressable storage",
          body: [
            "Git is not a version control system that tracks changes - it is a **content-addressable filesystem** with a version control interface bolted on. Every object stored in Git is keyed by its SHA-1 hash (40 hex characters). There are four object types. **Blob**: the raw content of a file. **Tree**: a directory listing, mapping filenames to blob/tree SHAs (like an inode). **Commit**: a pointer to a tree (snapshot), zero or more parent commit SHAs, author/committer metadata, and the commit message. **Tag**: an annotated pointer to another object. These four types, linked by hashes, form the entire repository.",
            "A **commit** is not a diff - it is a snapshot. When you run `git commit`, Git writes a blob for each changed file, a tree that captures the full directory structure, and a commit that points to that tree. A `git show <sha>` that looks like a diff is actually computed on-the-fly by comparing the commit's tree to its parent's tree. This design has profound implications: checking out any historical commit is O(1) in principle (just restore the tree), and merging is a matter of finding the common ancestor (the merge-base) and applying the divergent changes.",
            "**Refs** are human-readable names for object SHAs, stored in `.git/refs/`. A branch is just a file containing the SHA of its tip commit. `HEAD` is a symbolic ref (`.git/HEAD`) pointing to the current branch. Detached HEAD means HEAD points directly to a commit SHA rather than a branch name. Tags are fixed refs (annotated tags are tag objects; lightweight tags are just refs to commits). `git log` follows the parent chain from HEAD back to the root commit. The **reflog** is a local journal of where HEAD and each branch have pointed - it is the escape hatch when you `git reset --hard` or `git rebase` and need to recover.",
            "**The index (staging area)** is the database of what the next commit will contain, stored in `.git/index`. `git add` writes a blob for the file content and updates the index entry to point at that blob. `git commit` writes a tree from the index, then a commit. This three-way separation (working tree, index, repository) enables partial staging (`git add -p`), `git stash`, and understanding exactly why `git diff` (working tree vs index) differs from `git diff --cached` (index vs HEAD).",
            "**Rebase vs merge** is a philosophical question about history linearity. `git merge` creates a new merge commit with two parents, preserving the exact history of both branches. `git rebase` replays the commits of the current branch onto the tip of the target branch, rewriting each commit's SHA (because the parent SHA is part of the content being hashed). The resulting history is linear but the commit SHAs are different - you never rebase a branch others have pulled. Understanding rebasing requires understanding that SHA-based integrity means any change to content, parent, or metadata produces a completely new hash - commits are immutable objects, and rebase creates new objects, not modified ones.",
          ],
          resources: [
            { label: "Pro Git - Chapter 10: Git Internals", url: "https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain", type: "book" },
            { label: "MIT Missing Semester - Version Control (Git)", url: "https://missing.csail.mit.edu/2020/version-control/", type: "course" },
            { label: "git-scm reference manual", url: "https://git-scm.com/docs", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "CS50x - Harvard (full course)", url: "https://cs50.harvard.edu/x/", type: "course", note: "the best on-ramp, no debate" },
        { label: "MIT - The Missing Semester (CLI, Git, shell)", url: "https://missing.csail.mit.edu/", type: "course" },
        { label: "Git Internals - Pro Git, Ch. 10", url: "https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain", type: "book" },
        { label: "Code - Charles Petzold (companion site)", url: "https://www.codehiddenlanguage.com/", type: "book", note: "computers from first principles" },
        { label: "Python Official Tutorial", url: "https://docs.python.org/3/tutorial/", type: "docs" },
      ],
      connections: [
        { to: "ll-cmemory", note: "Stack-vs-heap here becomes the C memory model - segments, UB, pointer arithmetic" },
        { to: "os-foundations", note: "stdin/stdout/fds and the shell are the OS's process abstraction in disguise" },
        { to: "web-platform", note: "Git workflow (branches, rebase, bisect) is the daily loop of every web project" },
      ],
    },
    {
      id: "dsa-linear",
      title: "Linear structures & the cost model",
      level: "Beginner → Intermediate",
      body: [
        "Dynamic arrays, linked lists, stacks, queues, deques, circular buffers. The point is not the API - it is the **cost model**: amortized $O(1)$ array growth (and its doubling proof), why linked lists lose on modern hardware (**cache locality**), and when they still win (stable pointers, $O(1)$ splice).",
        "Master the *techniques* that ride on them: the **monotonic stack** (next-greater-element, histogram), the **sliding-window deque**, and the lock-free **SPSC ring buffer** that shows up in audio, networking, and trading.",
      ],
      subtopics: [
        {
          title: "Dynamic arrays and amortized O(1) growth",
          body: [
            "A **dynamic array** (C++ `std::vector`, Python `list`, Java `ArrayList`) stores elements in a contiguous heap block and doubles the block size when it runs out of space. This doubling strategy achieves **amortized $O(1)$** push-back even though individual pushes occasionally take $O(n)$ time (for the copy). The proof uses a **potential function**: define $\\Phi = 2 \\cdot \\text{size} - \\text{capacity}$. Each cheap push costs 1 real unit and decreases $\\Phi$ by -2 (wait: increases by 2, since size grows). Each expensive resize copies n elements, setting size = n and capacity = 2n, so $\\Phi$ goes from 2n - n = n to 2n - 2n = 0: a drop of n, exactly paying for the n copies. The amortized cost is the real cost plus the potential change, which is O(1) per push.",
            "The doubling factor matters. If you grow by a fixed amount instead of doubling, push-back costs $O(n)$ amortized (n pushes each into a new allocation, summing to $1 + 2 + ... + n = O(n^2)$ total). If you grow by a factor of $r > 1$, you get $O(1)$ amortized. Common choices: 2 (wastes up to 50% of allocated memory) vs 1.5 (wastes up to 33% - used by some std library implementations to allow the freed old block to be reused for the next allocation under certain allocators). The choice is a memory vs copy trade-off; in practice, doubling is universal.",
            "**Cache performance** is where dynamic arrays dominate all other structures. Elements are contiguous in memory, so iterating them is a single sequential scan - exactly what the CPU's prefetcher is optimized for. A prefetcher can speculatively fetch the next cache lines before they are needed, hiding memory latency. A linked list, by contrast, stores each node separately on the heap; each `next` pointer dereference is a potential cache miss. On a machine with 100-cycle DRAM latency, iterating 10 million linked-list nodes takes ~1 second in the worst case; iterating 10 million vector elements takes ~10 milliseconds. This 100x difference overwhelms any asymptotic analysis.",
            "**Insertion and deletion in the middle** cost $O(n)$ for dynamic arrays (shifting elements) but $O(1)$ for linked lists (given a pointer to the node). This rarely matters in practice because: (1) the constant on linked-list operations is large due to cache misses; (2) sorted insertion into a vector can use binary search ($O(\\log n)$) plus a batch move (which is a memcpy, extremely cache-friendly). The crossover point where linked lists win is surprisingly large capacities - often >100,000 elements with extremely frequent mid-insertions. For most real workloads, `std::vector` beats `std::list`.",
            "**`std::deque`** (double-ended queue) is a chunked array: an array of pointers to fixed-size blocks of elements. Push-front and push-back are $O(1)$ amortized; random access is $O(1)$ (pointer indirection to the right block, then offset). It is cache-friendlier than a linked list but slower than a contiguous vector for sequential iteration. The Python `collections.deque` is the same idea. Use it when you need $O(1)$ push-front; otherwise prefer vector.",
          ],
          resources: [
            { label: "CLRS - Chapter 17: Amortized Analysis", url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/", type: "book" },
            { label: "C++ Reference - std::vector", url: "https://en.cppreference.com/w/cpp/container/vector", type: "docs" },
          ],
        },
        {
          title: "Linked lists: when pointers beat contiguity",
          body: [
            "A **singly linked list** stores each element in a node with a `next` pointer. Prepend and removal-at-head are $O(1)$. Append and access-by-index are $O(n)$. A **doubly linked list** adds a `prev` pointer, enabling $O(1)$ removal given a pointer to any node (not just the head). This single property is the linked list's only real advantage over arrays: **pointer-stable $O(1)$ removal from an arbitrary position given a pointer to that node**. This is why the OS kernel uses doubly linked intrusive lists for process queues - tasks can remove themselves from a wait queue in $O(1)$.",
            "**Intrusive linked lists** (used in Linux kernel `list_head`) embed the list pointers directly in the contained object, rather than wrapping it in a heap-allocated node. This avoids the allocation overhead and improves locality (the object and its list pointers are co-located). The `container_of` macro recovers the outer struct from a pointer to the embedded `list_head`. This is a C idiom with no direct C++ equivalent (though `boost::intrusive` provides it), and it is the dominant pattern in systems code.",
            "**Sentinel nodes** (dummy head and tail nodes with no payload) simplify linked list code by eliminating special cases for empty list, head insertion, and tail insertion. Every operation becomes 'insert between two existing nodes' or 'remove a node that has both neighbors'. This is a textbook simplification but widely used in production (LRU cache, OS schedulers).",
            "**The runner technique** (Floyd's tortoise and hare): use two pointers advancing at different speeds to detect cycles, find the cycle entry point, or find the middle of a list. For cycle detection, fast pointer moves 2 nodes per step, slow moves 1. If they meet, there is a cycle. To find the entry: reset slow to head, advance both 1 step at a time - they meet at the cycle start. For finding the middle: when fast reaches the end, slow is at the middle. These are classic interview problems but also appear in real systems (detecting circular references in garbage collection).",
            "**Skip lists** are a probabilistic alternative to balanced BSTs for sorted collections. A skip list is a layered set of linked lists where each element appears in higher layers with probability $p$ (typically 1/2). Searching starts at the top layer (sparse) and descends when it overshoots the target. Expected $O(\\log n)$ search, insert, and delete - same asymptotic as a balanced BST but much simpler to implement and often better in practice due to cache effects (nodes are forward-linked, enabling some prefetching). Redis uses skip lists for its sorted sets.",
          ],
          resources: [
            { label: "Linux kernel - list.h intrusive linked list", url: "https://github.com/torvalds/linux/blob/master/include/linux/list.h", type: "repo" },
            { label: "Redis - skip list implementation", url: "https://github.com/redis/redis/blob/unstable/src/t_zset.c", type: "repo" },
          ],
        },
        {
          title: "Stacks, queues, and monotonic structures",
          body: [
            "A **stack** (LIFO) supports push and pop in $O(1)$. Every recursive algorithm has an equivalent iterative form using an explicit stack - function call stacks are exactly stacks. Classic applications: balanced parentheses checking, undo/redo, expression evaluation (shunting-yard algorithm for infix-to-postfix), DFS without recursion, and backtracking. The shunting-yard algorithm converts infix expressions (`3 + 4 * 2`) to postfix (`3 4 2 * +`) using operator precedence rules and a stack, running in $O(n)$ - the algorithm used in most calculators and expression compilers.",
            "A **queue** (FIFO) supports enqueue and dequeue in $O(1)$. Queues implement BFS (breadth-first search), task scheduling (OS run queues), and producer-consumer pipelines. A circular array-based queue (ring buffer) with head and tail indices is the most cache-friendly implementation. When `tail == head`, the queue is empty; when `(tail + 1) % capacity == head`, it is full. One wasted slot distinguishes empty from full without a separate size counter.",
            "The **monotonic stack** is the single most underrated technique in competitive programming. It maintains a stack of elements in monotonically increasing (or decreasing) order by popping elements that violate the invariant before pushing. The canonical problem is **next greater element**: for each element in an array, find the next element to its right that is larger. Process left to right, keeping a monotonic decreasing stack. When element $x$ is processed, pop all stack elements smaller than $x$ - for each popped element $y$, $x$ is the next greater element of $y$. Total time: $O(n)$ because each element is pushed and popped at most once. Variations: previous smaller element, trapping rainwater (the classic), largest rectangle in histogram. The histogram problem asks for the largest rectangle that can be inscribed in a histogram: for each bar, the rectangle extending to the left and right until a shorter bar blocks it. The monotonic stack computes, for each bar, the indices of its nearest shorter bars on both sides in one $O(n)$ pass.",
            "The **sliding window maximum** (or minimum) uses a **monotonic deque**: a deque of indices in decreasing order of their corresponding values. When the window slides right, the deque front may fall outside the window (pop front). The new element may be larger than elements at the back (pop back until the deque is monotone). The front of the deque always holds the index of the maximum in the current window. Total time: $O(n)$ for a window of any size. Applications: Maximum in every k-length subarray, sliding-window rate limiters, time-series peak detection.",
            "The **SPSC (single-producer single-consumer) ring buffer** is the lock-free queue used in audio engines, network drivers, and high-frequency trading. A fixed-size circular array with head (consumer reads here) and tail (producer writes here) indices. The producer writes to `tail % size`, then atomically advances tail. The consumer reads from `head % size`, then advances head. No locks needed because only one thread reads head and only one thread writes tail. The correctness condition: the buffer must not wrap around (producer must check `tail - head < size`). The key insight is that `std::atomic` with `memory_order_release` on the write and `memory_order_acquire` on the read provides the necessary synchronization without a mutex, making this the lowest-latency queue primitive in existence.",
          ],
          resources: [
            { label: "CP-Algorithms - Monotonic stack", url: "https://cp-algorithms.com/data_structures/stack_queue_modification.html", type: "docs" },
            { label: "Lock-free SPSC queue - Dmitry Vyukov", url: "https://www.1024cores.net/home/lock-free-algorithms/queues/unbounded-spsc-queue", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "VisuAlgo - animated data structures", url: "https://visualgo.net/en", type: "tool" },
        { label: "CP-Algorithms - data structures", url: "https://cp-algorithms.com/data_structures/", type: "docs" },
        { label: "CLRS - Introduction to Algorithms (MIT 6.006 lectures)", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/", type: "course" },
      ],
      connections: [
        { to: "ll-cache", note: "Why arrays beat lists IS the cache-line / prefetch story, made concrete" },
        { to: "ll-concurrency", note: "The lock-free ring buffer is the canonical SPSC/MPMC concurrency exercise" },
        { to: "os-concurrency", note: "Producer-consumer queues are the OS IPC primitive" },
      ],
    },
    {
      id: "dsa-trees",
      title: "Trees: balanced, disk-friendly, and range",
      level: "Intermediate",
      body: [
        "BSTs → **AVL / red-black** (rotations, the $O(\\log n)$ height guarantee behind `std::map`) → **B-trees / B+ trees**, the structure every database index and filesystem is built on because they minimize disk seeks.",
        "Then the competitive-programming workhorses: **segment trees** (with lazy propagation for range updates), **Fenwick/BIT** for prefix sums, **tries / radix trees**, and **suffix tries → suffix arrays**. Understand the *why*: fan-out trades height for node size, which is exactly the memory-hierarchy tradeoff.",
      ],
      subtopics: [
        {
          title: "Binary search trees and balance guarantees",
          body: [
            "A **binary search tree (BST)** stores keys such that for every node, all keys in the left subtree are smaller and all keys in the right subtree are larger. Search, insertion, and deletion are all $O(h)$ where $h$ is the tree height. For a balanced tree, $h = O(\\log n)$, giving $O(\\log n)$ operations. For a degenerate tree (inserting sorted keys into a plain BST), $h = O(n)$ and the BST degenerates into a linked list. Balancing is the entire point.",
            "**AVL trees** maintain the **AVL property**: for every node, the heights of its left and right subtrees differ by at most 1. This guarantees $h \\le 1.44 \\log_2 n$. After insertion or deletion, one or more **rotations** restore the AVL property. There are four rotation cases: left rotation, right rotation, left-right rotation (double), and right-left rotation (double). A single rotation takes $O(1)$ and at most $O(\\log n)$ rotations are needed per operation. AVL trees are the most strictly balanced BSTs - height is minimized at the cost of frequent rotations.",
            "**Red-black trees** (used in C++ `std::map`/`std::set`, Java `TreeMap`, Linux kernel's `rbtree`) maintain balance through coloring invariants: every node is red or black; the root is black; red nodes have only black children; every path from a node to its descendant leaves has the same number of black nodes. These invariants guarantee $h \\le 2 \\log_2 (n+1)$. Insertion and deletion require at most 3 rotations (vs potentially $O(\\log n)$ for AVL). Red-black trees are slightly less balanced than AVL but require fewer rotations, making them faster for write-heavy workloads. The Linux kernel's rbtree is used for process scheduling (CFS), virtual memory area tracking, and timer management.",
            "**Treaps** and **randomized BSTs** achieve $O(\\log n)$ expected height without deterministic balancing. A treap assigns each node a random priority and maintains both the BST ordering on keys and the heap ordering on priorities. Expected height is $O(\\log n)$ with high probability. Treaps are simpler to implement than red-black trees (especially for split/merge operations) and are popular in competitive programming. The **split** and **merge** operations, which are fundamental to treaps, support $O(\\log n)$ insertion, deletion, and range queries.",
            "**Splay trees** use the **splay operation**: on access to a key, rotate it to the root via a sequence of zig, zig-zig, or zig-zag rotations. This self-adjusting BST has $O(\\log n)$ amortized cost per operation and the **working-set property**: frequently accessed elements move near the root and become faster to access. Splay trees power the link-cut tree (a dynamic-tree data structure), are used in some memory allocators (splaying recently freed blocks to the root for fast reuse), and implement the `splay_tree` in GCC's internal runtime.",
          ],
          resources: [
            { label: "MIT 6.006 - Lecture 6: AVL trees", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/", type: "course" },
            { label: "VisuAlgo - BST / AVL visualization", url: "https://visualgo.net/en/bst", type: "tool" },
            { label: "Linux kernel rbtree documentation", url: "https://www.kernel.org/doc/html/latest/core-api/rbtree.html", type: "docs" },
          ],
        },
        {
          title: "B-trees and B+ trees: the database index",
          body: [
            "A **B-tree of order $m$** stores up to $m-1$ keys per node and has up to $m$ children. All leaves are at the same depth. The minimum degree $t$ (usually $t \\ge 2$) ensures every non-root node has between $t-1$ and $2t-1$ keys. The height is $O(\\log_t n)$, which is small when $t$ is large. The key insight: by making nodes large (hundreds of keys), you reduce the tree height to 3-4 levels for billions of records, and each node fits in one disk page. A B-tree of degree 512 with height 3 can hold $512^3 \\approx 134$ million keys with only 3 disk reads per lookup.",
            "**Disk seek costs** ($\\sim 5-10$ms for HDDs, $\\sim 0.1$ms for SSDs) are the motivation for B-trees. A balanced BST with a million nodes has height $\\sim 20$, each node access potentially a cache miss and disk seek: 20 disk reads per lookup. A B-tree with a million nodes, degree 100, has height $\\le 3$: 3 disk reads per lookup, 7x fewer. The savings compound with database size. Even on SSDs, the principle holds: DRAM is still 10-100x faster than SSD, so fitting more data per cache-line-sized read reduces the number of I/O operations.",
            "**B+ trees** (used in PostgreSQL, MySQL InnoDB, SQLite, ext4, NTFS) are a variant where all keys are stored in leaves, and internal nodes only store routing keys (copies of leaf keys). Leaves are linked in a doubly linked list, enabling efficient **range scans**: find the first matching key, then traverse leaf siblings. This is why `SELECT * FROM t WHERE id BETWEEN 100 AND 200` is $O(\\log n + k)$ where $k$ is the number of results - the index walk to the first matching key, then a sequential scan of the leaf chain. In B-trees, range scans require tree traversal (in-order); B+ trees make them sequential.",
            "**Insertion and deletion** in a B-tree maintain the invariants: insertion into a full node **splits** it (the median key moves up to the parent); deletion from a node with too few keys either **borrows** from a sibling or **merges** with a sibling (pulling a key down from the parent). Both operations propagate upward at most $O(h)$ times. This is why database writes can be expensive: a single insert can cause $O(\\log_t n)$ page writes. **Write-ahead logging (WAL)** defers these writes and batches them, recovering consistency from the log if a crash occurs.",
            "**LSM trees (Log-Structured Merge Trees)** are the alternative to B-trees for write-heavy workloads (LevelDB, RocksDB, Cassandra). Writes always append to a write-ahead log and an in-memory sorted structure (MemTable). When the MemTable fills, it is flushed to disk as a sorted immutable file (SSTable). Periodic **compaction** merges SSTables, discarding deleted entries and keeping the most recent value per key. Reads may need to check multiple SSTables (mitigated by Bloom filters). LSMs win on write throughput (sequential writes); B-trees win on read latency (predictable seek count). This trade-off drives database engine choice: OLTP uses B-trees (PostgreSQL, MySQL); analytics and log ingestion use LSMs (RocksDB, Cassandra).",
          ],
          resources: [
            { label: "PostgreSQL - B-Tree index internals", url: "https://www.postgresql.org/docs/current/btree-implementation.html", type: "docs" },
            { label: "LevelDB - LSM tree design notes", url: "https://github.com/google/leveldb/blob/main/doc/impl.md", type: "docs" },
            { label: "CLRS Chapter 18 - B-Trees", url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/", type: "book" },
          ],
        },
        {
          title: "Segment trees and Fenwick trees: range queries",
          body: [
            "A **segment tree** is a complete binary tree where each node stores an aggregate (sum, min, max, GCD, ...) of a contiguous subarray. A leaf stores a single element. An internal node stores the aggregate of its children's subarrays. For $n$ elements, the tree has $O(n)$ nodes (at most $4n$ is the safe allocation). Point update: walk from the leaf to the root, updating each ancestor: $O(\\log n)$. Range query: decompose the query range into $O(\\log n)$ non-overlapping nodes and combine their aggregates: $O(\\log n)$. Both operations are $O(\\log n)$, better than the $O(n)$ brute force and $O(1)$ precomputed prefix sums (which do not support updates).",
            "**Lazy propagation** extends the segment tree to handle range updates (e.g., add 5 to all elements in $[l, r]$). Without lazy, you would update $O(n)$ leaf nodes. With lazy propagation, each node carries a 'pending update' tag. When a range update hits a node whose range is fully covered, you store the tag on that node and return. The tag is pushed to children only when they are actually accessed. This defers work until it is needed: range update takes $O(\\log n)$, not $O(n)$. Lazy propagation is correct as long as tags compose correctly (addition tags compose by summing; 'set to value' tags compose by taking the newer one).",
            "A **Fenwick tree (Binary Indexed Tree / BIT)** is a more cache-friendly alternative for prefix-sum queries and point updates. It stores partial sums in a flat array `bit[]` where `bit[i]` stores the sum of elements in `[i - lowbit(i) + 1, i]`, where `lowbit(i) = i & (-i)` isolates the lowest set bit of $i$. Prefix sum query: `query(i)` accumulates `bit[i]`, then jumps to `i - lowbit(i)`, repeating until `i = 0`. This traverses at most $O(\\log n)$ nodes (one per bit in $i$). Point update: `update(i, delta)` adds `delta` to `bit[i]`, then jumps to `i + lowbit(i)`, repeating until `i > n`. The Fenwick tree is a segment tree with half the memory and ~2x cache friendliness. Limitation: only works for commutative invertible operations where the range query is always `[1, r]` (prefix).",
            "**Merge sort tree** (storing sorted arrays at each segment tree node) supports queries like 'count elements in $[l, r]$ less than $k$' in $O(\\log^2 n)$. **Persistent segment trees** (functional segment trees) create a new root per update, sharing unchanged subtrees with previous versions. This enables queries 'what was element $i$ at time $t$?' or 'order statistics in a range' using the offline trick of building a persistent segment tree over sorted values. Persistent segment trees are $O(n \\log n)$ space and $O(\\log n)$ per version - the standard solution to the 'kth smallest in a range' problem.",
            "The **sparse table** is a static data structure for range minimum (or maximum) queries when updates are not needed. Precompute `st[i][j]` = minimum of `a[i..i+2^j-1]`. Precomputation: $O(n \\log n)$. Query: $O(1)$ by overlapping two precomputed ranges (since min is idempotent: taking the min of an element twice does not change the result). This is the fastest RMQ structure and is used in suffix array LCP queries (where the LCP array is static after construction).",
          ],
          resources: [
            { label: "CP-Algorithms - Segment Tree", url: "https://cp-algorithms.com/data_structures/segment_tree.html", type: "docs" },
            { label: "CP-Algorithms - Fenwick Tree", url: "https://cp-algorithms.com/data_structures/fenwick.html", type: "docs" },
            { label: "Codeforces - Segment Tree tutorial (adamant)", url: "https://codeforces.com/blog/entry/18051", type: "docs" },
          ],
        },
        {
          title: "Tries, suffix arrays, and string trees",
          body: [
            "A **trie** (prefix tree) stores strings by decomposing them character by character. Each node has (at most) $\\sigma$ children ($\\sigma$ = alphabet size, e.g., 26 for lowercase English). Inserting a string of length $L$ takes $O(L)$. Looking up a prefix takes $O(L)$ and finds all words with that prefix. This makes tries the canonical structure for autocomplete, IP routing tables (longest prefix match), and phone directories. The cost: memory. Each node stores $\\sigma$ child pointers; for a sparse alphabet, most are null. Mitigation: **compressed tries** (Patricia/radix trees) merge chains of single-child nodes into single edges with string labels, reducing node count to $O(n)$ where $n$ is the number of strings.",
            "A **radix tree** (compressed trie) stores compressed paths and is used in the Linux kernel's VFS layer for path resolution and in IPv4/IPv6 longest-prefix-match routing. The key operation is **path compression**: a chain of nodes with one child each is replaced by a single node with an edge labeled with the concatenated characters. The Linux `lib/radix-tree.c` uses a radix tree with 64-way branching (one 6-bit chunk per level) for mapping inode numbers to page cache entries.",
            "A **suffix trie** of a string $S$ contains all suffixes of $S$ as paths from the root. Every substring of $S$ corresponds to a prefix of some suffix, i.e., a path in the trie. Searching for a pattern $P$ takes $O(|P|)$ regardless of $|S|$. However, the suffix trie of $S$ has $O(|S|^2)$ nodes (a suffix of length $k$ adds $k$ nodes). **Suffix trees** (compact suffix tries) reduce this to $O(|S|)$ nodes via path compression, achieving $O(|P|)$ search in $O(|S|)$ space. Ukkonen's algorithm constructs the suffix tree online in $O(|S|)$ time. Applications: longest repeated substring, longest common substring of two strings, and the core of bioinformatics sequence alignment.",
            "A **suffix array** is a sorted array of all suffix start indices of a string. The suffix array of `banana` is `[5,3,1,0,4,2]` (corresponding to suffixes `a`, `ana`, `anana`, `banana`, `na`, `nana`). The suffix array enables $O(|P| \\log |S|)$ pattern search (binary search on the sorted suffixes) and can be augmented with the **LCP array** (longest common prefix between adjacent suffixes in sorted order) for $O(|P|)$ search. The SA-IS algorithm constructs suffix arrays in $O(n)$ time. Suffix arrays are the practical alternative to suffix trees: same asymptotic power, smaller constant, better cache behavior, and simpler to implement.",
            "The **LCP array** and **RMQ** combine to answer 'length of the longest common substring of two positions in a suffix array' in $O(1)$ after $O(n)$ preprocessing. The canonical bioinformatics tool: a genome is a long string; finding all occurrences of a gene (pattern) is suffix array search. Finding the longest common substring of two genomes is suffix array + LCP + RMQ. The competitive programming equivalent: string hashing (Rabin-Karp) offers $O(n)$ construction and $O(1)$ substring comparison but with false-positive probability $\\sim 1/p$ per query; suffix arrays offer deterministic results at $O(n \\log n)$ or $O(n)$ construction.",
          ],
          resources: [
            { label: "CP-Algorithms - Suffix Array", url: "https://cp-algorithms.com/string/suffix-array.html", type: "docs" },
            { label: "Stanford CS97SI - Suffix array notes (PDF)", url: "https://web.stanford.edu/class/cs97si/suffix-array.pdf", type: "course" },
            { label: "Linux kernel radix tree", url: "https://www.kernel.org/doc/html/latest/core-api/radix-tree.html", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "CP-Algorithms - Segment Tree", url: "https://cp-algorithms.com/data_structures/segment_tree.html", type: "docs" },
        { label: "CP-Algorithms - Fenwick Tree", url: "https://cp-algorithms.com/data_structures/fenwick.html", type: "docs" },
        { label: "B-Trees - CLRS chapter (MIT OCW notes)", url: "https://ocw.mit.edu/courses/6-046j-design-and-analysis-of-algorithms-spring-2015/", type: "course" },
        { label: "VisuAlgo - BST / AVL / B-tree", url: "https://visualgo.net/en/bst", type: "tool" },
      ],
      connections: [
        { to: "web-databases", note: "B+ trees ARE the PostgreSQL/MySQL index - same structure, on disk" },
        { to: "os-filesystems", note: "ext4 extent trees and directory indexes are B-tree variants" },
        { to: "web3-fundamentals", note: "Merkle trees are hash-augmented binary trees - the inclusion-proof backbone of blockchains" },
      ],
    },
    {
      id: "dsa-hashing",
      title: "Hashing & probabilistic structures",
      level: "Intermediate",
      body: [
        "Hash functions (djb2, MurmurHash3, xxHash) and the **avalanche** property; collision resolution (chaining vs open addressing, **Robin Hood hashing**); load factor and the amortized-O(1) rehash proof.",
        "Then the probabilistic family that powers real systems at scale: **Bloom filters** (false-positive math, used in LevelDB/Cassandra to skip disk reads) and **Count-Min sketch** for streaming frequency estimation.",
      ],
      subtopics: [
        {
          title: "Hash functions: design, avalanche, and distribution",
          body: [
            "A hash function maps a key of arbitrary size to an integer in $[0, 2^b)$. The key properties: **deterministic** (same input always produces the same output), **uniform** (output is uniformly distributed over the range for typical inputs), **avalanche effect** (changing one input bit flips ~50% of output bits), and **fast to compute** (ideally single-digit nanoseconds). Cryptographic hash functions (SHA-256) add **preimage resistance** and **collision resistance** at the cost of speed; non-cryptographic hash functions (MurmurHash3, xxHash, FNV) maximize speed and uniformity without cryptographic guarantees.",
            "**djb2** (`hash = hash * 33 ^ c`) and **FNV-1a** are the simplest: iterate over bytes, mixing each byte with a polynomial or XOR-multiply combination. They are fast but have poor avalanche for structured inputs (e.g., integer keys where only the low bits vary). **MurmurHash3** (by Austin Appleby) processes 4 bytes at a time with multiply-rotate-XOR mixing, achieving excellent avalanche and speed (~3 GB/s). **xxHash** (Cyan4973) is faster still (~10 GB/s) and is used in LZ4, RocksDB, and ClickHouse. **CityHash** (Google) is optimized for strings up to 32 bytes and is used in Protocol Buffers.",
            "The **birthday paradox** governs collision probability: with $n$ keys in a table of size $m$, the expected number of collisions is $n^2 / (2m)$. For a table of size $m = n$ (load factor 1), there is roughly $n/2$ expected collisions even with a perfect hash function. The **load factor** $\\alpha = n/m$ is the key variable: for chaining, operations cost $O(1 + \\alpha)$ on average; for open addressing, $O(1/(1-\\alpha))$ which diverges as $\\alpha \\to 1$. Standard practice: resize when $\\alpha > 0.7$ (open addressing) or $\\alpha > 2$ (chaining).",
            "**Universal hashing** is a family of hash functions $H = \\{h_1, h_2, ..\\}$ such that for any two distinct keys $x, y$, $\\Pr_{h \\in H}[h(x) = h(y)] \\le 1/m$. Using a randomly chosen function from $H$ guarantees $O(1)$ expected operations regardless of the input distribution - even an adversary who knows the algorithm cannot construct a worst-case input without knowing which function was chosen. This is the theoretical basis for **hash randomization** (Python's `PYTHONHASHSEED`, Java's `hashCode()` randomization), which prevents **hash flooding attacks** where an adversary sends inputs that all map to the same bucket, degrading a hash table to $O(n)$ per operation.",
          ],
          resources: [
            { label: "xxHash - high-speed hashing algorithm", url: "https://github.com/Cyan4973/xxHash", type: "repo" },
            { label: "MurmurHash3 - Appleby", url: "https://github.com/aappleby/smhasher", type: "repo" },
            { label: "CLRS Chapter 11 - Hash Tables", url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/", type: "book" },
          ],
        },
        {
          title: "Collision resolution: chaining, open addressing, and Robin Hood",
          body: [
            "**Separate chaining** stores each bucket as a linked list (or, in recent implementations, a BST for large buckets - Java HashMap since Java 8 converts chains of length >8 to red-black trees). Insertion and lookup are $O(1 + \\alpha)$ average. The constant factor is poor: each bucket access involves a pointer dereference to the chain, which is a potential cache miss. Separate chaining is the standard in language runtimes (Python dict until 3.6, Java HashMap, C++ `std::unordered_map` in most implementations) due to its simplicity and robustness.",
            "**Open addressing** stores all keys in a flat array; collisions are resolved by probing for the next open slot. **Linear probing** checks consecutive slots: `(h(k) + i) % m` for $i = 0, 1, 2, ...$. Excellent cache performance (sequential memory access) but suffers from **primary clustering**: long runs of occupied slots form, slowing future lookups. **Quadratic probing** (`(h(k) + i^2) % m`) reduces clustering but requires $m$ to be a power of two or prime to guarantee all slots are visited. **Double hashing** (`(h1(k) + i * h2(k)) % m`) uses a second hash to determine the step size, eliminating clustering at the cost of worse cache behavior.",
            "**Robin Hood hashing** is the modern open-addressing strategy that eliminates primary clustering's worst case. Each key has a **probe length** (the number of slots it has been displaced from its ideal position). On insertion, if the incoming key has a longer probe length than the key currently occupying a slot, they swap (the richer 'Robin Hood' key gives its slot to the poorer one). This equalizes probe lengths across all keys, keeping the maximum probe length $O(\\log n)$ with high probability. On lookup, if the current slot's probe length is less than the key being searched, the key does not exist (early termination). Robin Hood hashing is used in Rust's `std::collections::HashMap`, Abseil's `flat_hash_map`, and many high-performance hash table implementations.",
            "**Cuckoo hashing** uses two hash functions and two tables. Each key can occupy one of two positions: `h1(k)` in table 1 or `h2(k)` in table 2. Lookup is $O(1)$ worst case (check two positions). Insertion may need to evict the current occupant of a position and reinsert it in its alternate position, potentially causing a cascade. If the cascade exceeds a threshold, rehash. Expected insertion time is $O(1)$ with load factor $< 0.5$; lookup is always $O(1)$. Cuckoo hashing is used in network switches (hardware hash tables with strict $O(1)$ lookup requirements) and some cryptographic protocols.",
          ],
          resources: [
            { label: "Robin Hood Hashing - Sebastion Sylvan (blog)", url: "https://www.sebastiansylvan.com/post/robin-hood-hashing-should-be-your-default-hash-table-implementation/", type: "docs" },
            { label: "Abseil flat_hash_map design notes", url: "https://abseil.io/about/design/swisstables", type: "docs" },
          ],
        },
        {
          title: "Bloom filters and Count-Min sketches",
          body: [
            "A **Bloom filter** is a space-efficient probabilistic set: it can tell you 'definitely not in the set' or 'probably in the set'. It uses a bit array of size $m$ and $k$ independent hash functions. On insertion of key $x$: set bits `h1(x) % m`, `h2(x) % m`, ..., `hk(x) % m`. On query: if any of those bits is 0, $x$ is definitely not in the set. If all are 1, $x$ is probably in the set (false positive possible). **False positive rate**: $\\approx (1 - e^{-kn/m})^k$. Optimal $k$ for given $m$ and $n$: $k = (m/n) \\ln 2 \\approx 0.693 m/n$. At optimal $k$, the false positive rate is $\\approx (0.618)^{m/n}$. For 1% false positives, you need $m/n \\approx 9.6$ bits per element - far smaller than storing the keys themselves.",
            "**Real-world Bloom filter deployments**: LevelDB and RocksDB use a Bloom filter per SSTable - before reading a disk page to check if a key exists, consult the Bloom filter. A negative result skips the disk read entirely, saving the dominant cost in an LSM-tree read path. Cassandra uses Bloom filters to avoid reading from SSTables that do not contain a key. Chrome's Safe Browsing uses a Bloom filter to check URLs against a list of malicious sites locally before making a network request. PostgreSQL's index scans can use a Bloom filter for multi-column queries. The common pattern: Bloom filter as a cheap pre-filter that avoids expensive operations for definite negatives.",
            "The **Count-Min sketch** extends Bloom filters to frequency estimation. Use $d$ hash functions and a $d \\times w$ array of counters. On increment for key $x$: add 1 to `table[i][hi(x) % w]` for each row $i$. On query: return `min(table[i][hi(x) % w])` over all rows. This is the minimum because collisions only inflate counts (never deflate), so the minimum over independent hash functions gives the best estimate. Error bound: the true count $f_x$ satisfies $f_x \\le \\hat{f_x} \\le f_x + \\epsilon N$ with probability $1 - \\delta$ for $w = e/\\epsilon$ and $d = \\ln(1/\\delta)$. The sketch uses $O((1/\\epsilon) \\log(1/\\delta))$ space regardless of the number of distinct keys. Application: network traffic anomaly detection (which IP pairs are sending the most bytes), trending topics on Twitter, approximate join size estimation in databases.",
            "**HyperLogLog** estimates the number of distinct elements in a stream (cardinality estimation) using $O(\\log \\log n)$ space per register. The key observation: for a hash function uniformly distributed in $[0, 1)$, the maximum number of leading zeros in the binary representation of $h(x)$ for keys $x_1, ..., x_n$ is approximately $\\log_2 n$. HyperLogLog uses multiple independent estimates and harmonically averages them to reduce variance. Redis `PFCOUNT` uses HyperLogLog with 1.04% standard error using only 1.5KB of memory - you can count billions of distinct users with 1.5KB and 1% error. PostgreSQL's query planner uses HyperLogLog to estimate `COUNT(DISTINCT col)` for planning.",
          ],
          resources: [
            { label: "Bloom filter - Jason Davies interactive demo", url: "https://www.jasondavies.com/bloomfilter/", type: "tool" },
            { label: "Count-Min Sketch - original paper (Cormode & Muthukrishnan)", url: "https://cs.stackexchange.com/questions/44803/how-does-count-min-sketch-work", type: "docs" },
            { label: "Redis HyperLogLog documentation", url: "https://redis.io/docs/data-types/probabilistic/hyperloglogs/", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "CP-Algorithms - Hashing", url: "https://cp-algorithms.com/string/string-hashing.html", type: "docs" },
        { label: "Robin Hood Hashing - original paper context (Sebastian Sylvan)", url: "https://www.sebastiansylvan.com/post/robin-hood-hashing-should-be-your-default-hash-table-implementation/", type: "docs" },
        { label: "Bloom Filters - interactive explainer (Jason Davies)", url: "https://www.jasondavies.com/bloomfilter/", type: "tool" },
      ],
      connections: [
        { to: "web-databases", note: "Redis, LevelDB and Cassandra lean on hash tables + Bloom filters internally" },
        { to: "crypto-symmetric", note: "Cryptographic hashes (SHA-256) add collision-resistance on top of the same idea" },
        { to: "dsa-strings", note: "Rolling hashes (Rabin-Karp) are hashing applied to substrings" },
      ],
    },
    {
      id: "dsa-graphs",
      title: "Graphs: traversal, shortest paths, flow",
      level: "Intermediate → Advanced",
      body: [
        "Representations (adjacency list vs matrix vs **CSR** - the sparse layout used in scientific computing and GNNs). DFS/BFS and *all* their applications: cycle detection, topological sort, bipartiteness, **Union-Find** (union-by-rank + path compression → inverse-Ackermann).",
        "Shortest paths (Dijkstra - and *why* no negative edges - Bellman-Ford, Johnson's), MSTs (Kruskal/Prim), and **network flow** (Dinic's, min-cost max-flow) which quietly solves a huge class of assignment/matching problems.",
      ],
      subtopics: [
        {
          title: "Graph representations and the CSR format",
          body: [
            "A graph $G = (V, E)$ with $n$ vertices and $m$ edges can be stored three ways. **Adjacency matrix**: $n \\times n$ array where `A[i][j] = 1` if edge $(i,j)$ exists. Edge lookup is $O(1)$; iterating neighbors is $O(n)$; space is $O(n^2)$. Suitable for dense graphs ($m = O(n^2)$) and algorithms that need $O(1)$ edge existence queries (Floyd-Warshall). Impractical for sparse graphs (a billion-node web graph would need petabytes).",
            "**Adjacency list**: array of $n$ lists where `adj[v]` contains the neighbors of $v$. Space is $O(n + m)$. Iterating neighbors of $v$ takes $O(\\deg(v))$ - the dominant operation in DFS/BFS/Dijkstra. The standard for sparse graphs. In C++, `vector<vector<int>>` or `vector<pair<int,int>>` sorted by source vertex (a static adjacency list). Edge lookup is $O(\\deg(v))$ (scan the list), so algorithms that need frequent edge lookup (dense dynamic graphs) prefer the adjacency matrix.",
            "**CSR (Compressed Sparse Row)**: the format used in scientific computing, graph neural networks (PyTorch Geometric, DGL), and high-performance graph processing (GraphBLAS, Galois). Two arrays: `col_indices` (concatenated adjacency lists in sorted order) and `row_ptr` (prefix sums: `row_ptr[v]` and `row_ptr[v+1]` delimit the neighbors of vertex $v$ in `col_indices`). Space: $O(n + m)$. Neighbor iteration: `col_indices[row_ptr[v]..row_ptr[v+1]]`. Cache-friendly: iterating all edges of $v$ is a contiguous memory scan. Building CSR requires sorting edges by source vertex - $O(m \\log m)$ or $O(m)$ with counting sort on dense vertex IDs. CSR is the graph format behind every GNN library's `edge_index` tensor.",
            "**Directed vs undirected**: in an undirected graph, edges are symmetric (store each edge twice in adjacency lists). **Weighted graphs** add a weight to each edge (third dimension in adjacency list: `adj[v]` stores `(neighbor, weight)` pairs). **Multigraphs** allow multiple edges between the same pair of vertices - not directly supported by the standard representations but arise in flow networks (you can add parallel edges). **Bipartite graphs** have vertices partitioned into two sets $U$ and $V$ with all edges between $U$ and $V$ (no edges within a set). Bipartiteness can be checked with BFS 2-coloring.",
          ],
          resources: [
            { label: "PyTorch Geometric - CSR graph format", url: "https://pytorch-geometric.readthedocs.io/en/latest/notes/sparse_tensor.html", type: "docs" },
            { label: "CP-Algorithms - Graph representations", url: "https://cp-algorithms.com/graph/breadth-first-search.html", type: "docs" },
          ],
        },
        {
          title: "DFS, BFS, and Union-Find",
          body: [
            "**DFS (Depth-First Search)** explores as far as possible before backtracking. Using a stack (implicit via recursion or explicit). DFS on an $n$-vertex $m$-edge graph runs in $O(n + m)$. DFS produces a **DFS tree** and classifies edges: **tree edges** (in the DFS tree), **back edges** (from a descendant to an ancestor - indicate cycles in directed graphs; all non-tree edges in undirected DFS are back edges), **forward edges** (from ancestor to non-child descendant - only in directed graphs), and **cross edges** (all others - only in directed DFS). The classification drives algorithms: back edges detect cycles; topological sort uses DFS with finish times.",
            "**Topological sort** of a DAG (directed acyclic graph): run DFS, appending each vertex to the output list when it finishes (all descendants processed). Reverse the output list. This is the correct topological order. Alternatively: Kahn's algorithm (BFS-based, using in-degree array). Applications: build systems (Makefile dependency resolution), package managers (npm/pip install order), course prerequisite scheduling, and any task scheduling with dependencies.",
            "**BFS (Breadth-First Search)** explores by layers: all vertices at distance $d$ before any at $d+1$. Uses a queue. Also $O(n + m)$. BFS finds **shortest paths in unweighted graphs** (the BFS tree distances are the true shortest distances). Applications: social network distance (degrees of separation), hexagonal game solver, web crawler (BFS over hyperlinks). BFS on a bipartite check: 2-color with BFS; if any two adjacent vertices get the same color, not bipartite.",
            "**Union-Find (Disjoint Set Union / DSU)** maintains a partition of elements into groups, supporting two operations: `find(x)` (returns the representative of $x$'s group) and `union(x, y)` (merges the groups of $x$ and $y$). Two optimizations reduce amortized cost to $O(\\alpha(n)) \\approx O(1)$ per operation where $\\alpha$ is the inverse Ackermann function (effectively constant for all practical $n$): **Union by rank** (always attach the smaller tree under the root of the larger, keeping trees shallow) and **path compression** (`find` flattens the path by making every node point directly to the root). Together: the Tarjan-van Leeuwen theorem guarantees $O(m \\alpha(n))$ total for $m$ operations. Applications: Kruskal's MST, connected components, and in compilers (equivalence class tracking for type inference).",
            "**Strongly connected components (SCC)**: in a directed graph, an SCC is a maximal set of vertices where every vertex is reachable from every other. **Tarjan's algorithm** computes all SCCs in $O(n + m)$ via DFS with a stack and per-vertex `low` values (the minimum DFS number reachable from the subtree). **Kosaraju's algorithm**: two DFS passes (one on the original graph to get finish order, one on the transposed graph in reverse finish order). Both $O(n+m)$. SCCs appear in: deadlock detection, finding circular dependencies, 2-SAT (each clause is an implication graph; satisfiable iff no variable and its negation are in the same SCC).",
          ],
          resources: [
            { label: "CP-Algorithms - DFS and its applications", url: "https://cp-algorithms.com/graph/depth-first-search.html", type: "docs" },
            { label: "CP-Algorithms - Union-Find (DSU)", url: "https://cp-algorithms.com/data_structures/disjoint_set_union.html", type: "docs" },
            { label: "William Fiset - Graph Theory playlist", url: "https://www.youtube.com/playlist?list=PLDV1Zeh2NRsDGO4--qE8yH72HFL1Km93P", type: "video" },
          ],
        },
        {
          title: "Shortest paths and minimum spanning trees",
          body: [
            "**Dijkstra's algorithm** finds single-source shortest paths in $O((n + m) \\log n)$ (with a binary heap priority queue) or $O(n^2)$ (with a naive array). The invariant: vertices are settled in non-decreasing distance order. At each step, extract the minimum-distance unsettled vertex $u$, then relax all edges from $u$: if `dist[v] > dist[u] + w(u,v)`, update `dist[v]`. **Why negative edges break Dijkstra**: if a vertex $u$ is settled, we assume `dist[u]` is final. A negative edge from a later vertex back to $u$'s neighbor could produce a shorter path - Dijkstra does not revisit settled vertices, so it misses this. Negative edges require Bellman-Ford.",
            "**Bellman-Ford** relaxes all $m$ edges $n-1$ times: $O(nm)$. After $n-1$ rounds, all shortest paths are found (a shortest path has at most $n-1$ edges). A negative cycle exists if any edge can still be relaxed after $n-1$ rounds. Bellman-Ford is used in distance-vector routing protocols (BGP uses a variant) and in arbitrage detection (negative cycle in a log-weight currency graph means profit). **SPFA (Shortest Path Faster Algorithm)** is Bellman-Ford with a queue (only relax neighbors of recently updated vertices) - faster in practice but still $O(nm)$ worst case (hackable in competitive programming).",
            "**Floyd-Warshall** finds all-pairs shortest paths in $O(n^3)$: `dp[k][i][j]` = shortest path from $i$ to $j$ using only intermediate vertices $\\le k$. Transition: `dp[k][i][j] = min(dp[k-1][i][j], dp[k-1][i][k] + dp[k-1][k][j])`. Handles negative edges (not negative cycles). Space-optimized to $O(n^2)$ (drop the $k$ dimension). **Johnson's algorithm** achieves all-pairs in $O(nm + n^2 \\log n)$ by reweighting edges to eliminate negatives (using Bellman-Ford potentials), then running Dijkstra from every vertex.",
            "**Minimum Spanning Tree (MST)**: a spanning tree of minimum total edge weight. **Kruskal's**: sort edges by weight, add edge if it does not create a cycle (Union-Find for cycle detection). $O(m \\log m)$. Greedy correctness via the **cut property**: for any cut of the graph, the minimum weight crossing edge is in some MST. **Prim's**: greedily grow the MST from an arbitrary root, always adding the minimum-weight edge crossing the current tree frontier. $O((n + m) \\log n)$ with a priority queue. MST applications: network design (minimum cable to connect all offices), clustering (remove the maximum edge from the MST to get two clusters), and Boruvka's algorithm (used in parallel MST computation).",
          ],
          resources: [
            { label: "CP-Algorithms - Dijkstra's algorithm", url: "https://cp-algorithms.com/graph/dijkstra.html", type: "docs" },
            { label: "CP-Algorithms - Bellman-Ford", url: "https://cp-algorithms.com/graph/bellman_ford.html", type: "docs" },
            { label: "CSES - Graph section (shortest paths problems)", url: "https://cses.fi/problemset/", type: "practice" },
          ],
        },
        {
          title: "Network flow: max-flow, min-cut, and applications",
          body: [
            "**Network flow** models a directed graph where each edge has a **capacity** $c(u,v)$ and a **flow** $f(u,v)$ satisfying flow conservation (flow in = flow out at every non-source/sink vertex) and capacity constraints ($0 \\le f(u,v) \\le c(u,v)$). The **maximum flow** is the maximum total flow from source $s$ to sink $t$. The **max-flow min-cut theorem** (Ford-Fulkerson, 1956): the maximum flow equals the minimum capacity cut separating $s$ from $t$. This is one of the most important theorems in combinatorics - it connects a flow optimization to a graph structure theorem.",
            "**Ford-Fulkerson** finds augmenting paths from $s$ to $t$ in the **residual graph** (adding backward edges with remaining capacity) using DFS, saturating each path. Complexity depends on the augmenting path selection and can be unbounded for irrational capacities. **Edmonds-Karp** uses BFS to find the shortest augmenting path (fewest edges), guaranteeing $O(nm^2)$. **Dinic's algorithm** uses **blocking flows** in a layered graph (BFS to build layers, DFS to find multiple non-overlapping augmenting paths per round), achieving $O(n^2 m)$ general case and $O(m \\sqrt{n})$ for unit-capacity graphs (competitive programming standard).",
            "**Bipartite matching** is a special case of max-flow: connect source to all left vertices (capacity 1), right vertices to sink (capacity 1), left-right edges have capacity 1. Max flow = maximum matching size. **Hopcroft-Karp** solves bipartite matching in $O(m \\sqrt{n})$ using alternating BFS+DFS rounds. **Hall's theorem**: a bipartite graph has a perfect matching iff for every subset $S$ of left vertices, $|N(S)| \\ge |S|$ (every subset of left vertices has enough right neighbors to match). Applications: task assignment (assign tasks to workers), edge coloring, scheduling.",
            "**Min-cost max-flow (MCMF)** adds costs to edges and finds the maximum flow with minimum total cost. Algorithm: find minimum-cost augmenting paths using **SPFA** (Bellman-Ford on the residual graph, handling negative cost backward edges) or **successive shortest paths** with potential-based Dijkstra. $O(n m \\log n \\cdot \\text{MaxFlow})$. MCMF models: optimal assignment problems (Kuhn-Munkres / Hungarian algorithm is a special case), transportation problems, and circulation problems. In competitive programming, MCMF solves: 'minimum cost to match workers to jobs', 'minimum penalty to schedule tasks', and any problem with both a maximization objective and a cost to minimize.",
          ],
          resources: [
            { label: "CP-Algorithms - Maximum flow: Dinic's algorithm", url: "https://cp-algorithms.com/graph/dinic.html", type: "docs" },
            { label: "William Fiset - Network flow playlist", url: "https://www.youtube.com/playlist?list=PLDV1Zeh2NRsAsbafOroUBnNV8fhZa7z13", type: "video" },
            { label: "Stanford ICPC notebook - flow", url: "https://github.com/kth-competitive-programming/kactl", type: "repo" },
          ],
        },
      ],
      resources: [
        { label: "William Fiset - Graph Theory playlist", url: "https://www.youtube.com/playlist?list=PLDV1Zeh2NRsDGO4--qE8yH72HFL1Km93P", type: "video" },
        { label: "CP-Algorithms - Graph algorithms", url: "https://cp-algorithms.com/graph/breadth-first-search.html", type: "docs" },
        { label: "CSES Problem Set - Graph section", url: "https://cses.fi/problemset/", type: "practice" },
      ],
      connections: [
        { to: "comp-ssa", note: "Compiler control-flow graphs + dominator/dataflow analysis are graph algorithms" },
        { to: "ai-math", note: "CSR sparse layout and graph traversal underpin GNNs and message passing" },
        { to: "web3-fundamentals", note: "P2P peer discovery uses Kademlia DHT; consensus is graph fork-choice" },
      ],
    },
    {
      id: "dsa-paradigms",
      title: "Design paradigms: sorting, D&C, greedy, DP",
      level: "Advanced",
      body: [
        "The core decision skill: given a problem, name the paradigm. **Sorting** (the $\\Omega(n \\log n)$ decision-tree bound, introsort), **divide & conquer** (Master theorem, **FFT** for convolution/polynomial multiply), **greedy** (exchange-argument proofs, matroids), and **dynamic programming** in all its forms - DP on trees, bitmask DP (TSP), digit DP, matrix exponentiation, and the convex-hull-trick / Knuth optimizations.",
        "DP is the single highest-leverage topic in this domain because it reappears literally everywhere downstream (Bellman equations in RL, sequence alignment, parsing).",
      ],
      subtopics: [
        {
          title: "Sorting: the Ω(n log n) bound and modern implementations",
          body: [
            "**Comparison-based sorting** has a lower bound of $\\Omega(n \\log n)$ comparisons. Proof via **decision trees**: any comparison-based sort produces a binary decision tree where each internal node is a comparison and each leaf is a permutation of the input. There are $n!$ possible permutations, so the tree has $n!$ leaves. A binary tree with $L$ leaves has height $\\ge \\log_2 L$. By Stirling's approximation, $\\log_2 n! \\approx n \\log_2 n - n \\log_2 e = \\Theta(n \\log n)$. Therefore, any comparison-based sort requires $\\Omega(n \\log n)$ comparisons in the worst case.",
            "**Merge sort** achieves $O(n \\log n)$ worst-case with $O(n)$ extra space. The recurrence is $T(n) = 2T(n/2) + O(n)$, solved to $T(n) = O(n \\log n)$ by the Master theorem. Merge sort is stable (equal elements preserve relative order), which is important for multi-key sorting (sort by secondary key first, then primary key stably). External merge sort (for data too large for RAM) splits the data into sorted runs, writes them to disk, and merges $k$ runs at a time using a min-heap of the front elements.",
            "**Quicksort** has expected $O(n \\log n)$ with in-place $O(\\log n)$ extra space (the recursion stack). With random pivot selection, worst-case is $O(n^2)$ with probability $1/n!$. The key insight: a good pivot (near the median) halves the problem. **Introsort** (the standard library sort in C++, Java, Python) starts with quicksort, switches to heapsort if recursion depth exceeds $2 \\log n$ (preventing $O(n^2)$ worst case), and switches to insertion sort for small subarrays ($n < 16$) where the constant is smaller. This achieves $O(n \\log n)$ worst case with cache-friendly average behavior.",
            "**Non-comparison sorts**: **counting sort** ($O(n + k)$ for keys in $[0, k)$) uses a frequency array. **Radix sort** ($O(d(n + k))$ for $d$ digits with base $k$) applies counting sort digit by digit, from least significant to most significant. **Bucket sort** distributes uniformly distributed keys into $n$ buckets and sorts each bucket (insertion sort). These achieve $O(n)$ for specific key distributions. Radix sort is used in GPU parallel sorting (keys are bit-partitioned into rounds), and in memory allocators (free list bucketed by size class).",
            "**The practical order**: for small arrays, insertion sort wins (sequential memory, small constants). For medium arrays, quicksort wins (cache-friendly in-place). For large or adversarial inputs, introsort or merge sort. For nearly sorted data, **Timsort** (Python's sort, Java's Arrays.sort for objects) exploits existing sorted runs via adaptive merging. Timsort finds natural runs (already-sorted sequences) in the data and merges them using a merge strategy that guarantees $O(n)$ for already-sorted data and $O(n \\log n)$ in general.",
          ],
          resources: [
            { label: "CLRS Chapter 7-8 - Quicksort, Linear Sorts", url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/", type: "book" },
            { label: "Timsort - Python documentation", url: "https://docs.python.org/3/howto/sorting.html", type: "docs" },
          ],
        },
        {
          title: "Divide and conquer: Master theorem and FFT",
          body: [
            "**Divide and conquer** reduces a problem of size $n$ to $a$ subproblems of size $n/b$, with combine cost $O(n^c)$. The **Master theorem** gives the asymptotic solution: if $T(n) = aT(n/b) + O(n^c)$, then: if $c < \\log_b a$, $T(n) = O(n^{\\log_b a})$ (subproblems dominate); if $c = \\log_b a$, $T(n) = O(n^c \\log n)$ (balanced); if $c > \\log_b a$, $T(n) = O(n^c)$ (combine dominates). Merge sort: $a=2$, $b=2$, $c=1$, $\\log_b a = 1 = c$, so $O(n \\log n)$. Binary search: $a=1$, $b=2$, $c=0$, $\\log_b a = 0 = c$, so $O(\\log n)$.",
            "**Karatsuba multiplication** multiplies two $n$-digit numbers using 3 recursive multiplications of $n/2$-digit numbers instead of 4 (naive): $T(n) = 3T(n/2) + O(n)$, giving $O(n^{\\log_2 3}) \\approx O(n^{1.585})$ vs $O(n^2)$ for schoolbook multiplication. The trick: compute $A_1 B_1$, $A_0 B_0$, and $(A_1 + A_0)(B_1 + B_0)$; the middle term $(A_1 B_0 + A_0 B_1)$ is recovered from the third product minus the first two. Karatsuba is used in Python's `long` multiplication for large integers.",
            "**FFT (Fast Fourier Transform)** computes the Discrete Fourier Transform of a length-$n$ sequence in $O(n \\log n)$ instead of $O(n^2)$. The DFT of sequence $a$: $A[k] = \\sum_{j=0}^{n-1} a[j] \\omega^{jk}$ where $\\omega = e^{2\\pi i/n}$. The Cooley-Tukey FFT exploits that $\\omega^{n/2} = -1$ to split the DFT into two half-length DFTs (even and odd indices), recursively. **Polynomial multiplication** via FFT: convolve arrays $a$ and $b$ by computing $\\text{IFFT}(\\text{FFT}(a) \\cdot \\text{FFT}(b))$ in $O(n \\log n)$. This is the algorithm behind multiplying large integers (NTT = FFT over a finite field, integer arithmetic), signal processing (audio convolution), and image filtering (2D FFT).",
            "**Closest pair of points** in 2D: divide the points into left and right halves by $x$-coordinate, recursively find the closest pair in each half, then check pairs straddling the dividing line (only points within distance $\\delta$ of the line, where $\\delta$ is the minimum of the two half-distances). The critical insight: in the strip, at most 8 points can be within distance $\\delta$ of any given point (a packing argument), so the strip check is $O(n)$. Total: $O(n \\log n)$. This problem class - divide by geometry, combine in a strip - recurs in computational geometry.",
          ],
          resources: [
            { label: "CP-Algorithms - FFT", url: "https://cp-algorithms.com/algebra/fft.html", type: "docs" },
            { label: "MIT 6.006 - Divide and conquer, FFT", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/", type: "course" },
          ],
        },
        {
          title: "Greedy algorithms and exchange arguments",
          body: [
            "A greedy algorithm makes locally optimal choices at each step, never reconsidering. Proving a greedy correct requires either an **exchange argument** (assume some optimal solution disagrees with the greedy on the first choice; show you can swap the greedy's choice in without making the solution worse - contradiction) or a **matroid structure** (if the problem has matroid structure, greedy is optimal). Greedy is wrong in many cases: the canonical counterexample is the change-making problem with non-standard coin denominations (greedy fails for coins {1, 3, 4} and amount 6: greedy gives {4,1,1}, optimal is {3,3}).",
            "**Interval scheduling** (maximize the number of non-overlapping intervals): sort by end time, greedily pick each interval that starts after the last picked interval ends. Proof: exchange argument - if OPT picks a different first interval, swap it with the greedy's choice (which ends no later) without decreasing the number of intervals, then apply inductively. This is the canonical greedy proof. Variants: interval scheduling maximization (weighted intervals → DP), interval partitioning (minimum number of rooms to schedule all intervals without conflicts → greedy by start time with a priority queue of room end times).",
            "**Huffman coding** builds an optimal prefix-free code by greedily merging the two lowest-frequency symbols into a combined node, iterating. Proof via the **greedy choice property**: in any optimal tree, the two symbols with the lowest frequency have the deepest positions (exchange argument: swapping them to the deepest position never increases total cost). Huffman coding is used in DEFLATE (gzip, PNG, zip), JPEG, and MP3. The connection to information theory: optimal Huffman code lengths approximate $-\\log_2 p_i$ bits for symbol $i$ with probability $p_i$, matching Shannon's entropy bound.",
            "**Matroids** generalize the exchange property that makes greedy optimal. A matroid is a pair $(S, \\mathcal{I})$ where $\\mathcal{I}$ (the independent sets) satisfies: empty set is independent; every subset of an independent set is independent; if $|A| < |B|$ and both are independent, some element of $B \\setminus A$ can be added to $A$ while preserving independence (the exchange property). Kruskal's MST algorithm is greedy on the **graphic matroid** (independent sets = forests). Scheduling unit-interval jobs with deadlines to maximize profit is greedy on a **partition matroid**. Knowing a problem has matroid structure immediately guarantees the greedy solution is optimal.",
          ],
          resources: [
            { label: "CLRS Chapter 16 - Greedy algorithms", url: "https://mitpress.mit.edu/9780262046305/introduction-to-algorithms/", type: "book" },
            { label: "CP-Algorithms - Greedy algorithms overview", url: "https://cp-algorithms.com/greedy/", type: "docs" },
          ],
        },
        {
          title: "Dynamic programming: from memoization to matrix exponentiation",
          body: [
            "**Dynamic programming** solves problems with **optimal substructure** (optimal solution uses optimal solutions to subproblems) and **overlapping subproblems** (same subproblems recomputed multiple times in naive recursion). Two equivalent formulations: **top-down memoization** (recursive with a cache) and **bottom-up tabulation** (iterative, filling a table in topological order of subproblems). The standard recipe: (1) define the subproblems, (2) write the recurrence, (3) identify the base cases, (4) determine the evaluation order, (5) read off the answer. Getting step 1 right is 80% of the difficulty.",
            "**Interval DP**: `dp[l][r]` = optimal solution for the subarray $[l, r]$. Fill in increasing order of interval length. Classic problems: matrix chain multiplication (minimize parenthesization cost: $O(n^3)$), optimal BST construction, palindrome partitioning, burst balloons, and the **stone merging** problem. The evaluation order is always 'smaller intervals before larger ones'.",
            "**DP on trees**: `dp[v]` is defined by recursing on children of $v$, then combining. Tree DP is evaluated bottom-up via DFS post-order. Problems: maximum independent set on a tree (include $v$ or exclude $v$, transition depends on children), tree diameter (longest path between any two vertices), and rerooting DP (compute `dp[v]` for all choices of root in $O(n)$ by combining a bottom-up pass with a top-down re-rooting pass).",
            "**Bitmask DP**: state is a bitmask of which elements have been 'used'. State space is $O(2^n \\cdot n)$; transition iterates over elements not yet used. The canonical problem is **TSP (Traveling Salesman Problem)**: `dp[mask][v]` = minimum cost to visit exactly the vertices in `mask`, ending at $v$. $O(2^n n^2)$. Bitmask DP also solves: minimum vertex cover, optimal tournament scheduling, and any problem where the state is 'which subset of $n \\le 20$ items have been selected'.",
            "**Matrix exponentiation** computes the $n$-th term of a linear recurrence in $O(k^3 \\log n)$ where $k$ is the number of terms in the recurrence, by raising the companion matrix to the $n$-th power via fast matrix exponentiation (repeated squaring). Fibonacci: $\\begin{pmatrix} F_{n+1} \\\\ F_n \\end{pmatrix} = \\begin{pmatrix} 1 & 1 \\\\ 1 & 0 \\end{pmatrix}^n \\begin{pmatrix} 1 \\\\ 0 \\end{pmatrix}$. Applications: counting paths of length exactly $n$ in a graph (matrix power of adjacency matrix), tiling problems with linear recurrences, and modular linear recurrences. The **Cayley-Hamilton theorem** implies every linear recurrence satisfies a polynomial in its transition matrix, bounding the state space.",
          ],
          resources: [
            { label: "Competitive Programmer's Handbook - Chapters 6-7 (free PDF)", url: "https://cses.fi/book/book.pdf", type: "book" },
            { label: "AtCoder Educational DP Contest - 26 DP problems", url: "https://atcoder.jp/contests/dp", type: "practice" },
            { label: "CSES Problem Set - Dynamic Programming section", url: "https://cses.fi/problemset/", type: "practice" },
          ],
        },
      ],
      resources: [
        { label: "Competitive Programmer's Handbook (free PDF)", url: "https://cses.fi/book/book.pdf", type: "book", note: "Laaksonen - read cover to cover" },
        { label: "CSES Problem Set - 300 problems", url: "https://cses.fi/problemset/", type: "practice", note: "solving all ≈ competitive" },
        { label: "AtCoder Educational DP Contest", url: "https://atcoder.jp/contests/dp", type: "practice" },
        { label: "FFT - CP-Algorithms", url: "https://cp-algorithms.com/algebra/fft.html", type: "docs" },
      ],
      connections: [
        { to: "ai-rl", note: "Value/policy iteration are dynamic programming on the Bellman equation" },
        { to: "quant-options", note: "Binomial option pricing is backward-induction DP on a tree" },
        { to: "comp-parsing", note: "CYK parsing is DP; the Master theorem governs parser/optimizer complexity" },
      ],
    },
    {
      id: "dsa-strings",
      title: "String algorithms",
      level: "Advanced",
      body: [
        "**KMP** (understand the failure function, don't memorize it), the **Z-algorithm** (same power, simpler), **Rabin-Karp** rolling hashes, **Aho-Corasick** for multi-pattern matching, and the heavy artillery: **suffix arrays + LCP** ($O(n)$ SA-IS construction) and **suffix automata** for counting distinct substrings.",
        "These power full-text search, bioinformatics, plagiarism/diff tools, and intrusion-detection signature matching.",
      ],
      subtopics: [
        {
          title: "KMP and Z-algorithm: single-pattern matching",
          body: [
            "**Naive string matching** checks every position in the text $T$ of length $n$ for the pattern $P$ of length $m$: $O(nm)$ worst case (e.g., $T = aaa...a$ and $P = aaa...ab$). The insight behind efficient string matching: when a mismatch occurs, the information about matched characters can tell us how far to shift the pattern without missing any occurrences.",
            "**KMP (Knuth-Morris-Pratt)**: precompute the **failure function** (also called partial-match table or prefix function) `f[i]` = length of the longest proper prefix of `P[0..i]` that is also a suffix. Meaning: if a mismatch occurs after matching $i+1$ characters, shift the pattern so that its prefix of length `f[i]` aligns with the already-matched suffix of the text. The failure function is computed in $O(m)$: maintain a pointer $j$ into the pattern; if `P[j] == P[i]`, then `f[i] = j + 1`; else fall back via `j = f[j-1]`. Matching uses $O(n)$ time: each position in the text is advanced at most twice (forward progress, then backtrack via failure function). Total: $O(n + m)$. The failure function is not memorized - it is derived from the observation that it finds the longest border (prefix = suffix) of each prefix.",
            "The **Z-algorithm** computes `Z[i]` = length of the longest common prefix of `S` and `S[i:]`. For pattern matching, concatenate `P + '#' + T` (separator prevents cross-boundary matches) and compute Z-values. Any $i$ in the T-portion with `Z[i] == |P|` is a match. Z-values are computed in $O(n)$ using a window `[l, r]` of the farthest right Z-box found so far. For position $i$ inside `[l, r]`, use the already-computed `Z[i - l]` as a starting estimate, then extend if needed. The algorithm is arguably simpler to derive than KMP (no failure function; just one invariant about the rightmost Z-box).",
            "**Rolling hashes (Rabin-Karp)**: represent a substring as a polynomial evaluated at a base: `h(s) = s[0]*B^(m-1) + s[1]*B^(m-2) + ... + s[m-1]` mod a large prime $p$. Sliding the window by one character: `h(s[1..m]) = (h(s[0..m-1]) - s[0]*B^(m-1)) * B + s[m]`. Computing the new hash from the old takes $O(1)$. Compare hash of the current window to the pattern hash: if they match, verify character by character (to handle collisions). Expected $O(n + m)$ comparisons. The false positive probability per position is $\\sim 1/p$. Use a 64-bit modulus or double hashing (two independent hashes) to reduce collision probability to negligible. Rabin-Karp generalizes to 2D pattern matching and is the basis of the **rolling hash** in rsync's delta-sync algorithm.",
          ],
          resources: [
            { label: "CP-Algorithms - KMP / Prefix Function", url: "https://cp-algorithms.com/string/prefix-function.html", type: "docs" },
            { label: "CP-Algorithms - Z-function", url: "https://cp-algorithms.com/string/z-function.html", type: "docs" },
            { label: "CP-Algorithms - Rabin-Karp", url: "https://cp-algorithms.com/string/rabin-karp.html", type: "docs" },
          ],
        },
        {
          title: "Aho-Corasick: multi-pattern matching automaton",
          body: [
            "**Aho-Corasick** matches all occurrences of all patterns $P_1, ..., P_k$ in a text $T$ simultaneously in $O(|T| + \\sum|P_i| + \\text{matches})$, regardless of how many patterns there are. It constructs a **finite automaton** from all patterns: a trie augmented with **failure links** (analogous to KMP's failure function) and **output links**. The automaton processes text one character at a time, transitioning between states; the current state encodes 'which longest suffix of the scanned text is a prefix of some pattern'.",
            "**Construction**: build a trie of all patterns. Compute failure links via BFS from the root: the failure link of node $v$ points to the node representing the longest proper suffix of $v$'s string that is also a prefix of some pattern. The `goto` function (trie transitions) is completed by setting missing transitions to follow the failure link. **Output links** point from each node to the deepest ancestor (via failure links) that is a complete pattern - this enables reporting all patterns ending at the current position, not just one. Total construction: $O(\\sum|P_i| \\cdot |\\Sigma|)$ with the `goto` table, or $O(\\sum|P_i|)$ with lazy transitions.",
            "**Applications**: **antivirus engines** use Aho-Corasick (or its GPU-accelerated variants) to match thousands of malware signatures against a byte stream in a single pass - YARA rules compile to Aho-Corasick automata. **Network IDS/IPS** (Snort, Suricata) match thousands of attack signatures against network traffic. **grep** with multiple patterns (`-f patterns.txt`) uses Aho-Corasick. **Bioinformatics**: align multiple short reads against a genome simultaneously. The key property is the **single-pass guarantee**: the automaton processes each text character exactly once, and all matches are reported without rescanning.",
            "**Aho-Corasick on DAGs**: competitive programming often asks 'count strings of length $n$ matching none of the banned patterns'. Build the Aho-Corasick automaton on the banned patterns, then count paths of length $n$ in the automaton's graph that avoid accept states - a **DP on the automaton**. This is the canonical 'string enumeration with forbidden substrings' technique, appearing in DNA sequence counting, password policy generation, and robot path planning with forbidden substrings.",
          ],
          resources: [
            { label: "CP-Algorithms - Aho-Corasick", url: "https://cp-algorithms.com/string/aho_corasick.html", type: "docs" },
            { label: "Aho-Corasick original paper (1975)", url: "https://dl.acm.org/doi/10.1145/360825.360855", type: "paper" },
          ],
        },
        {
          title: "Suffix arrays, LCP arrays, and suffix automata",
          body: [
            "A **suffix array** (SA) of string $S$ of length $n$ is the array of starting positions of all $n$ suffixes, sorted lexicographically. Building the SA: naive $O(n^2 \\log n)$ (sort $n$ strings of average length $n/2$). The **prefix doubling** algorithm (DC3/Skew and SA-IS) achieves $O(n)$. The standard competitive-programming construction: sort by first character, then use radix sort to stably sort by first $2^k$ characters for $k = 1, 2, ..., \\log n$. Each step doubles the sorted prefix length using ranks from the previous step. Total: $O(n \\log^2 n)$ with comparison sort or $O(n \\log n)$ with radix sort.",
            "The **LCP array** `lcp[i]` stores the length of the longest common prefix between `SA[i]` and `SA[i-1]` (adjacent suffixes in sorted order). The **Kasai algorithm** computes the full LCP array in $O(n)$ from the suffix array using the observation: if the LCP between suffixes starting at positions $i$ and $j$ is $l$, then the LCP between suffixes starting at $i+1$ and $j+1$ is at least $l-1$ (since removing the first character of both decreases the LCP by at most 1). This allows computing LCP values in decreasing order, maintaining the current LCP length across iterations.",
            "The combination of SA + LCP + sparse table RMQ enables answering 'length of longest common substring of positions $i$ and $j$' in $O(1)$ after $O(n \\log n)$ preprocessing. The **LCP between any two suffixes** (not just adjacent in sorted order) equals the minimum value in the LCP array between their positions in the SA. This minimum is answered by RMQ in $O(1)$. Applications: longest repeated substring (maximum value in LCP array), longest common substring of two strings (concatenate with separator, build SA, find LCP across separator), and counting distinct substrings ($n(n+1)/2 - \\sum \\text{lcp}$).",
            "A **suffix automaton (SAM)** is the minimal DFA accepting all suffixes of $S$ (and only them). It has $O(n)$ states and $O(n)$ transitions. The key object: **endpos sets** (the set of ending positions of each substring in $S$). States of the SAM correspond to equivalence classes of substrings with the same endpos set. The SAM is built online in $O(n)$ using **suffix links** (analogous to failure links in Aho-Corasick, linking each state to the state of its longest proper suffix with a strictly larger endpos set). The SAM directly solves: counting distinct substrings, finding the lexicographically smallest rotation, and LCS of multiple strings - all in $O(n)$. The suffix automaton is the most powerful string structure; the suffix array is more cache-friendly and easier to implement.",
          ],
          resources: [
            { label: "CP-Algorithms - Suffix Array", url: "https://cp-algorithms.com/string/suffix-array.html", type: "docs" },
            { label: "CP-Algorithms - Suffix Automaton", url: "https://cp-algorithms.com/string/suffix-automaton.html", type: "docs" },
            { label: "e-maxx-eng - String hashing and suffix structures", url: "https://cp-algorithms.com/string/string-hashing.html", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "CP-Algorithms - String processing", url: "https://cp-algorithms.com/string/prefix-function.html", type: "docs" },
        { label: "Stanford CS97SI - Suffix arrays notes", url: "https://web.stanford.edu/class/cs97si/suffix-array.pdf", type: "course" },
      ],
      connections: [
        { to: "cyber-malware", note: "Aho-Corasick is how AV / IDS match many signatures in one pass (YARA-style)" },
        { to: "comp-frontend", note: "Lexing is finite-automaton string matching - the same theory" },
        { to: "ai-llm", note: "BPE tokenization is a greedy substring-merging string algorithm" },
      ],
    },
    {
      id: "dsa-complexity",
      title: "Complexity, advanced DS & geometry",
      level: "Research",
      body: [
        "Where the right structure is non-obvious: **link-cut trees** and Euler-tour trees (dynamic connectivity), **persistent** data structures, **wavelet trees**, and **sqrt-decomposition / Mo's algorithm**. On the theory side: P/NP/PSPACE/#P, NP-completeness reductions, approximation hardness (PCP intuition), and **computational geometry** (convex hull, line sweep, Voronoi/Delaunay).",
        "Capstone the domain by writing a **SAT solver** (DPLL → CDCL) - it ties complexity theory to a tool used in verification, crypto, and program analysis.",
      ],
      subtopics: [
        {
          title: "P, NP, and the complexity hierarchy",
          body: [
            "**P** is the class of decision problems solvable in polynomial time. **NP** is the class where a 'yes' answer has a polynomial-time verifiable certificate. P ⊆ NP; whether P = NP is the central open problem in computer science. The key concept: **NP-completeness**. A problem $Q$ is NP-complete if (1) $Q \\in NP$ and (2) every problem in NP reduces to $Q$ in polynomial time (NP-hard). Cook's theorem (1971): **SAT** (Boolean satisfiability) is NP-complete. This means if you can solve SAT in polynomial time, you can solve every NP problem in polynomial time (P = NP).",
            "**Polynomial-time reductions** are the tool for proving NP-completeness. To show problem $B$ is NP-hard, construct a poly-time reduction from a known NP-hard problem $A$ to $B$: a function $f$ such that $x \\in A \\iff f(x) \\in B$. The classic chain: SAT → 3-SAT → independent set → vertex cover → clique → Hamiltonian cycle → TSP. Each arrow is a poly-time reduction. Knowing this chain lets you immediately classify new problems: if problem $X$ can encode 3-SAT, it is NP-hard; if $X$ reduces to a polynomial problem, it is in P.",
            "**PSPACE** is the class of problems solvable with polynomial space (possibly exponential time). PSPACE ⊆ EXPTIME. PSPACE-complete problems include quantified Boolean formula (QBF), the problem of determining who wins a generic two-player game (like Generalized Geography). **#P** counts the number of satisfying assignments (counting the number of valid Sudoku solutions is #P-hard). **#P-hard** problems are at least as hard as NP (since deciding if the count > 0 is NP). Counting arguments appear in cryptography (counting solutions to discrete log instances) and statistical physics (partition functions).",
            "**The PCP theorem** (1992) states that every NP language has a probabilistically checkable proof (PCP) where a verifier reads only $O(\\log n)$ bits of the proof and accepts correct proofs with probability 1 while rejecting incorrect proofs with probability $\\ge 1/2$. The PCP theorem implies **inapproximability**: problems like MAX-3-SAT and clique cannot be approximated beyond certain ratios unless P = NP. The Unique Games Conjecture (2002) strengthens this: if true, many problems (vertex cover, max-cut) are hard to approximate beyond specific constants. This is why practitioners use heuristics (simulated annealing, genetic algorithms) for NP-hard optimization: there is no guaranteed polynomial approximation beyond a certain factor.",
            "**Algorithmic strategies for NP-hard problems**: (1) **Exact algorithms for small inputs**: branch-and-bound, dynamic programming (DP over subsets for TSP: $O(2^n n^2)$). (2) **Approximation algorithms**: polynomial-time algorithms with provable approximation ratios. Vertex cover has a 2-approximation (any maximal matching gives a 2-approximation). Set cover has an $H_k \\approx \\ln k$ approximation. (3) **Fixed-parameter tractability (FPT)**: algorithms polynomial in $n$ and exponential only in a parameter $k$ that is small in practice. Vertex cover has an $O(2^k \\cdot n)$ FPT algorithm: branch on an uncovered edge (include one endpoint). (4) **Heuristics**: problem-specific algorithms without approximation guarantees that perform well in practice.",
          ],
          resources: [
            { label: "Sipser - Introduction to the Theory of Computation", url: "https://www.amazon.com/Introduction-Theory-Computation-Michael-Sipser/dp/113318779X", type: "book" },
            { label: "Complexity Zoo - complexity class definitions", url: "https://complexityzoo.net/", type: "docs" },
            { label: "Parameterized Algorithms (free PDF) - Cygan et al.", url: "https://www.mimuw.edu.pl/~malcin/book/parameterized-algorithms.pdf", type: "book" },
          ],
        },
        {
          title: "Advanced data structures: persistence, link-cut trees, and sqrt decomposition",
          body: [
            "**Persistent data structures** support accessing any historical version while sharing unchanged structure. A **persistent segment tree** creates a new root per update but shares unchanged subtrees with previous versions - $O(\\log n)$ new nodes per update, $O(n \\log n)$ total for $n$ updates. This enables 'what was the sum of $[l, r]$ at time $t$?' in $O(\\log n)$. The canonical application: **offline kth smallest in a range** - build a persistent segment tree over prefix counts sorted by value; query with the root at $r$ and $l-1$.",
            "**Link-cut trees** maintain a forest of trees supporting path queries and modifications in $O(\\log n)$ amortized. Operations: `link(u, v)` (add edge making $u$ a child of $v$), `cut(u)` (remove edge to $u$'s parent), `path_query(u, v)` (aggregate over path from $u$ to $v$). Implementation uses **access** (expose the path from a node to its root) with **splay trees** for the internal representation. Applications: dynamic MST, dynamic connectivity, LCT-based network flow. The link-cut tree is the canonical 'hard but useful' data structure in competitive programming.",
            "**Sqrt decomposition** divides an array into blocks of size $\\sqrt{n}$, precomputing a block aggregate. Point update: update element and recompute block aggregate: $O(1)$. Range query: full blocks in $O(\\sqrt{n})$, partial blocks in $O(\\sqrt{n})$. Total: $O(\\sqrt{n})$ per operation. It is the standard approach when $O(n \\log n)$ preprocessing is too slow or the problem has multiple interleaved operations. **Mo's algorithm** is offline sqrt decomposition on range queries: sort queries by $(\\lfloor l/\\sqrt{n} \\rfloor, r)$ (block of left endpoint, then by right endpoint within block). Adding/removing elements at the range endpoints maintains a current answer. Total: $O((n + q)\\sqrt{n})$. Mo's algorithm solves: distinct element count in ranges, mode in ranges, and any query where adding/removing an element from the current set can be done in $O(1)$.",
            "**Wavelet trees** answer a rich set of range queries on integer arrays in $O(\\log V)$ per query (where $V$ is the value range): kth smallest in $[l, r]$, count elements in $[l, r]$ with value in $[a, b]$, and rank/select queries. A wavelet tree is a recursively partitioned tree where each node covers a range of values and stores, for each prefix of its array, the count of elements in the lower half of the value range. This allows binary search on the value dimension in $O(\\log V)$ using the prefix counts. Wavelet trees are used in bioinformatics (rank/select on DNA sequences), compressed suffix arrays, and competitive programming.",
          ],
          resources: [
            { label: "MIT 6.851 - Advanced Data Structures (Demaine, free)", url: "https://courses.csail.mit.edu/6.851/", type: "course" },
            { label: "CP-Algorithms - Sqrt decomposition", url: "https://cp-algorithms.com/data_structures/sqrt_decomposition.html", type: "docs" },
            { label: "Codeforces - Mo's algorithm tutorial", url: "https://codeforces.com/blog/entry/61203", type: "docs" },
          ],
        },
        {
          title: "Computational geometry: convex hull, line sweep, Voronoi",
          body: [
            "**Computational geometry** provides algorithms for geometric objects. The foundation: the **cross product** of 2D vectors $\\mathbf{a} = (a_x, a_y)$ and $\\mathbf{b} = (b_x, b_y)$ is $a_x b_y - a_y b_x$. Its sign determines orientation: positive = $\\mathbf{b}$ is to the left of $\\mathbf{a}$ (counterclockwise turn), negative = right (clockwise), zero = collinear. The **CCW test** is the basis of nearly every geometric algorithm. Integer arithmetic avoids floating-point precision issues; scale coordinates to integers when possible.",
            "The **convex hull** of a point set is the smallest convex polygon containing all points. **Graham scan**: $O(n \\log n)$ - sort by angle from the lowest point, then greedily add points while maintaining a CCW invariant (pop back from hull if the last three points make a clockwise turn). **Monotone chain**: sort by $(x, y)$, build lower hull left-to-right and upper hull right-to-left using the CCW test. Both are $O(n \\log n)$ due to sorting. **Chan's algorithm**: $O(n \\log h)$ where $h$ is the hull size - optimal for small hull. Applications: diameter of a point set (farthest pair, found via rotating calipers on convex hull), smallest enclosing circle, gift wrapping, collision detection in physics engines.",
            "**Line sweep** processes events sorted by $x$-coordinate, maintaining an active set of geometric objects. **Segment intersection** (Bentley-Ottmann): sweep a vertical line, maintaining the set of active segments ordered by their $y$ intersection with the sweep line. Swap adjacent segments in the order when they intersect (an event). Total $O((n + k) \\log n)$ where $k$ is the number of intersections. **Area of union of rectangles**: sweep by $x$, maintain a segment tree on the $y$-axis to track covered length. **Closest pair of points** (already covered under D&C): the sweep version processes points left-to-right, maintaining a set of points within distance $\\delta$ of the current $x$ using a BST.",
            "**Voronoi diagrams** and **Delaunay triangulations** are dual structures. The Voronoi diagram of $n$ points partitions the plane into regions where each region contains points closest to one input point. The Delaunay triangulation connects input points such that no point is inside the circumcircle of any triangle. Fortune's algorithm computes both in $O(n \\log n)$ using a beach-line sweep. Applications: nearest-neighbor queries (find which Voronoi region a query point falls in), interpolation (natural neighbor interpolation), mesh generation for finite element analysis, and the topology of protein interaction networks.",
            "**SAT solvers** (DPLL and CDCL) tie complexity theory to practice. **DPLL** (Davis-Putnam-Logemann-Loveland): recursively assign variables, propagate unit clauses (a clause with one unassigned literal must be true), detect conflicts, backtrack. Modern **CDCL (Conflict-Driven Clause Learning)** adds: when a conflict occurs, analyze the **implication graph** to derive a new clause (a nogood) that prevents the same conflict; add it to the clause database; jump back (non-chronologically) to the first point where the new clause is unit. CDCL solvers (MiniSAT, CryptoMiniSat, Z3) routinely solve instances with millions of variables. Applications: hardware verification, bounded model checking, cryptanalysis (encoding cipher constraints as SAT), and automated theorem proving. Writing a CDCL solver is the capstone exercise for this domain.",
          ],
          resources: [
            { label: "CP-Algorithms - Computational Geometry", url: "https://cp-algorithms.com/geometry/basic-geometry.html", type: "docs" },
            { label: "Computational Geometry: Algorithms and Applications - de Berg et al.", url: "https://www.cs.uu.nl/geobook/", type: "book" },
            { label: "MiniSAT - minimal CDCL SAT solver (source)", url: "https://github.com/niklasso/minisat", type: "repo" },
          ],
        },
      ],
      resources: [
        { label: "MIT 6.851 - Advanced Data Structures (Demaine)", url: "https://courses.csail.mit.edu/6.851/", type: "course" },
        { label: "Parameterized Algorithms (free PDF) - Cygan et al.", url: "https://www.mimuw.edu.pl/~malcin/book/parameterized-algorithms.pdf", type: "book" },
        { label: "Computational Geometry - CP-Algorithms", url: "https://cp-algorithms.com/geometry/basic-geometry.html", type: "docs" },
      ],
      connections: [
        { to: "crypto-pqc", note: "Lattice problems (SVP/CVP) and LLL reduction are computational-geometry / complexity results" },
        { to: "cyber-research", note: "SAT/SMT solvers drive symbolic execution and automated vuln discovery" },
        { to: "game-physics", note: "Convex hull + line-sweep are the collision-geometry primitives" },
      ],
    },
  ],
});
