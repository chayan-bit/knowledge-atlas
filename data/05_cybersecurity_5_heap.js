atlasAdd({
  id: "cyber",
  topics: [
    {
      id: "cyber-heap",
      title: "Heap exploitation",
      level: "Advanced",
      body: [
        "**glibc ptmalloc2** internals (`malloc_chunk`, fastbin/unsorted/small/large bins, tcache) and the attack catalog: tcache poisoning, double-free bypass, fastbin/unsorted-bin attacks, the 'House of' techniques, and modern mitigations (**safe-linking**, PROTECT_PTR).",
        "This is the deep end of pwn - it requires holding the allocator's exact state in your head.",
      ],
      subtopics: [
        {
          title: "glibc ptmalloc2 Internals: Chunks, Bins, and Arenas",
          body: [
            "glibc's **ptmalloc2** (per-thread malloc) manages heap memory as a linked list of **chunks**. Every allocation is a `malloc_chunk` structure: a 16-byte header (prev_size, size) followed by the user data. The `size` field encodes both the chunk size (in bytes, always a multiple of 16) and three flag bits: `PREV_INUSE (P)` (previous chunk is allocated), `IS_MMAPPED (M)` (chunk was mmapped), `NON_MAIN_ARENA (A)` (chunk in a non-main arena). When a chunk is free, the user-data area repurposes its first 16 bytes for `fd` (forward pointer) and `bk` (backward pointer) into the appropriate free list.",
            "**Bins** are doubly-linked free lists categorized by size: **fastbins** (singly-linked, LIFO, sizes 0x20-0xa0 on 64-bit), **unsorted bin** (FIFO, receives all freed chunks before sorting), **small bins** (64 doubly-linked lists for sizes < 0x400), **large bins** (63 doubly-linked lists for sizes >= 0x400, sorted by size within each bin). On `malloc(n)`: check fastbins first → check tcache → check unsorted/small/large bins → split a larger chunk → extend the heap via `sbrk`/`mmap`.",
            "**tcache (per-thread cache, glibc 2.26+)**: each thread maintains 64 singly-linked per-size caches holding up to 7 free chunks each. `free()` puts chunks into tcache first (bypassing consolidation logic); `malloc()` pops from tcache first (bypassing bin traversal). This makes allocation nearly lock-free for most workloads but introduced new attack surfaces: tcache has no double-free detection (pre-2.29), no size validation on pop, and a simple next-pointer structure.",
            "**Arenas**: in multi-threaded programs, `malloc` would serialize on a single heap lock. ptmalloc2 creates additional **arenas** (up to `4 * ncores`) per thread, each with its own heap and bins, reducing contention. The main arena uses the process's main heap (`sbrk`); additional arenas use `mmap`-allocated regions. Each arena has its own `fastbinY[]` array and `bins[]` for its free lists. When exploiting, it's critical to know which arena a chunk belongs to.",
            "**Heap metadata as attack surface**: the chunk header, `fd`/`bk` pointers, and bin bookkeeping are all in the same address space as user data. A heap buffer overflow overwrites adjacent chunk headers; a use-after-free reads/writes freed chunk metadata directly. The attack primitives reduce to: (1) **arbitrary free** - corrupt a chunk's size/pointer so freeing it writes to an attacker-controlled location; (2) **arbitrary allocation** - corrupt bin pointers so `malloc` returns an attacker-controlled address as a 'free chunk'.",
          ],
          resources: [
            { label: "How2Heap - Heap Exploitation Tutorial", url: "https://github.com/shellphish/how2heap", type: "repo" },
            { label: "Glibc Malloc Source", url: "https://sourceware.org/git/?p=glibc.git;a=blob;f=malloc/malloc.c", type: "docs" },
          ],
        },
        {
          title: "tcache Poisoning and Double-Free",
          body: [
            "**tcache poisoning** exploits the minimal validation in tcache's free list. On glibc < 2.29: `free(ptr); free(ptr)` puts the same chunk twice in the tcache without detection (the `e->key` double-free mitigation wasn't present). The tcache singly-linked list now has a cycle: `chunk → chunk → chunk → ...`. `malloc()` returns this chunk twice - two allocations pointing to the same memory. The first returned allocation's `fd` field (which is now user data) is the 'next pointer' in the tcache. Overwriting it with an arbitrary address and calling `malloc` twice more returns a pointer to that arbitrary address on the third call.",
            "Post-glibc 2.29 mitigation: a `key` field is stored in the freed chunk's bk pointer (`tcache_entry->key = tcache`). On `free`, glibc checks if `e->key == tcache`; if so, it walks the tcache list to verify the chunk isn't already present - O(n) detection. Bypass: corrupt the `key` field before the second `free` so the check is skipped. Since the `key` is stored in the user-data region of the freed chunk, a UAF (Use-After-Free) to overwrite it is sufficient.",
            "**tcache poisoning exploit chain** (modern glibc): (1) Allocate two chunks A and B; (2) Free B then A (A's fd now points to B); (3) UAF write to A's fd field to point to target address `T` (e.g., `__free_hook`, `__malloc_hook`, or a function pointer on the heap); (4) `malloc()` → returns A; (5) `malloc()` → returns T; (6) Write shellcode/`system` address at T. On glibc 2.32+, the next pointer is also encrypted with **safe-linking** (`PROTECT_PTR`), requiring a heap address leak to decrypt before overwriting.",
            "**safe-linking (glibc 2.32+)**: the tcache/fastbin next pointer is stored as `ptr XOR (current_chunk_addr >> 12)`. The shift discards the page offset (always known), making the XOR effectively `ptr XOR (ASLR_random_bits)`. To overwrite the pointer with a target address T: you must know both T and the heap base (from a heap leak). `stored = T XOR (chunk_addr >> 12)` - but `chunk_addr` must be known too. A heap address leak (from another chunk's content, /proc/self/maps, or partial overwrite) is now prerequisite to tcache poisoning.",
            "Real CTF example: **2021 PlaidCTF** 'emojiDB' used tcache double-free (glibc 2.31, before safe-linking) to overwrite `__free_hook` with `system` - the next `free(\"/bin/sh\")` call invokes `system(\"/bin/sh\")`. The `__free_hook`/`__malloc_hook` symbols (removed in glibc 2.34) were the canonical tcache poisoning targets because they're function pointers called by malloc/free themselves. Post-2.34, targets are `_IO_file` structures for the **FSOP (File Stream Oriented Programming)** technique.",
          ],
          resources: [
            { label: "tcache Poisoning Explained - Shellphish how2heap", url: "https://github.com/shellphish/how2heap/blob/master/glibc_2.31/tcache_poisoning.c", type: "repo" },
          ],
        },
        {
          title: "Fastbin Dup, Unsorted Bin, and Overlapping Chunks",
          body: [
            "**fastbin dup** is the pre-tcache equivalent of tcache poisoning. Fastbins are singly-linked, LIFO, with one key mitigation: `free` checks if the top of the bin equals the chunk being freed (to detect consecutive double-free of the same chunk). Bypass: free A, free B, free A again - `A → B → A` (not two consecutive same-chunk frees). Three `malloc`s of the same size: first returns A, second returns B, third returns A again. Overwrite A's `fd` on the second malloc to point to target T; fourth malloc returns T.",
            "**Unsorted bin attack (pre-glibc 2.29)**: when a chunk is in the unsorted bin, its `bk` pointer points to the next chunk. During `malloc`, the unsorted bin is traversed; for each chunk that doesn't satisfy the request, it's moved to its appropriate small/large bin: `bck = victim->bk; unsorted_chunks(av)->bk = bck; bck->fd = unsorted_chunks(av)`. If an attacker controls `victim->bk = target - 0x10`, then `bck->fd = unsorted_chunks(av)` writes the address of `main_arena.bins` (a large, stable libc address) to `target`. This enables overwriting arbitrary memory with a large libc address - useful for bypassing ASLR when a libc address at a control-flow location enables a further primitive.",
            "**Heap overflow → chunk overlap**: by corrupting a chunk's `size` field (in its header, 8 bytes before the user pointer), an attacker can make the allocator believe a chunk is larger than it is. When freed, this 'large' chunk's free region overlaps the next live chunk. The next `malloc(large)` returns the large region, giving write access over the next chunk's user data - **overlapping chunk**. This converts a heap overflow (forward-only write) into a powerful primitive: overwrite the next chunk's content freely.",
            "**House of Force**: corrupt the `top chunk` size (the last chunk in the heap, maintained by the allocator for new allocations) to a very large value (e.g., `0xffffffffffffffff`). Now request a **negative-sized** allocation: `malloc(-1 * (distance_to_target + 0x10))`. The allocator adds this to `top_chunk_ptr`, wrapping around to land near the target (if the top chunk were at address 0x400000 and target is at 0x200000, request `-0x200010`). The subsequent `malloc(small_size)` returns memory at the target location. Mitigated in glibc 2.29 by validating the top chunk size against the available arena size.",
            "**Use-After-Free (UAF)**: a pointer to freed memory is used after the chunk is returned to the allocator. If the allocator places a new chunk at the same address, the old pointer now aliases the new allocation. If the old and new chunk types are different (type confusion), reading the old type's field offsets through the new type's layout provides a cross-type memory view. Example: an old chunk's 'virtual function pointer' offset aligns with a new chunk's user-controlled 'data' field - UAF reads attacker-controlled bytes as a vtable pointer, leading to arbitrary code execution.",
          ],
          resources: [
            { label: "Heap Exploitation - Nightmare CTF Course", url: "https://guyinatuxedo.github.io/", type: "course" },
            { label: "House of Force - how2heap", url: "https://github.com/shellphish/how2heap/blob/master/glibc_2.27/house_of_force.c", type: "repo" },
          ],
        },
        {
          title: "House of Techniques: Spirit, Orange, and Einherjar",
          body: [
            "The 'House of' techniques are named exploit patterns that achieve powerful heap primitives through specific sequence of allocations and corruptions. **House of Spirit**: forge a fake fastbin chunk anywhere in memory (stack, global data, another heap region) and `free()` it. Two conditions: (1) the fake chunk's `size` field matches a fastbin size range; (2) the next fake chunk (at `fake_chunk + size`) has a `size` field between 8 and `system_mem` (can be forged too). After freeing, the fake address is in the fastbin; the next `malloc` of that size returns it. Enables arbitrary allocation at a chosen address without a heap UAF.",
            "**House of Orange** (pre-glibc 2.26, no tcache): a heap overflow to corrupt the `top_chunk`'s size to a small value causes `malloc` (requesting more than the corrupted top size) to allocate a new heap via `sysmalloc`, which calls `_int_free` on the old top chunk - silently freeing it into the unsorted bin without an explicit `free()` call. This creates a controlled chunk in the unsorted bin from a heap overflow alone. Combined with the unsorted bin attack or FSOP, it was a powerful primitives for programs that never call `free`.",
            "**House of Einherjar (glibc 2.26)**: corrupt the `PREV_INUSE` bit (P flag in size) of a chunk to 0, and set its `prev_size` field to a crafted value pointing to a fake chunk. When this chunk is freed, glibc backward-consolidates it with the 'previous' fake chunk, producing a large consolidated chunk spanning from the fake chunk's address to the current chunk. The consolidated chunk is inserted into the unsorted bin. Next `malloc` of an appropriate size returns a pointer that overlaps live allocations.",
            "**House of Lore**: corrupt the `bk` pointer of a chunk in a small bin. When glibc processes the small bin, it writes `unsorted_chunks(av)` (a libc pointer) into the `bk`-pointed location's `fd` field, and the corrupted chunk is returned as the allocation. Used to achieve allocation at arbitrary location via small bin traversal. Requires knowledge of libc addresses (to pass `bk->fd == victim` check in hardened glibc versions).",
            "**Modern attacks (FSOP, post-glibc 2.34)**: with `__free_hook`/`__malloc_hook` removed, the primary target is `_IO_FILE` structures. Every `FILE *` (stdin, stdout, stderr, and any opened file) contains function pointer tables (`_IO_jump_t vtable`). By corrupting a FILE structure's vtable pointer to point to a fake `_IO_jump_t` with a controlled function pointer at the `_overflow`/`_sync` offset, and triggering a flush (e.g., by calling `exit()` which flushes all FILE streams), the attacker achieves code execution. This is **FSOP (File Stream Oriented Programming)** - the modern replacement for hook overwrites.",
          ],
          resources: [
            { label: "FSOP - Modern Heap Exploitation", url: "https://github.com/shellphish/how2heap/blob/master/glibc_2.35/house_of_apple2.c", type: "repo" },
            { label: "Heap Exploitation Techniques Survey", url: "https://heap-exploitation.dhavalkapil.com/", type: "docs" },
          ],
        },
        {
          title: "Modern Mitigations: Safe-Linking and Heap Hardening",
          body: [
            "glibc's hardening has accelerated significantly after high-profile exploitation. **safe-linking (glibc 2.32)** encrypts tcache and fastbin next pointers: stored as `P >> PAGE_SHIFT XOR L` where P is the plain next pointer and L is the storage location address shifted right by PAGE_SHIFT (12 bits). Decoding requires `P = stored XOR (storage_location >> 12)`. An attacker must leak a heap address at the chunk's location to construct a valid poisoned pointer. This doesn't prevent tcache poisoning but raises the cost: a heap leak is now mandatory.",
            "**Tcache key check (glibc 2.29)**: `tcache_entry->key` is set to the tcache pointer on free; double-free is detected by `e->key == tcache`. The O(n) list walk was added as a backup. Bypass requires UAF to clear the key before double-free, making double-free require an additional write primitive.",
            "**House of Orange mitigation (glibc 2.26)**: the top chunk's size is now validated against `av->system_mem` in `_int_free`. Corrupting the top chunk size to trigger `sysmalloc` consolidation now requires the fake size to be realistically large (less than the arena's total memory), complicating House of Orange-style primitives.",
            "**musl libc** and **jemalloc** (Firefox, FreeBSD) have fundamentally different allocator designs with fewer metadata-in-band structures. jemalloc separates metadata (chunk headers) from user data regions, making chunk header corruption much harder - overflowing a buffer doesn't reach the chunk header for the next allocation. musl uses a doubly-linked list of `chunk` structures but without `fd`/`bk` in-band in user memory. Many modern hardened systems (Alpine Linux uses musl) are significantly more resistant to classic glibc heap exploitation.",
            "**Heap feng shui**: with hardened allocators, exploits require precise heap state control - feng shui (beautiful heap layout). By making controlled allocations/frees of specific sizes in a specific order before triggering the vulnerability, the attacker coerces the allocator into the desired state. Tools like **pwndbg**'s `vis_heap_chunks` command visualize the exact heap layout at any breakpoint, enabling iterative feng shui engineering. The craft of heap exploitation has shifted from algorithmic attacks on allocator logic to careful engineering of heap state to meet increasingly specific pre-conditions.",
          ],
          resources: [
            { label: "Safe Linking Explained - Check Point Research", url: "https://research.checkpoint.com/2020/safe-linking-eliminating-a-20-year-old-malloc-exploit-primitive/", type: "paper" },
          ],
        },
      ],
      resources: [
        { label: "how2heap - Shellphish", url: "https://github.com/shellphish/how2heap", type: "repo" },
        { label: "Nightmare CTF Course (heap chapters)", url: "https://guyinatuxedo.github.io/", type: "course" },
        { label: "Heap Exploitation - dhavalkapil", url: "https://heap-exploitation.dhavalkapil.com/", type: "docs" },
      ],
      connections: [
        { to: "cyber-pwn", note: "Heap exploitation extends stack pwn primitives to dynamic memory" },
        { to: "ll-cmemory", note: "malloc internals depend on C memory model - pointers, alignment, struct layout" },
        { to: "cyber-kernel", note: "Kernel heap (kmalloc/slab) has analogous exploitation patterns" },
      ],
    },
  ],
});
