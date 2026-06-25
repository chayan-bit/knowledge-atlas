atlasAdd({
  id: "compilers",
  num: 3,
  title: "Compilers & PLT",
  icon: "⚙️",
  color: "#bb9af7",
  tagline: "From lexing a calculator to designing a typed language with an optimizing backend.",
  overview: [
    "A compiler is a pipeline of total functions: source → tokens → AST → IR → machine code, each stage a clean transformation you can build and test in isolation. Learning it rewires how you see *all* programs — you start noticing grammars, type systems, and dataflow everywhere.",
    "Programming-language theory (PLT) is the math underneath: grammars, type systems, semantics, and proofs of correctness. The combination is unusually transferable — it shows up in databases (query planners), ML (XLA/MLIR), security (symbolic execution), and blockchains (Solidity → EVM).",
  ],
  topics: [
    {
      id: "comp-frontend",
      title: "Frontend: lexing, parsing, tree-walking",
      level: "Beginner",
      body: [
        "The pipeline mental model, then a working **tree-walking interpreter**: tokenizer → recursive-descent parser → AST → evaluate by walking the tree, with proper **environments and lexical scope**.",
        "Nystrom's *Crafting Interpreters* is the canonical path — Part I builds a complete dynamically-typed language (Lox) and every concept lands as runnable code.",
      ],
      resources: [
        { label: "Crafting Interpreters — Part I (free, full text)", url: "https://craftinginterpreters.com/", type: "book", note: "best intro to compilers" },
        { label: "Writing An Interpreter In Go — Thorsten Ball", url: "https://interpreterbook.com/", type: "book" },
      ],
      connections: [
        { to: "dsa-strings", note: "Lexing is finite-automaton string matching — the theory you met in DSA" },
        { to: "comp-bytecode", note: "The AST you build here is the input to bytecode codegen" },
      ],
    },
    {
      id: "comp-parsing",
      title: "Parsing theory",
      level: "Intermediate",
      body: [
        "Formal parsing: **LL(k)** (why left recursion breaks recursive descent), **LR/LALR** (shift-reduce, what yacc/bison build), and **Pratt parsing** (top-down operator precedence — the cleanest way to handle expressions). Plus ambiguity (dangling else) and error recovery.",
        "Pratt parsing in particular is a tool you'll reach for again and again whenever you need to parse expressions with precedence.",
      ],
      resources: [
        { label: "Matklad — Simple but Powerful Pratt Parsing", url: "https://matklad.github.io/2020/04/13/simple-but-powerful-pratt-parsing.html", type: "docs" },
        { label: "Stanford CS143 — Compilers (parsing)", url: "https://web.stanford.edu/class/cs143/", type: "course" },
      ],
      connections: [
        { to: "dsa-paradigms", note: "CYK parsing is dynamic programming; grammar complexity uses the same analysis" },
        { to: "web-platform", note: "Browsers parse HTML/CSS with error-recovering parsers built on this theory" },
      ],
    },
    {
      id: "comp-semantics",
      title: "Semantic analysis & type checking",
      level: "Intermediate",
      body: [
        "Scoped **symbol tables**, the static/dynamic and nominal/structural distinctions, **type checking** via attribute grammars (synthesized vs inherited attributes), and the **visitor pattern** to separate passes from the AST.",
        "This is where 'is this program meaningful?' gets answered, distinct from 'is it grammatical?'.",
      ],
      resources: [
        { label: "Engineering a Compiler — Cooper & Torczon (overview)", url: "https://www.elsevier.com/books/engineering-a-compiler/cooper/978-0-12-815412-0", type: "book" },
        { label: "Crafting Interpreters — Resolving and Binding", url: "https://craftinginterpreters.com/resolving-and-binding.html", type: "book" },
      ],
      connections: [
        { to: "comp-types", note: "Type checking generalizes into full type inference and type systems" },
        { to: "web-js", note: "TypeScript's checker is exactly this: a structural type system over JS ASTs" },
      ],
    },
    {
      id: "comp-bytecode",
      title: "Bytecode VMs & code generation",
      level: "Intermediate",
      body: [
        "Why bytecode (portability, JIT potential), **stack vs register VMs** (CPython is stack, Lua is register), designing an instruction set, the call stack (frames, local slots), and basic **garbage collection** (mark-sweep, refcounting).",
        "Then real codegen: three-address code / SSA intro, the **System V x86-64 calling convention**, and compiling a small language down to assembly you link with `ld`.",
      ],
      resources: [
        { label: "Crafting Interpreters — Part II & III (bytecode VM in C)", url: "https://craftinginterpreters.com/a-bytecode-virtual-machine.html", type: "book" },
        { label: "System V x86-64 ABI (PDF)", url: "https://gitlab.com/x86-psABIs/x86-64-ABI", type: "docs" },
      ],
      connections: [
        { to: "ll-abi", note: "The System V calling convention is shared verbatim with low-level systems" },
        { to: "web3-evm", note: "Solidity→EVM is a stack-based bytecode VM target — this exact pattern" },
        { to: "comp-runtime", note: "The VM's GC and JIT are the runtime-systems topic" },
      ],
    },
    {
      id: "comp-ssa",
      title: "SSA, dataflow & optimization",
      level: "Advanced",
      body: [
        "**Static Single Assignment** (each variable defined once → phi functions; constructed via dominance frontiers) unlocks a whole class of optimizations. Then the **dataflow framework** (lattices, monotone functions, fixed-point iteration) and the classic passes: constant propagation, DCE, CSE, LICM, strength reduction, and **register allocation** (graph coloring, linear scan).",
        "This is the intellectual core of optimizing compilers and it is *pure graph algorithms* applied to control-flow graphs.",
      ],
      resources: [
        { label: "SSA Book (free PDF) — Rastello & Tichadou", url: "https://pfalcon.github.io/ssabook/latest/book-full.pdf", type: "book" },
        { label: "Engineering a Compiler — dataflow & optimization", url: "https://shop.elsevier.com/books/engineering-a-compiler/cooper/978-0-12-815412-0", type: "book" },
      ],
      connections: [
        { to: "dsa-graphs", note: "Dominators, CFGs and dataflow are graph algorithms applied to code" },
        { to: "ll-microarch", note: "Optimizations target the pipeline/cache behavior you study in perf engineering" },
        { to: "cyber-research", note: "Dataflow + SSA underpin static analysis and symbolic execution for bug-finding" },
      ],
    },
    {
      id: "comp-types",
      title: "Advanced type systems",
      level: "Advanced",
      body: [
        "**Hindley-Milner** inference (Algorithm W, unification, let-polymorphism), **System F** (parametric polymorphism), **dependent types** (Coq/Agda/Idris), row polymorphism, subtyping (co/contravariance — Liskov, formally), and effect systems.",
        "Implementing HM inference for a small lambda calculus is the rite of passage; it's also the foundation for understanding why Rust/TypeScript/Haskell type errors say what they say.",
      ],
      resources: [
        { label: "Types and Programming Languages (TAPL) — Pierce", url: "https://www.cis.upenn.edu/~bcpierce/tapl/", type: "book", note: "the type-theory bible" },
        { label: "Hindley-Milner — a worked tutorial", url: "https://github.com/sdiehl/write-you-a-haskell", type: "repo" },
      ],
      connections: [
        { to: "ll-rust", note: "Rust's borrow checker is an effect/ownership type system in the wild" },
        { to: "crypto-zk", note: "Dependent types + proof assistants (Coq) verify cryptographic protocols & circuits" },
        { to: "web-js", note: "TypeScript generics/conditional types are applied type theory" },
      ],
    },
    {
      id: "comp-llvm",
      title: "LLVM & MLIR",
      level: "Advanced",
      body: [
        "**LLVM IR** structure (modules/functions/basic-blocks, SSA, types), writing a `FunctionPass`, the Kaleidoscope tutorial (build a JIT-compiled language), Clang LibTooling for refactoring tools, and **MLIR** — the multi-level IR with dialects that powers modern ML compilers (XLA, Torch-MLIR, Triton).",
        "LLVM is the industrial backend you'd target instead of hand-writing assembly; MLIR is where compilers and ML systems converge.",
      ],
      resources: [
        { label: "LLVM Kaleidoscope tutorial (free)", url: "https://llvm.org/docs/tutorial/", type: "docs" },
        { label: "LLVM Language Reference", url: "https://llvm.org/docs/LangRef.html", type: "docs" },
        { label: "MLIR — official docs", url: "https://mlir.llvm.org/", type: "docs" },
      ],
      connections: [
        { to: "gpu-compilers", note: "MLIR/XLA/Triton lower ML graphs to GPU code through LLVM-family IRs" },
        { to: "ai-training", note: "torch.compile and XLA are compiler passes over the ML computation graph" },
        { to: "web3-zk", note: "Noir/Circom compile high-level circuits down to constraint systems like a compiler backend" },
      ],
    },
    {
      id: "comp-runtime",
      title: "Runtime systems: GC & JIT",
      level: "Advanced → Research",
      body: [
        "Garbage collection in depth (tri-color mark-sweep, write barriers, generational/copying/concurrent GC: G1, ZGC, Shenandoah), **JIT** compilation (method vs tracing JIT — LuaJIT), **inline caches** (polymorphic ICs in V8), and object layout (hidden classes/shapes).",
        "This is what makes managed languages fast; understanding V8's hidden classes directly explains the web-performance advice you'll meet later.",
      ],
      resources: [
        { label: "The Garbage Collection Handbook — Jones, Hosking, Moss", url: "https://gchandbook.org/", type: "book" },
        { label: "V8 blog — TurboFan, hidden classes, ICs", url: "https://v8.dev/blog", type: "docs" },
      ],
      connections: [
        { to: "web-perf", note: "V8 hidden classes / inline caches are the reason behind JS perf rules" },
        { to: "comp-bytecode", note: "GC and JIT extend the simple bytecode VM you built" },
        { to: "ai-llm", note: "vLLM/llama.cpp inference engines are JIT-like runtimes for tensor programs" },
      ],
    },
  ],
});
