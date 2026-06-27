atlasAdd({
  id: "embedded",
  topics: [
    {
      id: "emb-lowpower",
      title: "Low-power design",
      level: "Advanced",
      body: [
        "ARM low-power modes (Sleep/Stop/Standby — wake sources, startup time), power domains (keeping just RTC + backup RAM alive), clock gating, power profiling (Nordic PPK2, measuring μA), and energy harvesting (sizing solar/supercap for a duty cycle).",
        "Getting a sensor node to single-digit-μA average is its own deep optimization discipline.",
      ],
      subtopics: [
        {
          title: "ARM low-power modes - WFI/WFE, Sleep, Stop, and Standby",
          body: [
            "Cortex-M provides a hierarchy of power states, each trading off **power consumption vs resume latency**. Understanding this tradeoff precisely is the first step to meeting a power budget: you choose the deepest state whose resume latency fits within your application's response time requirement.",
            "`WFI` (Wait For Interrupt) is the one-instruction entry into **Sleep mode**. The CPU halts; all SRAM and peripheral state is preserved; the AHB bus clock stops. All interrupts (any pending or incoming IRQ) wake the CPU. Resume latency: 1-2 clock cycles. Active current on an STM32L4 at 4 MHz: ~1 mA. Sleep current: ~200 µA. This mode is the correct choice when the CPU is idle but peripherals (ADC, UART, DMA) are still running and may produce data at any moment.",
            "**Stop mode** (STM32 family): the main oscillator (HSE, HSI, PLL) is switched off. Only the LSI (32 kHz RC) or LSE (32.768 kHz crystal) can run for the RTC and the Low-Power Timer (LPTIM). SRAM and peripheral register state is retained. NVIC wake sources must be EXTI lines (GPIO edge, RTC alarm, USART wake-on-byte with LSI). Resume: the CPU boots from the Stop mode wakeup vector, re-enables the PLL, waits for PLL lock (~100-200 µs), and resumes. Current in Stop2 mode on STM32L4: ~0.4 µA with RTC running. This is the mode for sleeping between measurements in a sensor node — sleep for 10 seconds, wake, sample, transmit, sleep again.",
            "**Standby mode**: most of SRAM is powered off (only 4KB of Backup SRAM and RTC registers survive). The RTC continues running. Wake sources are WKUP pins (specific GPIOs), RTC alarm, or RTC tamper. On wakeup, the system resets from the beginning (vector table, startup code, main) — equivalent to a cold start. Current: ~0.5 µA. Use Standby when the system will be asleep for minutes to hours and data continuity is not required (or backed up to the small Backup SRAM / external flash before sleep).",
            "**Shutdown mode** (available on some STM32L4+/L5 devices): the entire voltage regulator is powered off except for the wakeup comparator. Only RTC can run. No SRAM. Current: ~30 nA. Wake: only WKUP pins. This is the deepest available state and is used for shipping-mode in consumer electronics (device powered off in the box, wakes when a button is pressed). The tradeoff: WKUP pin pull-down leakage and PCB leakage current can dominate at this level — the MCU is no longer the limiting factor.",
          ],
          resources: [
            { label: "ST — STM32L4 low-power modes application note AN4767", url: "https://www.st.com/resource/en/application_note/an4767-introduction-to-stm32-microcontrollers-low-power-consumption-stmicroelectronics.pdf", type: "docs" },
            { label: "Nordic Semiconductor — low power design (nRF52)", url: "https://infocenter.nordicsemi.com/topic/ps_nrf52840/power.html", type: "docs" },
          ],
        },
        {
          title: "Clock gating, dynamic voltage/frequency scaling, and peripheral power control",
          body: [
            "Even in active mode, most of the power consumed by a microcontroller is in the **clock distribution tree and clocked peripherals**. Clock gating — disabling the clock to peripherals that are not in use — is the first and cheapest optimization: it requires only a register write and saves power proportional to the switching activity of the gated logic.",
            "On STM32, the **RCC (Reset and Clock Control)** peripheral has enable bits for every peripheral clock in `RCC_AHBxENR` and `RCC_APBxENR` registers. After initialization but before entering an idle loop, disable every peripheral you are not using: `RCC->AHB2ENR &= ~RCC_AHB2ENR_GPIOBEN;` disables GPIOB's clock. Savings: each unused peripheral at 168 MHz contributes 50-500 µA of clock-switching current. Disabling all unused peripherals on an STM32F4 application can reduce active current by 30-50%.",
            "**Dynamic Voltage/Frequency Scaling (DVFS)**: at lower clock frequencies, the supply voltage can be reduced (lower switching losses: $P \\propto C V^2 f$). STM32L4 and similar ultra-low-power MCUs support voltage range selection: at 1.0V, maximum frequency drops to 16 MHz but power consumption drops dramatically. For a task that is memory-bandwidth-limited (e.g. copying data) rather than compute-limited, running at 16 MHz/1.0V vs 80 MHz/1.2V may take 5x longer but consume less total energy (energy = power × time; if power drops 10x and time increases 5x, net energy is halved). Always calculate **energy per operation**, not just power.",
            "**GPIO power management**: every GPIO configured as input with no pull-up/pull-down and floating will oscillate, drawing dynamic current as the Schmitt trigger bounces. In Stop/Standby mode, configure all unused GPIO pins as analog (analog mode disables the Schmitt trigger input buffer, eliminating the oscillation current). This is documented in ST application notes as the single largest contributor to unexpectedly high Stop mode current in student and prototype designs.",
            "**Peripheral wakeup from Stop mode with UART**: with STM32L4's LPUART (Low-Power UART), the UART receiver can operate from the LSE (32.768 kHz) in Stop mode, wake the MCU on receipt of a byte (address match or any byte), and the CPU picks up the full message after PLL restart. This enables truly autonomous wake-on-command operation — the MCU sleeps until a command arrives from a host, processes it, and returns to sleep — achieving sub-µA average current for command-driven devices.",
          ],
          resources: [
            { label: "ST — low-power application design AN5289", url: "https://www.st.com/resource/en/application_note/an5289-getting-started-with-stm32wb55-peripheral-power-mode-management-stmicroelectronics.pdf", type: "docs" },
          ],
        },
        {
          title: "Power profiling - Nordic PPK2, current measurement, and the µA regime",
          body: [
            "You cannot optimize what you cannot measure. Power profiling in embedded requires hardware tools capable of measuring current at the **µA level with millisecond time resolution** — a combination not achievable with a standard multimeter (insufficient sensitivity) or an oscilloscope (measures voltage, not current).",
            "The **Nordic Power Profiler Kit II (PPK2)** is the de-facto standard tool for embedded current measurement. It measures supply current to your device with 1-µA resolution, up to 1 A, with 100 kHz sampling rate and a direct USB interface to the Nordic Power Profiler desktop application. You see a time-domain plot of current vs time — you can zoom in to see exactly how long each sleep mode lasts, what each wake burst consumes, and the leakage current at rest. At $100, it is the best ROI tool in embedded power engineering.",
            "Alternative measurement: a **low-value shunt resistor** (10Ω or 100Ω for µA ranges) in series with VCC, monitored by an oscilloscope with a differential probe or a precision ADC. The voltage across the shunt equals I × R: 10 µA through 100Ω gives 1 mV — at the noise floor of most oscilloscopes. Use a dedicated current probe (LeCroy CP031, Tektronix TCP0030) for higher precision, or use the INA219/INA3221 (precision current-sense amplifier with I2C, 12-bit ADC, 400 µA to 26A range, ±1% accuracy) integrated directly on the board.",
            "**Battery lifetime calculation**: average current $I_{avg} = I_{active} \\times D + I_{sleep} \\times (1-D)$ where $D$ is duty cycle (fraction of time active). For a 1000 mAh coin cell and $I_{avg}$ = 10 µA: lifetime = 1000 mAh / 0.010 mA = 100,000 hours ≈ 11 years — battery life exceeds battery shelf life. But at 100 µA average: 10,000 hours ≈ 1.1 years. The difference between 10 µA and 100 µA is the difference between a 10-year device and an annual-battery-replacement product. This is why single-digit-µA average current is worth significant engineering effort.",
            "**Common power bugs**: (1) Leaving a GPIO in input mode without pull-up/pull-down in Stop mode (adds 10-100 µA from oscillating input). (2) Forgetting to disable the 32 kHz LSE oscillator output (drives an unused GPIO, drawing 5 µA). (3) Leaving I2C/SPI peripheral in an active-clock state while sleeping. (4) An attached sensor drawing current in Stop mode via its pull-up resistors — sensor power must be switched off (use a P-MOSFET load switch) before entering Stop mode. (5) USB D+ pull-up resistor staying asserted, drawing 1.5 mA from the host. Profile first, fix individually, confirm improvement — do not guess.",
          ],
          resources: [
            { label: "Nordic PPK2 — product page and Power Profiler app", url: "https://www.nordicsemi.com/Products/Development-hardware/Power-Profiler-Kit-2", type: "tool" },
            { label: "Memfault Interrupt — low power measurement techniques", url: "https://interrupt.memfault.com/blog/low-power-firmware-profiling", type: "docs" },
          ],
        },
        {
          title: "Duty-cycle optimization and tickless idle",
          body: [
            "The fundamental pattern for battery-operated embedded systems is **burst-then-sleep**: stay powered down for most of the time, wake up briefly to sample, compute, and transmit, then return to sleep. The fraction of time spent active is the **duty cycle** D. Minimizing D (while meeting all application requirements) is the primary low-power optimization objective.",
            "**Optimizing wake burst duration**: every microsecond of active time costs energy. Profile the wake burst with PPK2 or a GPIO toggle + scope: (1) PLL startup time (~100-200 µs on STM32L4), (2) sensor measurement time (ADC conversion, I2C read), (3) computation (e.g. filter, threshold check), (4) transmission (BLE advertisement, LoRa packet), (5) pre-sleep housekeeping. Each phase should be minimized: pre-configure peripherals that support it (ADC in low-power auto-conversion mode), cache sensor config in SRAM to avoid re-sending it, use the fastest transmission mode for the data size.",
            "**Tickless idle** in FreeRTOS (covered in the RTOS topic) is the software half of low-power operation. Without it, SysTick fires 1000 times/second even during Stop mode, waking the CPU to run the scheduler and returning to Stop mode — adding up to hundreds of µA of unnecessary active time. With tickless idle, the CPU enters Stop mode and only wakes when a real event occurs (GPIO edge, RTC alarm, UART byte). Combined with aggressive peripheral clock gating and GPIO analog mode, a typical FreeRTOS application can achieve 1-5 µA average current in periodic-sensing applications.",
            "The **wakeup sequence time** is the latency from the wakeup event to the first instruction of the application running at full speed. On STM32L4: LPTIM wakeup from Stop2 → HSI16 auto-enable (1 µs) → software re-enables PLL (200 µs wait for lock) → switch SYSCLK to PLL (1 µs) → resume RTOS tasks. The 200 µs PLL lock time is the dominant delay. For applications that need sub-millisecond response time, either run from HSI16 directly (no PLL) at lower frequency, or use a lower-power MCU with faster PLL lock (nRF52840 PLL locks in 10-50 µs from radio-optimized PLL).",
            "**Duty cycle calculation for sensor nodes**: target a 5-year battery life from a 2000 mAh AA cell. Average current budget: 2000 mAh / (5 × 8760 h) ≈ 46 µA average. If the MCU draws 3 mA active and 1 µA in Stop2, and transmission draws 20 mA for 5 ms every 10 seconds: average current = (3 mA × 0.1 s + 20 mA × 0.005 s) / 10 s + 1 µA = (300 µA + 100 µA) / 10 + 1 µA = 41 µA. This meets the 46 µA budget with slight margin. Increasing the sample period to 15 seconds gives more margin; adding a second sensor that wakes the MCU for another 50 ms changes the math significantly. Systematic energy budgeting before hardware selection avoids discovering your MCU choice is 5x over budget at prototype stage.",
          ],
          resources: [
            { label: "FreeRTOS — tickless idle (configUSE_TICKLESS_IDLE)", url: "https://www.freertos.org/low-power-tickless-rtos.html", type: "docs" },
          ],
        },
        {
          title: "Energy harvesting - solar, thermoelectric, supercapacitor sizing, and MPPT",
          body: [
            "Energy harvesting replaces or supplements batteries by converting ambient energy (light, heat, RF, vibration) into electrical power. It enables indefinite device lifetimes — a solar-powered sensor node lasts as long as the hardware, not the battery. The engineering discipline is tight: harvested power is small and variable, and the load must be shaped to stay within the harvested envelope.",
            "**Solar harvesting**: a small solar panel (e.g. 5 cm × 5 cm amorphous silicon, ~1 mW peak in office light, 10-50 mW in direct sunlight) produces open-circuit voltage of 3-6V. The operating point that maximizes power output is the **Maximum Power Point (MPP)**, which depends on light intensity and load. **MPPT (Maximum Power Point Tracking)** algorithms (perturb-and-observe, incremental conductance) periodically vary the load to track the MPP as conditions change. ICs like the AEM10941 or BQ25505 implement MPPT with a boost converter, cold-start from voltages as low as 80 mV, and charge management for a supercapacitor or rechargeable battery.",
            "**Thermoelectric harvesting**: a TEG (Thermoelectric Generator) produces voltage proportional to the temperature differential across it: V = N × S × ΔT where N is the number of junctions, S is the Seebeck coefficient (~200 µV/K for Bi₂Te₃), and ΔT is the temperature difference in Kelvin. A 20°C differential on a standard 40-junction module produces ~160 mV open-circuit, with an optimum load current in the µA-mA range. Because the output voltage is very low, a high-efficiency boost converter with ultra-low startup voltage (like the LTC3108, operational from 20 mV) is required. TEG harvesting is viable in industrial environments (machinery, pipelines) with persistent thermal gradients.",
            "**Supercapacitor sizing**: a supercapacitor (EDLC, electrochemical double-layer capacitor) is the ideal intermediate storage for energy harvesting: millions of charge/discharge cycles (vs ~1000 for Li-Po), wide temperature range, high peak current capability. Sizing: $C = \\frac{2 E}{V_{max}^2 - V_{min}^2}$ where E is energy needed to sustain load during the worst-case no-harvest period (e.g., 3 days of darkness). For E = 100 mJ (10 µA × 3.3V × 3 days ≈ adequate margin), V_max = 3.3V, V_min = 1.8V (minimum for MCU operation): $C = \\frac{2 \\times 0.1}{3.3^2 - 1.8^2} = \\frac{0.2}{10.89 - 3.24} \\approx 26 mF$. A 100 mF supercapacitor provides comfortable margin.",
            "**System design for harvesters**: the harvester charges the supercapacitor during daylight; the MCU draws from the supercapacitor. A comparator or the PMIC monitors supercapacitor voltage: if voltage drops below V_min (MCU loses regulation), shut down gracefully — write state to non-volatile memory and enter Standby. On voltage recovery, restart with the saved state. This **brownout graceful degradation** is what separates a prototype from a deployable node. Commercial PMIC solutions (AEM10941, SPV1050, BQ25505) handle the MPPT, boost conversion, and comparator signaling as an integrated system, leaving the MCU to focus on the application.",
          ],
          resources: [
            { label: "Texas Instruments — BQ25505 energy harvesting PMIC datasheet", url: "https://www.ti.com/product/BQ25505", type: "docs" },
            { label: "e-peas — AEM10941 solar energy harvester (ultra-low power)", url: "https://e-peas.com/products/aem10941/", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "Nordic — Power Profiler Kit II (PPK2)", url: "https://www.nordicsemi.com/Products/Development-hardware/Power-Profiler-Kit-2", type: "tool" },
        { label: "ST — STM32 low-power application notes", url: "https://www.st.com/en/microcontrollers-microprocessors/stm32-32-bit-arm-cortex-mcus.html", type: "docs" },
      ],
      connections: [
        { to: "emb-rtos", note: "Tickless idle in the RTOS is the software side of low-power operation" },
      ],
    },
  ],
});
