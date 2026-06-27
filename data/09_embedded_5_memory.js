atlasAdd({
  id: "embedded",
  topics: [
    {
      id: "emb-memory",
      title: "Memory-constrained programming",
      level: "Intermediate → Advanced",
      body: [
        "No-`malloc` discipline (static allocation, object pools), worst-case stack sizing (`uxTaskGetStackHighWaterMark`), flash optimization (`-Os`, LTO, `--gc-sections`), SRAM placement tricks, and flash wear-leveling (page/sector erase, write-endurance limits).",
        "When you have 64KB of RAM, every byte and every allocation is a deliberate decision.",
      ],
      subtopics: [
        {
          title: "Static allocation discipline - no-malloc, object pools, and arena allocators",
          body: [
            "The embedded world's prohibition on dynamic allocation is not aesthetic. `malloc` on a small MCU introduces three genuine hazards: **heap fragmentation** (over time, free blocks are too small for new requests, causing allocation failure even with bytes available), **non-deterministic execution time** (a malloc call can take arbitrarily long depending on heap state), and **heap/stack collision** (the heap grows upward, the stack grows downward, and there is nothing stopping them from colliding silently, corrupting both). MISRA-C Rule 21.3 bans dynamic allocation for exactly these reasons.",
            "The no-malloc discipline replaces general allocation with **statically declared, fixed-size structures**. Every object that would be `malloc`'d is instead declared as a global array: `static SensorReading sensor_pool[MAX_SENSORS];`. Tracking which entries are in use requires a simple bitmap or a free-list index. At startup, the pool is fully allocated; the 'allocator' is just `sensor_pool[free_index++]` with a bounds check. This is O(1), deterministic, and uses zero RAM beyond the pool itself.",
            "**Fixed-size block pools** are the correct general pattern for variable numbers of objects of the same size. The pool is a statically declared array of N blocks. A free list (a linked list embedded *within* the free blocks themselves, so no extra memory) chains all free blocks. Allocate = pop from free list head; Free = push to free list head. Both O(1), fully deterministic. FreeRTOS's `heap_1`/`heap_2`/`heap_4` are implementations of this idea at different complexity levels.",
            "**Arena allocators** (also called linear/bump allocators or region allocators) are useful for short-lived allocations with batch lifetime. The arena is a fixed buffer and a pointer. Allocate = advance the pointer (bump allocation), O(1). Free = reset the pointer to the start of the arena (the entire arena is freed at once, not individual objects). Arena allocators are ideal for per-request processing buffers in command handlers, JSON parsers, or communication protocol decoders where all temporaries can be freed at the end of the request.",
            "A complete memory map for a well-designed embedded system: all peripheral register access through CMSIS volatile structs; all inter-task messages as value types through queues; all sensor objects in a statically declared pool; all temporary parsing state in a per-task arena on the task stack; no `malloc` anywhere. Every byte of RAM is accounted for at compile time. The `.map` file (from `gcc -Wl,-Map=output.map`) lists every symbol and its size — use it to audit RAM and flash usage and to catch unintended dynamic allocation (check for `malloc` symbol references in the map).",
          ],
          resources: [
            { label: "Embedded Artistry — patterns for embedded systems (memory)", url: "https://embeddedartistry.com/blog/2017/02/15/implementing-malloc-with-the-freertos-api/", type: "docs" },
            { label: "MISRA-C 2012 — dynamic memory rules (Rule 21.3)", url: "https://misra.org.uk/", type: "docs" },
          ],
        },
        {
          title: "Stack sizing - watermarks, canaries, and MPU stack overflow detection",
          body: [
            "Stack overflow is the most dangerous memory error in embedded: it silently corrupts adjacent memory (another task's stack, the heap, or global variables), producing bugs that manifest far from the overflow site, often intermittently depending on call depth. Unlike heap bugs which malloc-debug can detect, stack overflow detection requires deliberate instrumentation.",
            "**Worst-case stack depth** analysis: the maximum stack usage equals the deepest call chain × (local variables per function + function prologue overhead) + ISR nesting overhead (each ISR nests an 8-word exception frame on the interrupted context's stack). Analyze by examining the call tree, summing local variable sizes, and adding ISR overhead. Tools like `cflow` or `-fstack-usage` (GCC flag that writes per-function stack usage to `.su` files) automate this for non-recursive code. Recursive functions have unbounded stack depth — avoid them in embedded.",
            "**Stack watermark pattern**: fill the entire stack region with a known sentinel value (0xDEADBEEF or 0xA5A5A5A5) at initialization. Periodically check how far the sentinel has been overwritten from the bottom — the boundary is the high-water mark. FreeRTOS does this automatically for tasks and `uxTaskGetStackHighWaterMark(task)` returns the minimum free words ever seen. A returned value of 0 means the stack has been fully used at least once — resize immediately. A value < 10 words is concerning. Target ≥ 20% headroom for production.",
            "**Stack canaries** are a compile-time option (`-fstack-protector-strong` in GCC) that places a random 4-byte value (the canary) on the stack frame at function entry and checks it at function return. If a buffer overflow overwrites the canary, the check fails and a handler is called (configured by overriding `__stack_chk_fail()`). In embedded, this adds overhead per function call and requires a source of randomness for the canary; it is better than nothing but does not detect overflow at the moment it happens — only when the function returns.",
            "The **MPU (Memory Protection Unit)** provides the strongest protection: configure a region covering the first word(s) of each task stack as no-access (XN + no read/no write). Any stack overflow that writes to this guard region immediately triggers a MemManageFault, stopping execution at the exact instruction that overflowed. This is far more valuable than after-the-fact detection — you get the culprit's program counter and stack trace immediately. On Cortex-M, each MPU region must be power-of-2 aligned and power-of-2 size; a 32-byte guard region at the base of each stack suffices. This is the production-grade stack protection approach for safety-critical systems.",
          ],
          resources: [
            { label: "Memfault Interrupt — stack overflows on embedded (detection strategies)", url: "https://interrupt.memfault.com/blog/cortex-m-rtos-root-cause", type: "docs" },
            { label: "GCC — -fstack-usage and -fstack-protector documentation", url: "https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html", type: "docs" },
          ],
        },
        {
          title: "Flash optimization - compiler flags, LTO, dead-code stripping, and section placement",
          body: [
            "Flash is the hardest constraint to relax in embedded: you cannot dynamically add flash, and adding a larger part often requires a board redesign. Hitting the flash limit forces difficult choices — strip features or upgrade hardware. Systematic optimization can often recover 20-50% of flash usage without losing functionality.",
            "**Compiler optimization levels**: `-O0` (no optimization, maximum debugging fidelity), `-O1` (basic optimization: dead code, constant propagation), `-O2` (full optimization), `-O3` (aggressive, may increase code size due to loop unrolling and inlining), `-Os` (optimize for size — like -O2 but avoids size-increasing transforms). `-Os` is the standard for production embedded firmware. `-Oz` (clang/LLVM) is even more aggressive for size. Enabling `-Os` typically reduces code size by 20-40% vs `-O0` and rarely impacts performance for peripheral-bound code.",
            "**LTO (Link-Time Optimization)**: with `-flto`, the compiler defers optimization until link time, when all translation units are visible. This enables cross-module inlining, dead function elimination, and devirtualization that per-file compilation misses. LTO can eliminate 10-20% of code by inlining small functions that would otherwise generate function-call overhead and by removing functions only used from other compilation units that are themselves eliminated. Compile all files with `-flto`; link with `-flto -O2`.",
            "**`--gc-sections`** (linker flag, also `-Wl,--gc-sections`) instructs the linker to remove ELF sections not reachable from the entry point. Pair it with `-ffunction-sections -fdata-sections` (compiler flags that put each function and data object in its own section). Without this, all object code from every translation unit is linked in even if only one function from that file is called. With `--gc-sections`, functions and data that are never called/referenced are completely eliminated. Combined with LTO, this typically removes 5-15% of code size from typical embedded projects.",
            "**Section placement for performance**: the `__attribute__((section(\".ramcode\")))` attribute combined with a linker script region places hot functions in SRAM, which provides zero-wait-state execution (vs 5 wait states for flash at 168 MHz). For functions in tight control loops (PID controllers, FFT butterflies, motor commutation), this yields a 2-3x speedup. The tradeoff is SRAM consumption — only move the tightest loops. Similarly, constant lookup tables can be placed in `__attribute__((section(\".rodata_ccm\")))` to use CCM RAM's zero-latency access for the CPU, though CCM is not DMA-accessible.",
          ],
          resources: [
            { label: "Memfault Interrupt — reducing firmware code size", url: "https://interrupt.memfault.com/blog/code-size-optimization-gcc-flags", type: "docs" },
            { label: "GCC — optimization options documentation", url: "https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html", type: "docs" },
          ],
        },
        {
          title: "Flash wear leveling - page erase cycles, endurance limits, and algorithms",
          body: [
            "NOR flash (used for code and data on MCUs) has finite **write endurance**: every erase-write cycle stresses the oxide layer of the floating-gate transistors. STM32F4 internal flash is rated for 10,000 program/erase cycles minimum; ST's own qualification data shows median life of ~100,000 cycles. Exceeding endurance produces **bit rot**: cells lose charge and reads return wrong values. Writing the same sector repeatedly (e.g. saving a timestamp once per second to a fixed address) will exhaust it in hours on an MCU-rated flash.",
            "**Erase granularity** matters for write efficiency. NOR flash can be written on a byte or word basis but can only be erased in large blocks (pages or sectors). On STM32F4, sectors range from 16KB to 128KB depending on bank position. You cannot overwrite a byte in flash — you can only write 0 bits into 1 bits. To change a 1-bit back to 1, you must erase the entire sector (sets all bits to 1) and re-write the whole sector. This means 'update one field in flash' requires: read sector to RAM, erase sector, write back sector with the field updated. Minimizing erase frequency is the key to extending flash life.",
            "**Wear leveling** distributes writes across all available flash pages so no single page accumulates far more cycles than others. The simplest approach for small embedded data (config, calibration, counters): a **circular log** across N pages. Each entry is written sequentially; when a page fills, erase the next and continue. A version number or sequence number in each entry identifies the latest. The most-recently-written entry on the most-recently-written page is the current valid record. This spreads writes evenly: a 10,000-cycle flash with 8 pages of circular log sustains 80,000 configuration saves before failure.",
            "**EEPROM emulation** in flash is the standard ST technique for frequently updated small values. Two flash sectors are used: the active sector and the receive sector. Each 'variable' is stored as a (virtual address, value) pair at the next available write location. When the active sector fills, all valid (most-recent) variable values are compacted into the receive sector, the active sector is erased, and roles switch. ST provides a reference implementation (`eeprom.c`) that handles this with wear leveling across 2 sectors. Endurance with 2 sectors and 16-bit variables: 10,000 × sector_size / (number_of_variables × word_size) / update_rate = sustainable update interval.",
            "External **SPI NOR flash** (W25Q series, IS25 series) has similar endurance (10,000–100,000 cycles per sector) but NAND flash (common in SD cards and USB drives) has higher density but lower endurance (1,000–10,000 cycles) and requires error correction (ECC) and block management. When using SD cards for embedded data logging, never directly write to FAT sectors — use a filesystem (FatFS) that handles block management. Even then, high-frequency logging (1 kHz) to the same file will cluster writes on the same FAT cluster chain and wear those sectors disproportionately. Log to rotating files or use a dedicated flash data logger with circular buffering and explicit wear leveling.",
          ],
          resources: [
            { label: "ST — EEPROM emulation in STM32F4 flash (AN3969)", url: "https://www.st.com/resource/en/application_note/an3969-eeprom-emulation-in-stm32f40xstm32f41x-microcontrollers-stmicroelectronics.pdf", type: "docs" },
            { label: "Memfault Interrupt — flash storage and wear leveling", url: "https://interrupt.memfault.com/blog/flash-wear-leveling", type: "docs" },
          ],
        },
        {
          title: "SRAM placement and memory-region tricks",
          body: [
            "A nuanced skill that separates intermediate from advanced embedded engineers: deliberately placing data in specific SRAM regions to exploit architectural properties — zero-latency CCM RAM, non-cacheable DMA regions on M7, or multi-bank parallel access on F7/H7. This is the intersection of linker scripting, `__attribute__` annotations, and hardware memory architecture.",
            "**CCM RAM (Core-Coupled Memory)** on STM32F4 (64KB at 0x10000000) is connected directly to the Cortex-M4 D-code bus, bypassing AHB, giving the CPU true zero-wait-state access. Ideal for: FreeRTOS TCBs and stacks (faster context switching), PID controller state variables (tight loops benefit from single-cycle access), interrupt handlers' working buffers (lowest possible ISR overhead). Declare with `__attribute__((section(\".ccmram\")))` and add the section to the linker script. **Important**: DMA cannot access CCM RAM — never put DMA buffers there.",
            "**Non-cacheable SRAM** on STM32H7 (which has a 32KB SRAM4 at 0x38000000 marked as non-cacheable in the MPU). The D-cache on Cortex-M7 can serve stale data to the CPU if DMA has written to cached SRAM without a cache invalidate. Placing all DMA buffers in the non-cacheable SRAM4 region eliminates this coherency problem entirely — the CPU always reads the actual memory content, not a cached copy. The MPU must configure SRAM4 as non-cacheable (TEX=0, C=0, B=0, or use the MAIR attribute system on M33). Failing to do this is the single most common bug on STM32H7 when porting M4 code.",
            "**Tightly Coupled Memory (TCM)** on Cortex-M7: ITCM (64KB, connected to the I-code bus for zero-wait-state instruction fetch) and DTCM (128KB, connected to D-code bus). Place latency-critical ISR handlers in ITCM to guarantee single-cycle instruction fetch regardless of main flash cache state. This is essential for hard real-time control loops at > 1 MHz where even a single cache miss would cause a timing violation. Use `__attribute__((section(\".itcm_code\")))` and configure the linker script to place this section at ITCM load/link addresses.",
            "Multi-bank SRAM on H7 enables **simultaneous access by different bus masters**: the CPU can read SRAM1 while DMA writes SRAM4 in the same clock cycle — true parallelism. Placing Ethernet DMA buffers in SRAM3, USB DMA in SRAM4, CPU-accessed application data in AXI SRAM achieves maximum throughput without bus arbitration delays. The data sheet's 'bus matrix' diagram is the tool for understanding which master can access which SRAM region without stalling another master. This level of memory architecture analysis is the difference between a system that works and one that sustains wire-speed Ethernet while simultaneously running control algorithms.",
          ],
          resources: [
            { label: "STM32H7 memory map and cache management (AN4838)", url: "https://www.st.com/resource/en/application_note/an4838-managing-memory-protection-unit-in-stm32-mcus-stmicroelectronics.pdf", type: "docs" },
            { label: "Memfault Interrupt — STM32H7 cache and DMA (coherency)", url: "https://interrupt.memfault.com/blog/cortex-m-cache", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "Embedded Artistry — memory & patterns (free)", url: "https://embeddedartistry.com/", type: "docs" },
        { label: "Memfault Interrupt — firmware size & memory", url: "https://interrupt.memfault.com/", type: "docs" },
      ],
      connections: [
        { to: "ll-cmemory", note: "Object pools and arena allocation are the low-level allocator skills, constrained" },
        { to: "os-filesystems", note: "Flash wear-leveling mirrors log-structured filesystem ideas" },
      ],
    },
  ],
});
