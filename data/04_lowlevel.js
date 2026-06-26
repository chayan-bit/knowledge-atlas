// Low-Level & Systems — domain shell (meta only).
// Topics live in 04_ll_*.js, each appended via atlasAdd's merge-by-id.
atlasAdd({
  id: "lowlevel",
  num: 4,
  title: "Low-Level & Systems",
  icon: "🔩",
  color: "#ff9e64",
  tagline: "From C pointers to lock-free systems and kernel-bypass networking.",
  overview: [
    "This domain is about knowing *exactly* what your code does in memory and on the CPU - no abstraction left unexamined. It sits between OS (what the kernel provides) and compilers (how code is generated), and it's the prerequisite for binary exploitation, HFT, GPU programming, and game engines.",
    "The arc: master C and the memory model -> understand the ABI/linker/assembly -> make code as fast as the hardware allows (cache, SIMD, branch prediction) -> write lock-free and kernel-bypass systems. Rust enters as the modern way to get most of this safety without a GC.",
  ],
  topics: [],
});
