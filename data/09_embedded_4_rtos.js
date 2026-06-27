atlasAdd({
  id: "embedded",
  topics: [
    {
      id: "emb-rtos",
      title: "FreeRTOS",
      level: "Intermediate",
      body: [
        "Tasks (`xTaskCreate`, stack sizing, `vTaskDelayUntil` for periodic work), **queues** (the main communication primitive), semaphores (binary/counting/mutex with priority inheritance), event groups, task notifications (faster than semaphores 1:1), the `heap_1`–`heap_5` allocators, and stack-overflow detection via watermarks.",
        "FreeRTOS is the de-facto first RTOS; mastering its primitives transfers to Zephyr, ThreadX, and your own kernel.",
      ],
      subtopics: [
        {
          title: "Task model - TCB internals, stack, priorities, and task states",
          body: [
            "A FreeRTOS **task** is a C function that never returns — it is an infinite loop that does work, then blocks or delays. Internally, a task is represented by a **TCB (Task Control Block)**: a struct containing the task's stack pointer (the save area for all CPU registers on context switch), priority, state, name (for debugging), and FreeRTOS internal bookkeeping (notification value, event list item, delayed list item). The TCB is allocated from heap or statically; the stack is a separate contiguous memory region allocated at task creation.",
            "Creating a task: `xTaskCreate(function, name, stack_depth_words, param, priority, &handle)`. The `stack_depth_words` parameter is in **words** (4 bytes on ARM), not bytes — a common mistake. A task with 128 words has 512 bytes of stack. Too small and the task overflows its stack silently (in the worst case, corrupting the adjacent TCB or another task's stack). Sizing: start with 256 words, enable stack watermark measurement, observe the high-water mark (`uxTaskGetStackHighWaterMark(NULL)`), and trim to headroom + worst-case nesting depth × ISR frame size.",
            "Task **states**: Running (executing on CPU — only one at a time on single-core), Ready (eligible to run, waiting for CPU), Blocked (waiting for time or event — on a timer, semaphore, queue, notification, or event group), Suspended (removed from scheduling by `vTaskSuspend`, returned by `vTaskResume`). The scheduler maintains a **ready list** per priority (a doubly linked list of TCBs). The running task is always the highest-priority ready task. If two tasks share the highest priority, they time-share via round-robin on each tick.",
            "**Priorities** in FreeRTOS are numbered 0 (lowest) to `configMAX_PRIORITIES - 1` (highest). The idle task runs at priority 0. Your tasks should span a meaningful range: low priority for background logging, medium for sensor polling, high for motor control, highest for safety-critical shutdown. The priority ceiling protocol for mutex holders (see semaphores section) temporarily elevates a low-priority task holding a resource that a high-priority task needs — preventing priority inversion from deadlocking the system.",
            "**`vTaskDelayUntil`** vs `vTaskDelay`: `vTaskDelay(100)` blocks the calling task for 100 ticks from the *current moment*, not accounting for the time spent executing before the call. Over many iterations, this causes periodic tasks to drift (200 ms target becomes 201 ms, then 202 ms). `vTaskDelayUntil(&last_wake_time, 100)` blocks until `last_wake_time + 100`, and then updates `last_wake_time` — so the period is exact regardless of execution time, as long as execution time < period. Always use `vTaskDelayUntil` for periodic tasks.",
          ],
          resources: [
            { label: "FreeRTOS — tasks and co-routines documentation", url: "https://www.freertos.org/taskandcr.html", type: "docs" },
            { label: "Mastering the FreeRTOS Real Time Kernel (PDF, free)", url: "https://www.freertos.org/Documentation/02-Kernel/07-Books-and-manual/01-RTOS_book", type: "book" },
          ],
        },
        {
          title: "The FreeRTOS scheduler - preemptive fixed-priority and context switch mechanism",
          body: [
            "The FreeRTOS scheduler implements **fixed-priority preemptive scheduling with time-slicing for equal-priority tasks**. On every SysTick interrupt (at `configTICK_RATE_HZ`, typically 1000 Hz = 1 ms tick), the scheduler increments the tick count, unblocks any tasks whose delay has expired, and checks if a higher-priority task has become ready. If so, it triggers a **PendSV exception** (via `portYIELD()`) to perform the context switch.",
            "The **PendSV handler** is where the context switch happens. It is set to the lowest possible priority (priority 15) to ensure all other exceptions finish before the switch occurs. The PendSV handler: saves the current task's R4-R11 and (if using FPU) FPU registers onto the current task's stack using PSP, stores the updated PSP in the current TCB, calls the scheduler's `vTaskSwitchContext()` to update `pxCurrentTCB` to the highest-priority ready task, loads the new task's PSP from its TCB, pops R4-R11 and FPU registers from the new stack, and returns via EXC_RETURN — the CPU automatically pops R0-R3, R12, LR, PC, xPSR from the new stack, resuming the new task exactly where it blocked.",
            "The **tick interrupt** (SysTick) manages time. On each tick: increment `xTickCount`, walk the delayed task list (ordered by wakeup time — a sorted linked list), move any tasks whose wakeup time ≤ current tick from the delayed list to the ready list, and if any of these have higher priority than the current task, set the `xYieldPending` flag so the PendSV fires at the end of the SysTick handler. This is the sequence that makes `vTaskDelayUntil` accurate to one tick.",
            "**Tickless idle** (`configUSE_TICKLESS_IDLE = 1`) suppresses SysTick when the only ready task is the idle task, puts the MCU into sleep mode, and programs a wakeup at the time of the next scheduled event. This can reduce power by 90%+ compared to a constantly running 1 kHz SysTick. The tick count is corrected on wakeup using a hardware timer that continued running during sleep. Implementing tickless idle correctly requires a port-specific `vPortSuppressTicksAndSleep()` function — the STM32 FreeRTOS port provides one using the RTC or a low-power timer.",
            "Understanding the scheduler flow in full: a task calls `xQueueSend()` with no timeout → queue has space → data written → scheduler checks if a higher-priority task is blocked waiting on this queue → if yes, moves that task to ready list → since a higher-priority task is now ready, triggers PendSV → PendSV saves current task context, restores the higher-priority task's context → higher-priority task runs immediately, finds its message in the queue, processes it. Total latency from `xQueueSend` to the consumer task running: approximately 1-2 µs on a 168 MHz STM32F4 at 1 kHz tick rate, dominated by PendSV entry time.",
          ],
          resources: [
            { label: "FreeRTOS — scheduler internals (kernel documentation)", url: "https://www.freertos.org/Documentation/02-Kernel/04-API-references/01-Task-creation/00-Creating-a-task", type: "docs" },
            { label: "Memfault Interrupt — FreeRTOS tips and tricks", url: "https://interrupt.memfault.com/blog/freertos-tips-and-tricks", type: "docs" },
          ],
        },
        {
          title: "Queues - blocking semantics, ISR variants, and queue sets",
          body: [
            "A FreeRTOS **queue** is the primary inter-task communication primitive. It is a circular buffer of fixed-size items, with blocking semantics: a sender can block if the queue is full, a receiver can block if the queue is empty. This makes queues the correct pattern for producer-consumer pipelines where the production rate may temporarily exceed consumption. Contrast with semaphores (signals, not data) or task notifications (lightest, but only one notification per task).",
            "`xQueueCreate(length, item_size)` allocates a queue that holds `length` items of `item_size` bytes. Items are **copied by value** into the queue — this is important. Posting a pointer to a stack variable is a bug (the stack frame may be gone when the receiver reads it). Post by value for small items; for larger items, allocate from a memory pool and post a pointer to the pooled memory.",
            "Sending: `xQueueSend(handle, &item, wait_ticks)` copies `item` to the back. `xQueueSendToFront()` inserts at the front for priority override. `xQueueSendFromISR()` is the ISR-safe variant (does not check the calling context, uses `pxHigherPriorityTaskWoken`). Receiving: `xQueueReceive(handle, &buffer, wait_ticks)` copies from the front into `buffer`. `xQueuePeek` copies without removing. All functions return `pdPASS` or `errQUEUE_FULL`/`errQUEUE_EMPTY` depending on timeout.",
            "**Queue sets** allow a task to block on multiple queues/semaphores simultaneously — the task unblocks when any member has an item available. `xQueueCreateSet(capacity)` creates a set, `xQueueAddToSet(queue, set)` adds members, `xQueueSelectFromSet(set, ticks)` returns the handle of the first member that has data. This is the embedded equivalent of `select()`/`epoll()` — a task waiting for data from either UART or USB, whichever arrives first, without polling.",
            "A useful design pattern: **message passing with a memory pool**. Instead of copying large structs through queues (expensive), allocate from a fixed-size block pool (itself a queue of free pointers), fill the block, post the pointer to the work queue, the consumer processes it and returns the block to the pool. This gives zero-copy message passing with deterministic allocation (no heap fragmentation), bounded latency, and back-pressure: if the pool is empty, the producer blocks until a consumer finishes and frees a block.",
          ],
          resources: [
            { label: "FreeRTOS — queue API reference", url: "https://www.freertos.org/a00018.html", type: "docs" },
          ],
        },
        {
          title: "Semaphores and mutexes - priority inheritance and inversion",
          body: [
            "FreeRTOS provides three semaphore-like primitives: **binary semaphore** (signal between tasks/ISR and task, no ownership), **counting semaphore** (resource count), and **mutex** (mutual exclusion with priority inheritance). They differ in ownership semantics, ISR compatibility, and the critical additional feature of mutexes: priority inheritance.",
            "A **binary semaphore** is conceptually a queue of length 1 holding no data — just a token. `xSemaphoreGive()` puts the token; `xSemaphoreTake()` removes it. The giver and taker can be different tasks or ISRs (use `xSemaphoreGiveFromISR` from an ISR). Binary semaphores are for **signaling**: ISR fires, gives semaphore, task takes it and does work. They carry no ownership — any task can Give, any task can Take.",
            "A **mutex** (`xSemaphoreCreateMutex()`) is a binary semaphore with two additions: (1) **ownership** — the task that Takes the mutex is its owner and must be the one that Gives it back (enforced by assertion in debug builds), (2) **priority inheritance** — if a low-priority task holds a mutex and a high-priority task tries to take it (and blocks), the scheduler temporarily raises the low-priority task's priority to that of the blocked high-priority task, so it finishes the critical section and releases the mutex quickly. Without priority inheritance, the medium-priority task could preempt the low-priority task while it holds the mutex, indefinitely delaying the high-priority task — **priority inversion**.",
            "**Priority inversion** is not just theoretical. The Mars Pathfinder mission in 1997 experienced priority inversion between a low-priority meteorological data task, a medium-priority communication task, and a high-priority bus management task — the bus manager was starved while waiting for a mutex held by the meteorological task, which was preempted by the communication task. The watchdog fired and reset the spacecraft. The fix (enabling priority inheritance) was uploaded from Earth. Use mutexes, not binary semaphores, for protecting shared resources.",
            "**Do not use mutexes from ISRs**. ISRs cannot block, and priority inheritance is meaningless in interrupt context. For ISR-to-task signaling, use binary semaphores or (better) task notifications. For ISR-safe resource protection, use critical sections (`BASEPRI` masking) within the ISR for the minimum time needed. The only RTOS primitives safe in ISRs are the `FromISR` variants of semaphore give, queue send/receive, task notification give, and event group set-bits.",
          ],
          resources: [
            { label: "FreeRTOS — semaphore and mutex API reference", url: "https://www.freertos.org/a00113.html", type: "docs" },
            { label: "Mars Pathfinder priority inversion incident", url: "https://www.rapitasystems.com/blog/what-really-happened-software-mars-pathfinder-spacecraft", type: "docs", note: "classic real incident, worth reading" },
          ],
        },
        {
          title: "Memory management - heap_1 through heap_5, static allocation, and stack watermarks",
          body: [
            "FreeRTOS provides five heap implementations, selectable by including the appropriate `heap_N.c` file. The choice is a fundamental embedded design decision with safety and fragmentation implications.",
            "`heap_1`: simplest — allocate only, never free. Memory is taken from a static array. Deterministic, no fragmentation, but tasks/queues/semaphores cannot be deleted. Suitable for systems that initialize once and run forever.",
            "`heap_2`: allows freeing but no coalescing. Freed blocks go back to a sorted free list but are never merged with adjacent free blocks. This prevents unbounded fragmentation growth for equal-size allocations (like a system that allocates/frees many equal-size messages), but will fragment for variable-size patterns.",
            "`heap_4`: allows freeing **with coalescing**. Adjacent free blocks are merged into one larger block. This handles variable-size allocation patterns without growing fragmentation over time. It is the most commonly used heap for general-purpose FreeRTOS applications. `heap_5` extends this to allow the heap to span multiple non-contiguous memory regions (e.g. SRAM1 + SRAM2).",
            "**Static allocation** (`configSUPPORT_STATIC_ALLOCATION = 1`) allows creating tasks, queues, and semaphores from statically declared arrays — no heap involved. You provide the TCB buffer, the stack buffer, and (for queues) the storage buffer explicitly. This is the correct approach for safety-critical or MISRA-compliant systems: all RAM usage is known at compile time, eliminates heap fragmentation concerns entirely, and passes audits that require no dynamic allocation.",
            "**Stack overflow detection**: FreeRTOS supports two methods (selected by `configCHECK_FOR_STACK_OVERFLOW`). Method 1: after each context switch, check if the stack pointer has gone below the stack region start. Method 2: fill the stack region with a known pattern (0xA5) at creation; periodically check if the last few bytes of the stack have been overwritten. Method 2 catches stack corruptions that happen to restore the stack pointer before the check. The overflow hook `vApplicationStackOverflowHook(task, name)` is called on detection — log the task name and halt. `uxTaskGetStackHighWaterMark(NULL)` returns the minimum free words ever observed for the current task — use this during development to right-size stacks.",
          ],
          resources: [
            { label: "FreeRTOS — memory management documentation", url: "https://www.freertos.org/a00111.html", type: "docs" },
          ],
        },
        {
          title: "Event groups, software timers, and the idle hook",
          body: [
            "**Event groups** (also called event flags) hold a 24-bit bitfield, where each bit represents an independent event. Tasks can set any bits (`xEventGroupSetBits`), and other tasks can block waiting for any-bit or all-bit conditions (`xEventGroupWaitBits` with `xWaitForAllBits` flag). This is the natural primitive for 'wait until subsystem A and subsystem B are both initialized', or 'wait until any of these three error conditions appears'. An ISR version (`xEventGroupSetBitsFromISR`) is available.",
            "Event groups are also useful for broadcasting: a single `xEventGroupSetBits` call wakes all tasks blocked on that bit, whereas a semaphore give wakes only one waiter. Use event groups for **fan-out signaling** (one event → multiple consumers) and semaphores/notifications for **fan-in signaling** (one producer → one consumer). Mixing up which primitive fits which pattern leads to subtle lost-wakeup bugs.",
            "**Software timers** (`xTimerCreate`) provide one-shot or periodic callbacks executed in the **timer daemon task** (a FreeRTOS task created at startup). Timers are serviced from a queue: starting, stopping, resetting, or changing a timer posts a command to the daemon queue, and the daemon executes it. Timer callbacks run at the priority of the daemon task (`configTIMER_TASK_PRIORITY`); they must not block. Software timers have tick-level resolution (1 ms at 1 kHz tick) and are suitable for timeouts, debouncing, and heartbeat/watchdog refreshes. For microsecond-resolution timing, use hardware timers in output-compare mode.",
            "The **idle task** (`prvIdleTask`) runs when no other task is ready. Its priority is 0, the lowest. It performs stack cleanup (`prvCheckTasksWaitingTermination` — delayed deletion of tasks that called `vTaskDelete` on themselves), and calls `vApplicationIdleHook()` if `configUSE_IDLE_HOOK = 1`. The idle hook is where you put `__WFI()` (Wait For Interrupt) to sleep the CPU until the next interrupt, saving power. The idle hook must never block and must return (unlike tasks, which loop forever).",
            "A production system also needs a **watchdog**. Configure the IWDG (Independent Watchdog) for a timeout of 2-5x the maximum expected task latency. Create a high-priority watchdog task that refreshes the IWDG on every cycle. If any task gets stuck (deadlock, infinite loop, HardFault that does not halt execution), the watchdog task stops running, the IWDG times out, and the MCU resets. Store the reset cause in backup SRAM and log it on startup — this gives a post-mortem breadcrumb that the watchdog fired. Without a watchdog, a stuck firmware running a safety-critical system is catastrophically dangerous.",
          ],
          resources: [
            { label: "FreeRTOS — software timers documentation", url: "https://www.freertos.org/RTOS-software-timer.html", type: "docs" },
            { label: "FreeRTOS — event groups documentation", url: "https://www.freertos.org/FreeRTOS-Event-Groups.html", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "FreeRTOS — documentation & free book", url: "https://www.freertos.org/Documentation/00-Overview", type: "docs" },
        { label: "Mastering the FreeRTOS Real Time Kernel (PDF)", url: "https://www.freertos.org/Documentation/02-Kernel/07-Books-and-manual/01-RTOS_book", type: "book" },
      ],
      connections: [
        { to: "os-process", note: "RTOS scheduling is the embedded cousin of OS scheduling (priority, preemption)" },
        { to: "os-concurrency", note: "Mutexes, semaphores and priority inversion are shared concurrency theory" },
        { to: "emb-rtos-own", note: "Using FreeRTOS well is prerequisite to writing your own kernel" },
      ],
    },
  ],
});
