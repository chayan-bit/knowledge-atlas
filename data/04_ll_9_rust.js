atlasAdd({
  id: "lowlevel",
  topics: [
    {
      id: "ll-rust",
      title: "Rust: ownership, unsafe & async",
      level: "Intermediate -> Advanced",
      body: [
        "**Ownership and borrowing** (how it eliminates data races and use-after-free at compile time), lifetimes and elision, `unsafe` (raw pointers, FFI, `extern \"C\"`), the `Send`/`Sync` concurrency contracts, and `async`/`await` (futures, `Pin`, the executor model).",
        "Rust is the pragmatic way to write systems code with C's performance and far fewer footguns - and FFI lets you adopt it incrementally.",
      ],
      subtopics: [
        {
          title: "Ownership, borrowing, and the borrow checker",
          body: [
            "Rust's **ownership system** is a compile-time memory management discipline that eliminates use-after-free, double-free, and data races without a garbage collector. Every value has exactly one **owner** at a time; when the owner goes out of scope, the value is automatically dropped (its destructor runs, memory is freed). Ownership can be **moved** - `let b = a` transfers ownership from `a` to `b`, making `a` invalid. Primitive types that implement `Copy` are copied instead of moved (they are cheap to duplicate and have no destructors).",
            "**Borrowing** allows temporary references without transferring ownership. An **immutable reference** (`&T`) is a read-only view; any number can coexist simultaneously. A **mutable reference** (`&mut T`) is an exclusive, read-write view; at any moment, there may be *either* multiple immutable references *or* exactly one mutable reference - never both. This is the **aliasing XOR mutability** invariant, enforced at compile time. It eliminates the entire class of bugs caused by aliased mutation: iterator invalidation, concurrent data races, and dangling references.",
            "The **borrow checker** is the compiler pass that enforces these rules. It tracks the lifetimes of all borrows and rejects programs where a reference outlives the value it refers to, or where mutable and immutable borrows overlap. The error messages are famously detailed - the compiler identifies the conflicting borrows and often suggests fixes. Learning to 'fight the borrow checker' is the central Rust learning curve; learning to 'think like the borrow checker' is the sign that the ownership model has been internalized.",
            "**`Drop` and RAII**: Rust's automatic drop is the same RAII (Resource Acquisition Is Initialization) pattern as C++, but it is enforced by the ownership system rather than relying on programmer discipline. Any type implementing `Drop` runs its destructor when its value is dropped. This is how `MutexGuard` (automatically releases the lock when it goes out of scope), `File` (closes the file descriptor), and `Vec` (deallocates the heap buffer) work. There is no `try/finally` in Rust because RAII makes it unnecessary: the destructor runs regardless of how the scope exits (normal return, panic, early return with `?`).",
            "The practical consequence of the ownership model: a large class of bugs that require Valgrind, AddressSanitizer, or ThreadSanitizer to detect in C++ are compile-time errors in Rust. A Rust program that compiles is free of memory safety bugs by construction (modulo `unsafe` blocks). This shifts the cost from runtime to compile time and from testing to authoring - the trade-off is a steeper learning curve and more 'fighting the compiler' during initial development, but vastly more confidence in the correctness of the result.",
          ],
          resources: [
            { label: "The Rust Book - ch. 4: Understanding Ownership (free)", url: "https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html", type: "book" },
            { label: "Rustlings - interactive ownership exercises", url: "https://github.com/rust-lang/rustlings", type: "practice" },
          ],
        },
        {
          title: "Lifetimes and elision: when the borrow checker needs help",
          body: [
            "**Lifetimes** are annotations that describe how long a reference is valid - specifically, the relationship between the lifetime of a reference and the lifetime of the data it refers to. They prevent dangling references: a reference to a local variable cannot escape the function that created it. Most of the time, the compiler infers lifetimes via **lifetime elision rules**, and you never write them explicitly. When the compiler cannot infer the relationships, it asks you to annotate them.",
            "Lifetime annotations use the `'a` syntax (a tick followed by a name). `fn longest<'a>(x: &'a str, y: &'a str) -> &'a str` says: 'the returned reference lives at least as long as both input references'. The annotation does not change how long anything lives - it just describes the relationship, allowing the compiler to verify that the caller does not use the returned reference after either input has been dropped. The lifetime is a constraint on the caller, not a command to the runtime.",
            "**Lifetime elision rules** handle the common cases: (1) each reference parameter gets its own lifetime; (2) if there is exactly one input reference, the output lifetime is the same as the input; (3) if there is a `&self` or `&mut self` parameter, the output lifetime is the same as `self`. These rules cover the vast majority of function signatures. Explicit annotations are needed for: multiple reference parameters with different lifetimes, returning a reference from a struct method where the struct and a parameter both have references, and for struct fields that hold references.",
            "**`'static`** is the special lifetime meaning 'valid for the entire program execution'. String literals (`&'static str`) are `'static` because they are baked into the binary. Spawning a thread requires the closure to be `'static` (because threads can outlive the current scope - the spawned thread must not reference any stack-allocated data from the spawning scope). `Arc<T>` gives you a heap-allocated `T` with `'static` lifetime (as long as any `Arc` clone is alive), which is the standard way to share non-`'static` data with threads.",
            "The `PhantomData<&'a T>` pattern: when a struct holds raw pointers rather than references (common in unsafe code implementing custom containers), the borrow checker has no lifetime information for the data the pointer points to. `PhantomData<&'a T>` is a zero-size marker field that tells the compiler 'this struct logically holds a reference to T with lifetime `'a`', ensuring lifetime checks work correctly even through the raw pointer abstraction.",
          ],
          resources: [
            { label: "The Rust Book - ch. 10.3: Validating References with Lifetimes", url: "https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html", type: "book" },
            { label: "The Rustonomicon - lifetimes and variance", url: "https://doc.rust-lang.org/nomicon/lifetimes.html", type: "book" },
          ],
        },
        {
          title: "unsafe, raw pointers, and FFI",
          body: [
            "`unsafe` is Rust's escape hatch for operations the borrow checker cannot verify. An `unsafe` block or function tells the compiler: 'I have verified this is safe, even though you cannot prove it'. The five operations that require `unsafe`: (1) dereference a raw pointer (`*const T` or `*mut T`); (2) call an `unsafe` function (including C FFI functions); (3) access or modify a `static mut` variable; (4) implement an `unsafe` trait; (5) access fields of `union`. Everything else in Rust - including all ownership and borrowing rules - still applies inside `unsafe` blocks.",
            "**Raw pointers** (`*const T`, `*mut T`) are Rust's equivalent of C pointers: they can be null, they can alias, they can dangle. They are not automatically dereferenced; you must explicitly dereference them inside an `unsafe` block. Raw pointers are the mechanism for: building custom allocators, implementing intrusive data structures, interfacing with C APIs that return pointers, and implementing lock-free algorithms where the borrow checker's aliasing rules are too restrictive. The discipline: keep `unsafe` blocks small (wrap them in a safe abstraction), document the invariants you are maintaining, and prefer using existing safe wrappers (`NonNull<T>`, `Pin<P>`, `MaybeUninit<T>`) over bare raw pointers.",
            "**FFI (Foreign Function Interface)** allows Rust to call C functions and expose Rust functions to C. `extern \"C\" { fn strlen(s: *const c_char) -> usize; }` declares a C function. `#[no_mangle] pub extern \"C\" fn my_function(x: i32) -> i32 { ... }` exposes a Rust function with C calling convention and linkage. The `libc` crate provides all standard C types and functions. `#[repr(C)]` on a struct ensures C-compatible layout (no reordering, no additional padding beyond what C would use). The primary hazard: C ownership and memory management conventions must be honored manually (if a C function allocates memory and expects you to free it, you must free it with the right deallocator).",
            "**`Send` and `Sync`** are the concurrency safety markers. `Send` means a type can be sent to another thread (its ownership can be moved across thread boundaries). `Sync` means a type can be shared across threads via a reference (an `Arc<T>` is safe if `T: Sync`). Most types are automatically `Send + Sync` if all their fields are. Raw pointers (`*mut T`) are neither `Send` nor `Sync` - they carry no ownership or aliasing guarantees. `RefCell<T>` is `Send` but not `Sync` (interior mutability is safe when used on one thread but not when shared). `UnsafeCell<T>` is the primitive that all interior-mutability types (`Cell`, `RefCell`, `Mutex`, `atomic`) are built on; it is the only way to get a `&mut T` from a `&T`.",
          ],
          resources: [
            { label: "The Rustonomicon - unsafe Rust (raw pointers, FFI, Send/Sync)", url: "https://doc.rust-lang.org/nomicon/", type: "book" },
            { label: "The Rust Reference - unsafe keyword", url: "https://doc.rust-lang.org/reference/unsafe-keyword.html", type: "docs" },
          ],
        },
        {
          title: "async/await: futures, Pin, and the executor model",
          body: [
            "Rust's **async/await** is a zero-cost abstraction for asynchronous programming. An `async fn` is a function that returns a `Future` - a value representing a computation that has not yet completed. `await`ing a future suspends the current task until the future is ready, giving up the thread to run other tasks in the meantime. Unlike threads (each with its own stack), many async tasks share one or a few threads, with the **executor** scheduling them. The zero-cost claim: async functions compile to state machines with no runtime overhead beyond what you would write by hand.",
            "A **Future** is a trait: `poll(cx: &mut Context<'_>) -> Poll<Output>`. `Poll::Ready(v)` means the computation is complete with value `v`. `Poll::Pending` means the computation is not ready yet; when it will be ready, it will wake the task via the `Waker` stored in `cx`. The executor calls `poll` on a task; if it returns `Pending`, the executor parks the task until the `Waker` is invoked (by an I/O event, a timer, etc.), then reschedules it and calls `poll` again. This is the **cooperative scheduling** model: tasks yield at `await` points, not at arbitrary points.",
            "**`Pin<P>`** is one of the most counterintuitive Rust types and exists specifically for async. When an async function is suspended at an `await`, its state (local variables, instruction pointer) is stored in a struct (the future). If that struct is moved in memory between `poll` calls, any self-referential pointers within it (e.g., a local variable holding a reference to another local variable) would dangle. `Pin<Box<F>>` guarantees the `F` will not move in memory once pinned. `Unpin` marks types that are safe to move even when pinned (most types). You rarely interact with `Pin` directly unless writing your own `Future` implementations or calling `poll` manually.",
            "**The executor model**: `tokio`, `async-std`, and `smol` are the main runtimes. They implement the executor (a scheduler for tasks), the I/O reactor (using epoll/io_uring/kqueue under the hood to wake tasks when I/O is ready), and the timer system. `tokio` is the production choice for network servers: multi-threaded work-stealing executor, full feature set, large ecosystem. Building a minimal executor is the best way to understand how async works: a `HashMap<TaskId, BoxFuture>` of parked tasks, an `mpsc` channel as the run queue, a `Waker` that sends the task ID back to the run queue when invoked, and a loop calling `poll` on runnable tasks. The reactor (epoll + `mio`) maps I/O readiness events to task wakeups.",
          ],
          resources: [
            { label: "Rust Async Book - async/await, futures, executors (free)", url: "https://rust-lang.github.io/async-book/", type: "book" },
            { label: "Tokio tutorial - building async network servers", url: "https://tokio.rs/tokio/tutorial", type: "docs" },
          ],
        },
        {
          title: "Lock-free Rust: crossbeam, epoch reclamation, and atomics",
          body: [
            "Rust's **`std::sync::atomic`** module provides atomic types (`AtomicBool`, `AtomicUsize`, `AtomicPtr`, etc.) with the same memory orders as C11. The key difference from C: the `Ordering` enum makes memory order explicit at the call site (`store(val, Ordering::Release)`, `load(Ordering::Acquire)`, `compare_exchange(expected, desired, success_ord, failure_ord)`). The `Send + Sync` bounds ensure atomic types are only used across threads correctly - a raw pointer wrapped in `AtomicPtr<T>` is neither `Send` nor `Sync` by default, so you must implement those manually, forcing you to reason about the safety invariants.",
            "The **`crossbeam`** crate provides production-quality lock-free data structures and epoch-based memory reclamation for Rust. `crossbeam::queue::SegQueue` is an unbounded, lock-free MPMC queue. `crossbeam::channel` is the production-grade multi-producer multi-consumer channel (faster than `std::sync::mpsc`, supports `select!`). `crossbeam::deque::Worker` and `Stealer` implement a lock-free work-stealing deque (the algorithm used in tokio's scheduler). These are the right primitives to reach for before writing your own lock-free structures.",
            "**Epoch-based reclamation (EBR) in crossbeam**: `crossbeam::epoch` provides safe memory reclamation for lock-free structures. `unsafe { epoch::pin() }` begins a critical section (the thread enters the current epoch). `guard.defer_destroy(ptr)` registers a pointer for destruction when all threads have advanced past the current epoch. This is the Rust wrapper over the EBR algorithm from `ll-concurrency`, with the key improvement: the `unsafe` is contained within the `epoch` abstraction, and the API is memory-safe (you cannot defer-destroy a non-`Owned` pointer, preventing double-free).",
            "**`Rust Atomics and Locks`** (Mara Bos, free online) is the definitive guide to implementing lock-free structures in Rust: starting from scratch with `AtomicBool`, building a mutex, condition variable, channel, and Arc from first principles. The book demonstrates that Rust's type system prevents entire classes of concurrency bugs that C++ lock-free code silently permits - a `Mutex<T>` guarantees the `T` can only be accessed while the lock is held, enforced by the borrow checker at compile time, which C++'s `std::mutex` cannot do. `std::sync::Mutex<T>` in Rust poisons itself on panic (sets a poisoned flag), so a subsequent lock attempt returns an error rather than silently acquiring a lock over corrupted state.",
          ],
          resources: [
            { label: "Rust Atomics and Locks - Mara Bos (free online)", url: "https://marabos.nl/atomics/", type: "book" },
            { label: "crossbeam crate documentation", url: "https://docs.rs/crossbeam/latest/crossbeam/", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "The Rust Book (free)", url: "https://doc.rust-lang.org/book/", type: "book" },
        { label: "The Rustonomicon - unsafe & FFI (free)", url: "https://doc.rust-lang.org/nomicon/", type: "book" },
        { label: "Rust Atomics and Locks - Mara Bos (free)", url: "https://marabos.nl/atomics/", type: "book" },
      ],
      connections: [
        { to: "comp-types", note: "The borrow checker is an ownership/effect type system in production" },
        { to: "ll-concurrency", note: "Send/Sync encode the memory-ordering guarantees at the type level" },
        { to: "web3-tooling", note: "Solana, Substrate and many ZK stacks are written in Rust" },
      ],
    },
  ],
});
