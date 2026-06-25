atlasAdd({
  id: "gpu",
  num: 13,
  title: "Low-Level AI / GPU Systems",
  icon: "🔥",
  color: "#76b900",
  tagline: "The layer beneath PyTorch: CUDA, kernels, memory, and the systems that make models run fast.",
  overview: [
    "This is the new domain — the bridge between AI/ML (what to compute) and Low-Level Systems (how the hardware computes it). Every model you train or serve ultimately becomes GPU kernels moving tensors through a memory hierarchy. Understanding this layer is what separates someone who *calls* `model.forward()` from someone who can make it 10× faster or fit on half the hardware.",
    "The mental shift: modern deep learning is **memory-bandwidth-bound, not compute-bound** — the game is keeping the tensor cores fed by minimizing data movement (fusion, tiling, quantization). The arc: GPU execution model → CUDA → memory hierarchy → GEMM + tensor cores → Triton/kernel DSLs → fusion (FlashAttention) → inference + distributed systems → ML compilers. It pulls directly on cache/SIMD intuition from low-level systems and the transformer/attention internals from AI.",
  ],
  topics: [
    {
      id: "gpu-model",
      title: "The GPU execution model",
      level: "Beginner",
      body: [
        "The hardware reality: a GPU is thousands of simple cores grouped into **Streaming Multiprocessors (SMs)**, executing in **SIMT** lockstep over **warps** of 32 threads. Master the hierarchy — grid → blocks → warps → threads — **occupancy** (how many warps an SM keeps resident to hide latency), warp divergence (the cost of branching), and why GPUs win on throughput, not latency.",
        "This is the GPU analogue of CPU microarchitecture: instead of one fast out-of-order core, you have massive parallelism that only pays off if you feed it coalesced, branch-uniform work.",
      ],
      resources: [
        { label: "Modal — GPU Glossary (SMs, warps, occupancy)", url: "https://modal.com/gpu-glossary", type: "docs", note: "the clearest GPU mental model" },
        { label: "CUDA C++ Programming Guide — programming model", url: "https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html#programming-model", type: "docs" },
        { label: "Programming Massively Parallel Processors (PMPP) — Hwu, Kirk, Hajj", url: "https://www.elsevier.com/books/programming-massively-parallel-processors/hwu/978-0-323-91231-0", type: "book", note: "the foundational GPU text" },
      ],
      connections: [
        { to: "ll-microarch", note: "SIMT/occupancy is the GPU counterpart of CPU pipelines and ILP" },
        { to: "game-rendering", note: "Shaders run on this exact SIMT model — graphics and compute share the silicon" },
        { to: "ai-nn", note: "Every forward/backward pass is dispatched as kernels onto this model" },
      ],
    },
    {
      id: "gpu-cuda",
      title: "CUDA programming",
      level: "Beginner → Intermediate",
      body: [
        "The CUDA C++ model: writing `__global__` kernels, launch configuration (`<<<grid, block>>>`), thread indexing, the host/device memory split, streams and asynchronous execution, and synchronization (`__syncthreads`, events). Start with element-wise kernels, then a naive matmul, then a reduction — the three patterns underneath everything.",
        "The GPU MODE (formerly CUDA MODE) lectures and srush's GPU Puzzles are the best hands-on on-ramps; PMPP is the textbook.",
      ],
      resources: [
        { label: "CUDA C++ Programming Guide (canonical)", url: "https://docs.nvidia.com/cuda/cuda-c-programming-guide/", type: "docs" },
        { label: "GPU Puzzles — srush (learn CUDA by solving)", url: "https://github.com/srush/GPU-Puzzles", type: "practice" },
        { label: "GPU MODE — lecture series & code", url: "https://github.com/gpu-mode/lectures", type: "course", note: "the best community GPU course" },
      ],
      connections: [
        { to: "ll-cmemory", note: "CUDA is C++ with explicit host/device memory — the same ownership discipline" },
        { to: "gpu-memory", note: "Kernel performance is dominated by how you use the memory hierarchy" },
        { to: "gpu-triton", note: "Triton is the Pythonic alternative that hides much of this boilerplate" },
      ],
    },
    {
      id: "gpu-memory",
      title: "Memory hierarchy & coalescing",
      level: "Intermediate",
      body: [
        "Where performance is actually decided: global memory (high latency, must be **coalesced** — consecutive threads touching consecutive addresses), **shared memory** (fast on-chip scratchpad, beware **bank conflicts**), registers, and L2. The core technique is **tiling**: stage data into shared memory once and reuse it, turning a bandwidth-bound kernel into a compute-bound one.",
        "This is the same locality principle as CPU caches (SoA layout, line utilization) — just explicit and programmer-managed.",
      ],
      resources: [
        { label: "CUDA C++ Best Practices Guide — memory optimizations", url: "https://docs.nvidia.com/cuda/cuda-c-best-practices-guide/index.html#memory-optimizations", type: "docs" },
        { label: "NVIDIA — coalesced memory access (dev blog)", url: "https://developer.nvidia.com/blog/how-access-global-memory-efficiently-cuda-c-kernels/", type: "docs" },
      ],
      connections: [
        { to: "ll-cache", note: "Coalescing and tiling are the GPU form of cache-line locality and blocking" },
        { to: "gpu-matmul", note: "Tiling into shared memory is the heart of fast GEMM" },
        { to: "gpu-fusion", note: "Minimizing global-memory round-trips is exactly why we fuse kernels" },
      ],
    },
    {
      id: "gpu-matmul",
      title: "GEMM optimization & tensor cores",
      level: "Intermediate → Advanced",
      body: [
        "Matrix multiply is *the* operation of deep learning, so optimizing it teaches everything: hierarchical **tiling** (block → warp → thread), register blocking, double-buffering, and finally **tensor cores** (WMMA / `mma` instructions, mixed-precision FP16/BF16/FP8 accumulation) — the dedicated matmul units that deliver most of a GPU's FLOPs. NVIDIA's **CUTLASS** is the production template library.",
        "Simon Boehm's step-by-step CUDA matmul (naive → near-cuBLAS) is the single best artifact for internalizing this.",
      ],
      resources: [
        { label: "Simon Boehm — How to Optimize a CUDA Matmul Kernel", url: "https://siboehm.com/articles/22/CUDA-MMM", type: "docs", note: "naive → near-cuBLAS, step by step" },
        { label: "NVIDIA CUTLASS — docs & repo", url: "https://github.com/NVIDIA/cutlass", type: "repo" },
        { label: "NVIDIA — Tensor Core / WMMA programming guide", url: "https://docs.nvidia.com/cuda/cuda-c-programming-guide/index.html#warp-matrix-functions", type: "docs" },
      ],
      connections: [
        { to: "ll-asm", note: "Tensor-core mma instructions are SIMD intrinsics for matrices" },
        { to: "ai-nn", note: "GEMM is the bulk of every linear layer and attention projection" },
        { to: "gpu-memory", note: "Fast GEMM is a shared-memory tiling problem first, math second" },
      ],
    },
    {
      id: "gpu-triton",
      title: "Triton & kernel DSLs",
      level: "Intermediate → Advanced",
      body: [
        "**Triton** lets you write fused GPU kernels in Python at the *block* level — you reason about tiles and `tl.load`/`tl.store`/`tl.dot`, and the compiler handles coalescing, shared-memory staging, and scheduling. It's the pragmatic middle ground: most of CUDA's performance with a fraction of the effort, which is why PyTorch's `torch.compile` generates Triton.",
        "Work the official tutorials in order (vector-add → fused softmax → matmul → fused attention); they teach the whole performance story by construction.",
      ],
      resources: [
        { label: "Triton — documentation & tutorials", url: "https://triton-lang.org/main/index.html", type: "docs", note: "do the tutorials in order" },
        { label: "Triton — fused attention tutorial", url: "https://triton-lang.org/main/getting-started/tutorials/06-fused-attention.html", type: "docs" },
        { label: "GPU MODE — Triton lectures", url: "https://github.com/gpu-mode/lectures", type: "course" },
      ],
      connections: [
        { to: "comp-llvm", note: "Triton lowers through an MLIR/LLVM pipeline to PTX — it's a compiler" },
        { to: "gpu-fusion", note: "Triton's reason to exist is writing fused kernels like FlashAttention" },
        { to: "gpu-compilers", note: "torch.compile's Inductor backend emits Triton automatically" },
      ],
    },
    {
      id: "gpu-fusion",
      title: "Kernel fusion & FlashAttention",
      level: "Advanced",
      body: [
        "The central optimization of modern DL: **fuse** sequences of ops into one kernel so intermediates never hit slow global memory. **FlashAttention** is the landmark example — it computes attention *without materializing* the N×N score matrix by tiling and an online-softmax recurrence, turning a memory-bound op into a compute-bound one (and saving O(N²) memory).",
        "Horace He's 'Making Deep Learning Go Brrrr from First Principles' is the essential framing: classify every op as compute-, memory-, or overhead-bound, then fuse the memory-bound ones.",
      ],
      resources: [
        { label: "Horace He — Making Deep Learning Go Brrrr From First Principles", url: "https://horace.io/brrr_intro.html", type: "docs", note: "the mental model for GPU perf" },
        { label: "FlashAttention (paper)", url: "https://arxiv.org/abs/2205.14135", type: "paper" },
        { label: "FlashAttention — official repo", url: "https://github.com/Dao-AILab/flash-attention", type: "repo" },
      ],
      connections: [
        { to: "ai-sequence", note: "FlashAttention is the fast implementation of transformer self-attention" },
        { to: "ai-training", note: "Fusion + recomputation are the levers that make large-model training fit" },
        { to: "gpu-memory", note: "Fusion's whole point is eliminating global-memory round-trips" },
      ],
    },
    {
      id: "gpu-inference",
      title: "LLM inference systems",
      level: "Advanced",
      body: [
        "Serving is its own discipline: the **KV cache** dominates memory, so **PagedAttention** (vLLM) manages it like OS virtual memory (paging, no fragmentation) to maximize batch size and throughput. Add **continuous batching**, **speculative decoding** (draft + verify), and aggressive **quantization** (INT8/INT4, GPTQ/AWQ, FP8) to cut memory and latency.",
        "This is where GPU systems, OS ideas (paging!), and LLMs converge into the engines (vLLM, TensorRT-LLM, llama.cpp) that actually run models in production.",
      ],
      resources: [
        { label: "vLLM — documentation", url: "https://docs.vllm.ai/en/latest/", type: "docs" },
        { label: "PagedAttention / vLLM (paper)", url: "https://arxiv.org/abs/2309.06180", type: "paper" },
        { label: "llama.cpp — repo (CPU/GPU inference, GGUF quant)", url: "https://github.com/ggml-org/llama.cpp", type: "repo" },
      ],
      connections: [
        { to: "ai-llm", note: "KV cache, quantization and speculative decoding are LLM-internals made fast" },
        { to: "os-memory", note: "PagedAttention literally borrows OS virtual-memory paging for the KV cache" },
        { to: "ai-mlops", note: "These engines are the serving layer of the MLOps stack" },
      ],
    },
    {
      id: "gpu-distributed",
      title: "Multi-GPU & distributed systems",
      level: "Advanced",
      body: [
        "When a model or batch won't fit on one GPU: **collective communications** (all-reduce, all-gather, reduce-scatter) via **NCCL**, the interconnects that make them fast (NVLink, NVSwitch, InfiniBand/RDMA), and the parallelism strategies — **data**, **tensor**, **pipeline**, and **sequence/expert** parallelism — plus **ZeRO/FSDP** sharding of optimizer state, gradients, and parameters.",
        "The bottleneck is communication, so the art is overlapping compute with comms and choosing the parallelism that minimizes cross-device traffic.",
      ],
      resources: [
        { label: "NVIDIA NCCL — documentation", url: "https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/index.html", type: "docs" },
        { label: "HF — Ultra-Scale Playbook (parallelism strategies)", url: "https://huggingface.co/spaces/nanotron/ultrascale-playbook", type: "docs" },
        { label: "PyTorch — FSDP tutorial", url: "https://pytorch.org/tutorials/intermediate/FSDP_tutorial.html", type: "docs" },
      ],
      connections: [
        { to: "ai-training", note: "This is the systems realization of tensor/pipeline parallelism and ZeRO" },
        { to: "ll-kernelbypass", note: "RDMA/InfiniBand bypass the kernel — the same tech as HFT/low-level networking" },
        { to: "web-systemdesign", note: "Multi-node training is a distributed-systems orchestration problem" },
      ],
    },
    {
      id: "gpu-compilers",
      title: "ML compilers & profiling",
      level: "Advanced → Research",
      body: [
        "How frameworks turn graphs into fast kernels: **torch.compile** (TorchDynamo capture → Inductor → Triton), **XLA** (the compiler behind JAX/TF, operator fusion), **TVM**, and the **MLIR**-based stacks underneath. Closing the loop is measurement: **roofline analysis** (are you compute- or memory-bound?) and profiling with **Nsight Compute/Systems**.",
        "You can't optimize what you can't measure — roofline + Nsight tell you which of the previous topics to reach for.",
      ],
      resources: [
        { label: "PyTorch — torch.compile guide", url: "https://pytorch.org/tutorials/intermediate/torch_compile_tutorial.html", type: "docs" },
        { label: "OpenXLA — documentation", url: "https://openxla.org/xla", type: "docs" },
        { label: "NVIDIA Nsight Compute — docs", url: "https://docs.nvidia.com/nsight-compute/", type: "tool" },
      ],
      connections: [
        { to: "comp-llvm", note: "XLA/Inductor/TVM are MLIR/LLVM-family compilers for tensor programs" },
        { to: "ai-training", note: "torch.compile is often the cheapest single training/inference speedup" },
        { to: "ll-microarch", note: "Roofline analysis is the GPU analogue of CPU top-down methodology" },
      ],
    },
  ],
});
