atlasAdd({
  id: "embedded",
  topics: [
    {
      id: "emb-interrupts",
      title: "Interrupts deeply",
      level: "Intermediate",
      body: [
        "The **NVIC** (priority levels, preemption, sub-priority, pending vs active), ISR rules (as short as possible, no blocking/`printf`/`malloc`), interrupt latency (tail-chaining — why Cortex-M is deterministic), critical sections (`BASEPRI` masking), and deferred processing (ISR sets a flag; main loop or a queue does the work).",
        "Interrupts are where real-time correctness is won or lost.",
      ],
      subtopics: [
        {
          title: "The Cortex-M exception model - types, vector table, and stack frame",
          body: [
            "On Cortex-M, 'exception' is the unified term for anything that interrupts normal execution: hardware faults, software traps, and peripheral interrupts are all exceptions, handled through the same mechanism. There are 16 system exceptions (fixed, ARM-defined) and up to 240 external IRQs (vendor-defined). The system exceptions in priority order: Reset (-3, highest), NMI (-2), HardFault (-1), MemManageFault (4), BusFault (5), UsageFault (6), SVCall (11), DebugMonitor (12), PendSV (14), SysTick (15). The first three have fixed negative priorities that cannot be changed. External IRQ priorities are configurable.",
            "When an exception fires, the CPU automatically **stacks the exception frame** — 8 registers are pushed to the currently active stack (MSP in Thread mode with CONTROL.SPSEL=0, or PSP in Thread mode with CONTROL.SPSEL=1): xPSR, PC (return address), LR (EXC_RETURN magic value), R12, R3, R2, R1, R0. On FPU-equipped M4F/M7 with lazy stacking enabled, the FPU state is also pushed if the ISR uses FPU instructions. The CPU then jumps to the handler (fetched from the vector table). Critically, **no software push is required** — the CPU does it in hardware in a single cycle with the bus interface, overlapped with the prefetch of the vector address.",
            "The **EXC_RETURN** value (loaded into LR by the CPU on exception entry) encodes the context to restore: which stack (MSP/PSP), whether the FPU state was stacked, and whether to return to Thread or Handler mode. On ISR exit, the CPU sees `EXC_RETURN` in PC (values of the form `0xFFFFFFxx`) and performs exception return: pops the stacked frame, restores the CPSR, and resumes execution. You never call the ISR as a function and never explicitly return to it — the mechanism is entirely hardware-controlled.",
            "**Fault exceptions** fire on programming errors. HardFault is the catch-all: any fault that cannot be handled by a specific fault handler (because it is disabled or unprioritized). MemManageFault catches MPU violations. BusFault catches bus errors (invalid address, alignment fault). UsageFault catches undefined instructions, invalid state (e.g. popping a bad PC), divide-by-zero (if enabled), and unaligned access (if strict alignment is enabled). The CFSR (Configurable Fault Status Register) at `0xE000ED28` contains sticky flags indicating exactly which fault fired — the first step in any HardFault handler is to read and log the CFSR, BFAR (bus fault address), and MMFAR (MemManage fault address).",
            "**Nested exceptions** are hardware-supported: if a higher-priority exception fires while a lower-priority handler runs, the CPU automatically saves the current handler's context and enters the higher-priority handler. On returning, it resumes the lower-priority one. This requires no software intervention and enables deterministic response times for high-priority interrupts regardless of what lower-priority handlers are doing. The nesting depth is limited only by stack space — every level uses ~40 bytes of stack (8 registers × 4 + possible FPU frame), so a 1KB stack supports ~25 levels of nesting safely.",
          ],
          resources: [
            { label: "ARM Cortex-M — exception model documentation", url: "https://developer.arm.com/documentation/dui0552/a/the-cortex-m3-processor/exception-model", type: "docs" },
            { label: "Memfault Interrupt — Cortex-M exceptions and NVIC deep dive", url: "https://interrupt.memfault.com/blog/arm-cortex-m-exceptions-and-nvic", type: "docs" },
          ],
        },
        {
          title: "NVIC - priority grouping, preemption, tail-chaining, and interrupt latency",
          body: [
            "The **NVIC (Nested Vectored Interrupt Controller)** manages all external IRQ priorities, enabling, pending, and active states. Each IRQ has an 8-bit priority register, but Cortex-M defines only the top N bits are implemented (N = 3 on M0, 4 on some M3, up to 8 on M7 — typically 4 on STM32). With 4 bits (priority values 0–15), lower number = higher priority. Priority 0 is the highest configurable priority; priorities below the current BASEPRI setting are masked.",
            "**Priority grouping** (configured via SCB_AIRCR.PRIGROUP) splits the 4 implemented bits into **preempt priority** (group) and **sub-priority** (within group). Example with 2 preempt bits + 2 sub-priority bits: preempt priority determines which interrupts can nest (a higher preempt-priority ISR interrupts a lower one). Sub-priority only breaks ties when two interrupts of the same preempt priority are pending simultaneously — it does not enable nesting between them. Get this wrong and two same-preempt-priority ISRs that share data still have a race condition despite being at 'different priorities'.",
            "**Tail-chaining** is the Cortex-M optimization that explains its deterministic interrupt latency. When an exception handler finishes and another exception is pending, instead of unstacking the current frame and re-stacking for the next handler (which would waste 12+ cycles), the CPU skips the unstack-restack and jumps directly to the next handler — the stack frame is already there and only the PC and exception number change. This is why back-to-back ISRs cost 6 cycles each rather than the full 12-cycle stack + 12-cycle unstack sequence. In practice, a burst of UART bytes can be processed with near-zero overhead per byte.",
            "**Late arrival** is a related optimization: if a higher-priority exception arrives during the stacking of a lower-priority exception (which takes several cycles), the CPU switches to fetching the higher-priority vector instead, handling the high-priority exception first, then tail-chaining to the lower-priority one. The stacking already done is reused. The result: a high-priority interrupt is serviced within a guaranteed worst-case latency even if a lower-priority exception was already being entered — a property essential for hard real-time systems.",
            "**Interrupt latency** on Cortex-M3/M4 is specified as 12 cycles from assertion of the interrupt signal to the first instruction of the ISR (assuming zero wait states, no higher-priority exception active, and the vector table is in flash with no cache miss). This determinism is the architectural property that makes Cortex-M suitable for real-time control. For comparison, a Linux kernel interrupt latency is measured in microseconds (hundreds of cycles at minimum) due to interrupt-enable/disable, preemption point checking, and interrupt thread scheduling. Bare-metal Cortex-M beats this by 2-3 orders of magnitude.",
          ],
          resources: [
            { label: "Memfault Interrupt — NVIC priority deep dive", url: "https://interrupt.memfault.com/blog/arm-cortex-m-exceptions-and-nvic", type: "docs" },
            { label: "ARM — Cortex-M tail-chaining and late arrival (application note)", url: "https://developer.arm.com/documentation/dai0321/latest/", type: "docs" },
          ],
        },
        {
          title: "ISR rules - short handlers, no blocking, and deferred processing patterns",
          body: [
            "The cardinal rule of ISR design: **get in, get out**. The ISR should do the minimum necessary to service the hardware and signal a flag or post data to a queue; all processing happens in the main loop or an RTOS task. Long ISRs block lower-priority interrupts for their entire duration, destroying real-time properties. An ISR that takes 100 µs to execute means a lower-priority interrupt at 50 Hz effectively gets delayed by up to 100 µs on every cycle, easily missing its deadline.",
            "**Prohibited in ISRs**: calling `printf` or any function that calls `malloc` (both use locks, or at minimum non-reentrant state that an interrupted allocation would corrupt), blocking on a semaphore (the scheduler is not active in an ISR context — a blocking call will deadlock), performing UART TX by polling (will block for the entire character duration at the baud rate), and calling HAL functions marked 'not interrupt-safe' (many ST HAL functions). Some RTOS APIs have `FromISR` variants (e.g. `xQueueSendFromISR`, `xSemaphoreGiveFromISR`) that are safe; always use these instead of the non-ISR variants.",
            "The **flag pattern** is the simplest deferred processing approach: the ISR sets a `volatile` flag (or increments a counter), and the main loop polls it. The main loop clears the flag and processes. For N events between polls, the counter records how many occurred. The race condition to avoid: main reads the flag, decides to act, but before it clears the flag another ISR fires and sets it again — and then main clears it, losing that second event. Solution: in the main loop, disable interrupts briefly while reading and clearing, or use an atomic compare-exchange.",
            "The **ring buffer (circular buffer)** pattern separates producer (ISR) and consumer (main loop or task) without requiring a shared lock, provided there is only one producer and one consumer. The ISR writes to `buf[head++ % N]` and the main loop reads from `buf[tail++ % N]`. The key: `head` is written only by the ISR, `tail` only by the consumer. With volatile semantics and a single-reader/single-writer constraint, the only necessary synchronization is ensuring the data write completes before the head update (a data memory barrier). This pattern is how nearly every UART receive buffer works.",
            "**FreeRTOS deferred processing** uses `xQueueSendFromISR()` or task notifications (`vTaskNotifyGiveFromISR()`). The ISR posts a message to a queue with `pxHigherPriorityTaskWoken` checked; if a higher-priority task was unblocked, the ISR must call `portYIELD_FROM_ISR(pxHigherPriorityTaskWoken)` at the end to request a context switch. Without this yield call, the high-priority task is woken but does not actually run until the next tick (a latency of up to 1 ms at 1 kHz tick). This is the correct pattern for low-latency interrupt-driven task activation, and omitting the yield is the most common FreeRTOS ISR bug.",
          ],
          resources: [
            { label: "FreeRTOS — interrupt-safe API documentation", url: "https://www.freertos.org/a00011.html", type: "docs" },
            { label: "Memfault Interrupt — using FreeRTOS queues from ISRs", url: "https://interrupt.memfault.com/blog/freertos-tips-and-tricks", type: "docs" },
          ],
        },
        {
          title: "Critical sections - PRIMASK, BASEPRI, and interrupt-safe access patterns",
          body: [
            "A **critical section** is a region of code that must execute atomically with respect to interrupts — typically because it reads and writes a shared variable that an ISR also modifies. On Cortex-M, there are several mechanisms to protect critical sections, each with different performance and real-time implications.",
            "`PRIMASK` (accessed via `__disable_irq()` / `__enable_irq()` or `__get_PRIMASK()` / `__set_PRIMASK()`) disables all interrupts except NMI and HardFault. This is the bluntest tool: maximum protection, maximum latency impact. Any interrupt that fires during the critical section will be delayed until `__enable_irq()`. For very short critical sections (a few instructions), this is fine. For anything more than a few microseconds, you are violating real-time guarantees for all other interrupts.",
            "`BASEPRI` is the right tool for RTOS critical sections. Setting `BASEPRI` to a value N masks all interrupts with priority ≥ N (numerically: masks priorities N through 255 if N=1, meaning all; or masks priorities 5-15 with N=5, leaving 0-4 active). FreeRTOS uses `BASEPRI` set to `configMAX_SYSCALL_INTERRUPT_PRIORITY` (typically a middle priority, e.g. 5): task-level FreeRTOS API calls are protected, but high-priority ISRs (above configMAX_SYSCALL_INTERRUPT_PRIORITY) can still fire and be serviced with minimal latency. These high-priority ISRs must use only FreeRTOS `FromISR` APIs or no FreeRTOS APIs at all.",
            "The **save/restore pattern** prevents accidental nesting of critical section disables: `uint32_t primask = __get_PRIMASK(); __disable_irq(); /* critical section */ __set_PRIMASK(primask);`. This correctly handles the case where interrupts were already disabled when the critical section was entered — without it, the `__enable_irq()` at the end would incorrectly re-enable interrupts that the outer code had disabled. Always use save/restore in library code that may be called from varying contexts.",
            "**Atomic operations** can sometimes replace critical sections entirely for simple shared variables. ARM provides `LDREX`/`STREX` (Load-Exclusive/Store-Exclusive) for software atomic compare-and-swap, and the `STM32F4` with `CMSIS` exposes these via `__LDREXW`/`__STREXW`. For simple flag setting, an aligned 32-bit write is already atomic on Cortex-M (bus transactions for aligned 32-bit accesses are single-cycle, non-interruptible). For increment/decrement of a counter shared between one ISR and one thread, use `LDREX`/`STREX` to avoid a dedicated critical section entirely. This is worth the effort for variables in hot paths.",
          ],
          resources: [
            { label: "Memfault Interrupt — critical sections on Cortex-M", url: "https://interrupt.memfault.com/blog/disable-interrupts-cortex-m", type: "docs" },
            { label: "FreeRTOS — configMAX_SYSCALL_INTERRUPT_PRIORITY documentation", url: "https://www.freertos.org/a00110.html", type: "docs" },
          ],
        },
        {
          title: "Deferred processing patterns - ring buffers, queues, and half-transfer DMA",
          body: [
            "Interrupt-driven embedded firmware always faces the same tension: the ISR must be fast, but the work triggered by the interrupt takes real time. The solution is always the same architectural pattern: the ISR captures the event and signals it cheaply, and a separate execution context (main loop, task, or DMA) does the heavy lifting. Different approaches exist for different latency and bandwidth requirements.",
            "**ISR flag + main loop polling** is the simplest. Suitable for infrequent events (button presses, error conditions) where the main loop runs fast enough. Weakness: if the main loop has long unbounded operations elsewhere (e.g. an I2C transaction taking 1 ms), the flag may be serviced late. Never use this pattern in a system where event latency must be bounded.",
            "**Ring buffer (circular FIFO)** decouples the ISR producer from the consumer. The ISR writes incoming bytes to a ring buffer; the consumer reads at its own pace. As long as the consumer is faster on average than the ISR and the buffer is large enough to absorb bursts, no bytes are lost. Correctly implemented with volatile head/tail pointers and the single-producer/single-consumer constraint, no locking is needed. For UART receive, the standard pattern is: UART RXNE interrupt → write byte to ring buffer → consumer (main loop or task) reads when available.",
            "**DMA double buffering with half-transfer interrupt** is the pattern for continuous high-bandwidth streams (audio, ADC, SPI displays). Configure DMA in circular mode with a buffer of 2N samples. The half-transfer interrupt fires after the first N samples are written (buffer[0..N-1] is complete, DMA writing buffer[N..2N-1]). The handler processes buffer[0..N-1]. The transfer-complete interrupt fires when buffer[N..2N-1] is complete; the handler processes that half. If processing takes less than the time to fill half a buffer, no samples are lost. This is the fundamental pattern of all real-time DSP on embedded — it is essentially the same double-buffer pattern used in GPU rendering.",
            "**Direct Task Notification** in FreeRTOS is the highest-performance deferred processing pattern. An ISR calls `vTaskNotifyGiveFromISR(task_handle, &higher_priority_task_woken)`. The notified task (blocked on `ulTaskNotifyTake(pdTRUE, portMAX_DELAY)`) becomes ready immediately at the next context switch. This replaces a binary semaphore with zero heap overhead (the notification is stored directly in the TCB), and the wakeup latency from ISR is one RTOS tick or less (with the `portYIELD_FROM_ISR` call at the ISR end, immediate). This is the preferred pattern for single-ISR-to-single-task signaling — a hardware event fires, a task handles it, repeat.",
          ],
          resources: [
            { label: "FreeRTOS — task notifications documentation", url: "https://www.freertos.org/RTOS-task-notifications.html", type: "docs" },
            { label: "Memfault Interrupt — ring buffer implementation", url: "https://interrupt.memfault.com/blog/ring-buffer", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "ARM Cortex-M — exception/interrupt model (docs)", url: "https://developer.arm.com/documentation/dui0552/a/the-cortex-m3-processor/exception-model", type: "docs" },
        { label: "Interrupts — Memfault / Interrupt blog", url: "https://interrupt.memfault.com/blog/arm-cortex-m-exceptions-and-nvic", type: "docs" },
      ],
      connections: [
        { to: "os-kernel", note: "Top-half/bottom-half ISR design is the same idea as kernel IRQ handling" },
        { to: "emb-rtos", note: "ISR-to-task signalling via queues/notifications is core RTOS usage" },
      ],
    },
  ],
});
