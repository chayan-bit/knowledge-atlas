atlasAdd({
  id: "gamedev",
  num: 7,
  title: "Game Development",
  icon: "🎮",
  color: "#e0af68",
  tagline: "From the game loop to custom renderers, physics engines, and networked multiplayer.",
  overview: [
    "Games are real-time simulations under a hard frame budget (16.6ms at 60fps), which makes game dev a uniquely demanding integration of math, physics, rendering, AI, and networking — all of it performance-constrained. It's applied linear algebra and applied systems programming with immediate visual feedback.",
    "Ship small games first to internalize the loop, then go deep: build a physics engine, write a renderer in OpenGL/Vulkan, and implement client-side prediction. The rendering and data-layout skills connect directly to GPU systems and low-level performance.",
  ],
  topics: [
    {
      id: "game-loop",
      title: "The game loop & 2D fundamentals",
      level: "Beginner",
      body: [
        "**Fixed vs variable timestep** (why physics needs fixed update), delta time, coordinate systems (screen vs world), sprite batching (why draw calls are expensive), broad-phase **AABB collision**, input handling, tilemaps, camera follow with lerp, and game-state machines.",
        "Ship Pong/Breakout/a platformer with proper physics — finishing real games teaches more than any tutorial.",
      ],
      resources: [
        { label: "Game Programming Patterns — Nystrom (free)", url: "https://gameprogrammingpatterns.com/", type: "book", note: "read all of it" },
        { label: "Godot 4 — documentation", url: "https://docs.godotengine.org/en/stable/", type: "docs", note: "best free engine to learn on" },
        { label: "Fix Your Timestep! — Gaffer On Games", url: "https://gafferongames.com/post/fix_your_timestep/", type: "docs" },
      ],
      connections: [
        { to: "web-react", note: "requestAnimationFrame UI loops are the same fixed/variable-timestep idea" },
        { to: "game-math", note: "Coordinate transforms set up the vector math you formalize next" },
      ],
    },
    {
      id: "game-math",
      title: "Game math: vectors, transforms, curves",
      level: "Intermediate",
      body: [
        "Vectors deeply (**dot product** for angle/projection, **cross product** for side tests), trigonometry (`atan2`), **lerp/slerp/Bezier** for smooth motion, and coordinate transforms (local vs global, parent-child).",
        "This is linear algebra you can *see* — the same math that, scaled up to 4×4 matrices and quaternions, drives 3D rendering.",
      ],
      resources: [
        { label: "3Blue1Brown — Essence of Linear Algebra", url: "https://www.3blue1brown.com/topics/linear-algebra", type: "video" },
        { label: "Immersive Math — interactive linear algebra", url: "https://immersivemath.com/ila/index.html", type: "book" },
      ],
      connections: [
        { to: "ai-math", note: "Same linear algebra (dot products, projections) underpins ML" },
        { to: "game-rendering", note: "These vectors scale to model/view/projection matrices in 3D" },
      ],
    },
    {
      id: "game-physics",
      title: "Physics & collision",
      level: "Intermediate",
      body: [
        "Rigid-body dynamics (Euler vs **Verlet** integration, why Euler drifts), **impulse resolution** with the **Separating Axis Theorem** for convex polygons, collision broadphase (spatial hashing, quadtrees — beating naive O(n²)), raycasting (slab method), and constraints (springs, **XPBD**).",
        "Building a physics engine (AABB broadphase + SAT narrowphase + impulse resolution) is the canonical intermediate project.",
      ],
      resources: [
        { label: "Real-Time Collision Detection — Ericson (reference)", url: "https://realtimecollisiondetection.net/books/rtcd/", type: "book" },
        { label: "Randy Gaul — how to build a physics engine", url: "https://randygaul.github.io/", type: "docs" },
      ],
      connections: [
        { to: "dsa-complexity", note: "SAT, convex hull and line-sweep are computational geometry" },
        { to: "dsa-hashing", note: "Spatial hashing for broadphase is hashing applied to space" },
        { to: "quant-options", note: "Numerical integration (Euler/Verlet) parallels SDE simulation in pricing" },
      ],
    },
    {
      id: "game-ecs",
      title: "Entity-Component Systems",
      level: "Intermediate",
      body: [
        "**ECS**: why it exists (cache-friendly data layout, composition over inheritance), **archetypes** (grouping entities by component signature → SoA storage), systems that iterate over component sets, and data-driven design.",
        "ECS is essentially data-oriented design formalized for games — it's the same SoA/cache argument from low-level performance.",
      ],
      resources: [
        { label: "Bevy ECS — book & docs (Rust)", url: "https://bevy.org/learn/", type: "docs" },
        { label: "Sander Mertens (flecs) — ECS FAQ & articles", url: "https://github.com/SanderMertens/ecs-faq", type: "repo" },
      ],
      connections: [
        { to: "ll-cache", note: "ECS exists to get SoA, cache-line-friendly iteration" },
        { to: "ll-rust", note: "Bevy is the flagship Rust ECS engine" },
      ],
    },
    {
      id: "game-ai",
      title: "Game AI: FSMs, behavior trees, pathfinding",
      level: "Intermediate",
      body: [
        "Finite state machines (the State pattern), **behavior trees** (selectors/sequences/decorators), **A\\*** pathfinding (with a binary-heap priority queue) over tilemaps and navmeshes, **steering behaviors** (seek/flee/flocking), and efficient spatial queries (KD-tree / spatial hashing).",
        "A* here is the same graph-search you met in DSA, made interactive.",
      ],
      resources: [
        { label: "Red Blob Games — A* & pathfinding (interactive)", url: "https://www.redblobgames.com/pathfinding/a-star/introduction.html", type: "tool", note: "the best A* explainer" },
        { label: "Behavior trees — Game AI Pro (free chapters)", url: "https://www.gameaipro.com/", type: "book" },
      ],
      connections: [
        { to: "dsa-graphs", note: "A* is informed graph search — Dijkstra plus a heuristic" },
        { to: "ai-rl", note: "Modern NPC behavior increasingly uses RL / behavior cloning" },
      ],
    },
    {
      id: "game-rendering",
      title: "3D rendering pipeline & PBR",
      level: "Advanced",
      body: [
        "3D math (4×4 model/view/projection, **quaternions** vs gimbal lock), frustum culling, **deferred rendering** (G-buffer), **shadow mapping** (PCF, cascaded), **PBR** (Cook-Torrance BRDF, metallic/roughness), and screen-space effects (SSAO, SSR, TAA) plus post-processing (bloom, ACES tonemapping).",
        "Shaders are massively-parallel programs — this is where game dev becomes GPU programming.",
      ],
      resources: [
        { label: "LearnOpenGL (free, complete)", url: "https://learnopengl.com/", type: "course", note: "start here for real-time rendering" },
        { label: "The Book of Shaders (free)", url: "https://thebookofshaders.com/", type: "book" },
        { label: "Physically Based Rendering (PBRT, free online)", url: "https://www.pbr-book.org/", type: "book" },
      ],
      connections: [
        { to: "gpu-model", note: "Shaders run on the same SIMT GPU execution model as CUDA" },
        { to: "game-math", note: "MVP matrices are the vector math scaled to homogeneous coordinates" },
        { to: "ll-microarch", note: "Hitting 60fps demands branchless, data-oriented CPU code too" },
      ],
    },
    {
      id: "game-gpu-api",
      title: "Custom renderer: OpenGL / Vulkan",
      level: "Advanced",
      body: [
        "OpenGL (VAO/VBO/EBO, UBOs, framebuffers) as the gentle entry, then **Vulkan**: explicit instance/device/command-buffers/render-passes/pipelines/descriptor-sets and synchronization (semaphores/fences/barriers). Vulkan trades verbosity for control and multi-threaded submission.",
        "Writing a renderer from scratch is the project that converts graphics theory into a working GPU pipeline.",
      ],
      resources: [
        { label: "Vulkan Tutorial (free)", url: "https://vulkan-tutorial.com/", type: "course", note: "best Vulkan intro" },
        { label: "Vulkan Guide (vkguide.dev)", url: "https://vkguide.dev/", type: "docs" },
      ],
      connections: [
        { to: "gpu-model", note: "Vulkan compute and CUDA expose the same underlying GPU hardware" },
        { to: "web-advanced", note: "WebGPU brings this explicit GPU model to the browser" },
        { to: "ll-concurrency", note: "Vulkan synchronization is GPU-CPU concurrency with barriers/fences" },
      ],
    },
    {
      id: "game-netcode",
      title: "Netcode for multiplayer",
      level: "Advanced",
      body: [
        "**Deterministic lockstep** (RTS), client-server with **client-side prediction** + reconciliation, **entity interpolation**, **lag compensation** (rewind to the shot's time), and why games use **UDP** (controlling ordering/reliability in game code). Netcode libs: ENet, Valve's GameNetworkingSockets.",
        "Gaffer On Games is the canonical reference — netcode is where game dev meets hard distributed-systems problems.",
      ],
      resources: [
        { label: "Gaffer On Games — networked physics & netcode", url: "https://gafferongames.com/", type: "docs", note: "the definitive netcode reference" },
        { label: "Valve — Source multiplayer networking", url: "https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking", type: "docs" },
      ],
      connections: [
        { to: "ll-network", note: "UDP, ordering and reliability are the transport layer you study low-level" },
        { to: "web-systemdesign", note: "Authoritative servers and state sync are distributed-systems problems" },
      ],
    },
    {
      id: "game-raytracing",
      title: "Ray tracing & global illumination",
      level: "Expert",
      body: [
        "**BVH** construction (SAH), **path tracing** with importance sampling and **ReSTIR**, real-time global illumination (irradiance probes, UE5's Lumen), GPU-driven rendering (indirect draws, meshlets/mesh shaders), and ML in graphics (DLSS/FSR upscaling).",
        "The cutting edge of rendering, increasingly hardware-accelerated and ML-assisted.",
      ],
      resources: [
        { label: "Ray Tracing in One Weekend (free series)", url: "https://raytracing.github.io/", type: "book" },
        { label: "Physically Based Rendering (PBRT, free)", url: "https://www.pbr-book.org/", type: "book" },
      ],
      connections: [
        { to: "gpu-matmul", note: "Path tracing is massively parallel; BVH traversal maps onto GPU kernels" },
        { to: "ai-diffusion", note: "Neural upscaling/denoising (DLSS) brings diffusion-era ML into rendering" },
      ],
    },
  ],
});
