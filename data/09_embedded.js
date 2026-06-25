atlasAdd({
  id: "embedded",
  num: 9,
  title: "Embedded Programming",
  icon: "📟",
  color: "#73daca",
  tagline: "From blinking an LED to bare-metal RTOS kernels and safety-critical firmware.",
  overview: [
    "Embedded is systems programming with the safety net removed: no OS (or one you wrote), kilobytes of RAM, hard real-time deadlines, and code that controls physical hardware where a bug can be a fire. It forces a discipline — deterministic timing, static allocation, defensive programming — that makes you a better systems engineer everywhere.",
    "The arc: peripherals and protocols → bare-metal ARM and interrupts → RTOS (use one, then write one) → low-power, safety-critical, and hardware design. It shares the C memory model with low-level systems and the scheduler/driver concepts with OS.",
  ],
  topics: [
    {
      id: "emb-foundations",
      title: "MCU anatomy, GPIO & protocols",
      level: "Beginner",
      body: [
        "Microcontroller anatomy (CPU core, flash, SRAM, peripherals, clock tree), **GPIO** (pull-up/down, why floating pins are dangerous), the serial bus trio — **UART** (framing, baud), **I2C** (clock stretching, addressing), **SPI** (CPOL/CPHA, full-duplex) — plus PWM and ADC (Nyquist, oversampling).",
        "Embedded C essentials: `volatile` (don't let the optimizer drop hardware reads), bitfields, and bit manipulation with masks instead of `if` for registers.",
      ],
      resources: [
        { label: "Making Embedded Systems — Elecia White (book)", url: "https://www.oreilly.com/library/view/making-embedded-systems/9781449308889/", type: "book", note: "best embedded book" },
        { label: "Nandland — digital design & protocols (free)", url: "https://nandland.com/", type: "docs" },
        { label: "Sparkfun — I2C / SPI / UART tutorials", url: "https://learn.sparkfun.com/tutorials/i2c/all", type: "docs" },
      ],
      connections: [
        { to: "ll-cmemory", note: "volatile, bitfields and manual memory are low-level C made physical" },
        { to: "emb-baremetal", note: "Memory-mapped registers are how you drive all of this without a HAL" },
      ],
    },
    {
      id: "emb-baremetal",
      title: "Bare-metal ARM (STM32)",
      level: "Intermediate",
      body: [
        "ARM **Cortex-M** architecture (M0/M3/M4/M7, Thumb-2), register-level programming (memory-mapped I/O, reading datasheets), the **reset sequence** (vector table → reset handler → `SystemInit` → main), clock config (HSE/HSI, PLL — get it wrong and nothing works), **DMA** (offload the CPU), timers, and **linker scripts** (`.data` copied to RAM, `.bss` zeroed).",
        "Configuring an STM32 with no HAL — just registers — is the rite of passage that demystifies all higher-level embedded code.",
      ],
      resources: [
        { label: "STM32 bare-metal — vivonomicon (free series)", url: "https://vivonomicon.com/2018/04/02/bare-metal-stm32-programming-part-1-hello-arm/", type: "docs" },
        { label: "ARM Cortex-M — official developer resources", url: "https://developer.arm.com/Processors/Cortex-M4", type: "docs" },
        { label: "Bare-metal programming on STM32 — cpq/bare-metal-programming-guide", url: "https://github.com/cpq/bare-metal-programming-guide", type: "repo" },
      ],
      connections: [
        { to: "os-boot", note: "Vector tables, reset handlers and linker scripts mirror the OS boot path" },
        { to: "ll-abi", note: "Linker scripts and ELF sections are the same material, MCU-side" },
        { to: "emb-interrupts", note: "Peripheral DMA completion fires the interrupts you handle next" },
      ],
    },
    {
      id: "emb-interrupts",
      title: "Interrupts deeply",
      level: "Intermediate",
      body: [
        "The **NVIC** (priority levels, preemption, sub-priority, pending vs active), ISR rules (as short as possible, no blocking/`printf`/`malloc`), interrupt latency (tail-chaining — why Cortex-M is deterministic), critical sections (`BASEPRI` masking), and deferred processing (ISR sets a flag; main loop or a queue does the work).",
        "Interrupts are where real-time correctness is won or lost.",
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
    {
      id: "emb-rtos",
      title: "FreeRTOS",
      level: "Intermediate",
      body: [
        "Tasks (`xTaskCreate`, stack sizing, `vTaskDelayUntil` for periodic work), **queues** (the main communication primitive), semaphores (binary/counting/mutex with priority inheritance), event groups, task notifications (faster than semaphores 1:1), the `heap_1`–`heap_5` allocators, and stack-overflow detection via watermarks.",
        "FreeRTOS is the de-facto first RTOS; mastering its primitives transfers to Zephyr, ThreadX, and your own kernel.",
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
    {
      id: "emb-memory",
      title: "Memory-constrained programming",
      level: "Intermediate → Advanced",
      body: [
        "No-`malloc` discipline (static allocation, object pools), worst-case stack sizing (`uxTaskGetStackHighWaterMark`), flash optimization (`-Os`, LTO, `--gc-sections`), SRAM placement tricks, and flash wear-leveling (page/sector erase, write-endurance limits).",
        "When you have 64KB of RAM, every byte and every allocation is a deliberate decision.",
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
    {
      id: "emb-rtos-own",
      title: "Write your own RTOS & real-time analysis",
      level: "Advanced",
      body: [
        "Context switching on Cortex-M (the **PendSV** handler, saving r4-r11, PSP/MSP), building a scheduler (round-robin → priority-preemptive → tickless), sync primitives from scratch with LDREX/STREX, the **MPU** for catching stack overflows in hardware, and SVC for privilege separation. Plus real-time analysis: **rate-monotonic scheduling** (the 69% bound), EDF, and worst-case execution time.",
        "Writing a context switch by hand is the moment 'how does multitasking even work' becomes obvious.",
      ],
      resources: [
        { label: "Write an RTOS — Miro Samek (Modern Embedded Systems)", url: "https://www.youtube.com/playlist?list=PLPW8O6W-1chwyTzI3BHwBLbGQoPFxPAPM", type: "video" },
        { label: "The Definitive Guide to ARM Cortex-M (PendSV/context switch)", url: "https://developer.arm.com/documentation/dui0552/latest/", type: "docs" },
      ],
      connections: [
        { to: "os-kernel", note: "A context switch + scheduler is a microkernel — the OS material in miniature" },
        { to: "os-concurrency", note: "LDREX/STREX is load-linked/store-conditional — the CAS primitive in hardware" },
        { to: "emb-safety", note: "Real-time guarantees feed directly into safety-critical certification" },
      ],
    },
    {
      id: "emb-lowpower",
      title: "Low-power design",
      level: "Advanced",
      body: [
        "ARM low-power modes (Sleep/Stop/Standby — wake sources, startup time), power domains (keeping just RTC + backup RAM alive), clock gating, power profiling (Nordic PPK2, measuring μA), and energy harvesting (sizing solar/supercap for a duty cycle).",
        "Getting a sensor node to single-digit-μA average is its own deep optimization discipline.",
      ],
      resources: [
        { label: "Nordic — Power Profiler Kit II (PPK2)", url: "https://www.nordicsemi.com/Products/Development-hardware/Power-Profiler-Kit-2", type: "tool" },
        { label: "ST — STM32 low-power application notes", url: "https://www.st.com/en/microcontrollers-microprocessors/stm32-32-bit-arm-cortex-mcus.html", type: "docs" },
      ],
      connections: [
        { to: "emb-rtos", note: "Tickless idle in the RTOS is the software side of low-power operation" },
      ],
    },
    {
      id: "emb-safety",
      title: "Safety-critical embedded",
      level: "Advanced",
      body: [
        "Functional-safety standards (**IEC 61508** SILs, **ISO 26262** ASILs for automotive), **MISRA-C** (rules *and* rationale), defensive programming (assert everywhere, watchdogs, CRC on config), and formal verification for embedded (CBMC, Frama-C, TLA+).",
        "When firmware controls brakes or insulin pumps, 'works on my bench' is replaced by documented, analyzable correctness.",
      ],
      resources: [
        { label: "MISRA C — official site & guidelines", url: "https://misra.org.uk/", type: "docs" },
        { label: "Better Embedded System SW — Koopman", url: "https://betterembsw.blogspot.com/", type: "book" },
        { label: "CBMC — C Bounded Model Checker", url: "https://www.cprover.org/cbmc/", type: "tool" },
      ],
      connections: [
        { to: "comp-types", note: "Formal verification (CBMC/Frama-C) applies the proof methods from PLT" },
        { to: "crypto-tls", note: "Secure boot and signed firmware bring crypto into safety-critical systems" },
      ],
    },
    {
      id: "emb-hardware",
      title: "Hardware design & debugging",
      level: "Advanced",
      body: [
        "**KiCad** (schematic capture, PCB layout, DRC, Gerbers), decoupling capacitors (bypass on every VCC pin), high-speed design (50Ω impedance, differential pairs, ground planes), EMC basics, and **JTAG/SWD** debugging (J-Link, breakpoints, RTT logging).",
        "Designing and assembling a custom board closes the loop from firmware to physical product.",
      ],
      resources: [
        { label: "KiCad — official documentation", url: "https://docs.kicad.org/", type: "docs" },
        { label: "Phil's Lab — PCB design & embedded (YouTube)", url: "https://www.youtube.com/@PhilsLab", type: "video" },
      ],
      connections: [
        { to: "emb-foundations", note: "PCB design is where the GPIO/protocol theory becomes copper" },
      ],
    },
  ],
});
