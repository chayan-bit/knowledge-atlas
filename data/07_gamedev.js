// Game Development — domain shell (meta only).
// Topics live in 07_gamedev_*.js, each appended via atlasAdd's merge-by-id.
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
    "Each topic has textbook-length subtopics covering the underlying theory, implementation details, and edge cases - the goal is mastery, not orientation.",
  ],
  topics: [],
});
