atlasAdd({
  id: "gamedev",
  topics: [
    {
      id: "game-loop",
      title: "The game loop & 2D fundamentals",
      level: "Beginner",
      body: [
        "**Fixed vs variable timestep** (why physics needs fixed update), delta time, coordinate systems (screen vs world), sprite batching (why draw calls are expensive), broad-phase **AABB collision**, input handling, tilemaps, camera follow with lerp, and game-state machines.",
        "Ship Pong/Breakout/a platformer with proper physics — finishing real games teaches more than any tutorial.",
      ],
      subtopics: [
        {
          title: "The game loop: fixed vs variable timestep and the frame budget",
          body: [
            "The **game loop** is the heartbeat of every real-time game: a loop that runs continuously, updating game state and rendering a frame on each iteration. Unlike an event-driven application that sleeps waiting for user input, the game loop runs unconditionally - processing input, updating simulation, and drawing output, all within a hard time budget. At 60fps, that budget is 16.67ms per frame. Exceed it and frames drop; users see a stutter.",
            "**Variable timestep**: the simplest loop measures the wall-clock time since the last frame (`delta_time`) and scales all updates by it. Moving a character: `position += velocity * delta_time`. This keeps motion consistent regardless of frame rate - a game running at 30fps or 120fps produces the same trajectory over one second. The problem: floating-point arithmetic over varying delta times accumulates differently depending on frame rate, and physics simulation becomes **non-deterministic**: a stiff spring simulated at 30fps behaves differently from the same spring at 120fps. Non-determinism breaks deterministic netcode (lockstep) and makes replays impossible.",
            "**Fixed timestep**: physics and game logic advance in fixed-size steps (e.g., every 16.67ms), independent of the rendering frame rate. The canonical implementation: accumulate elapsed wall-clock time; consume it in fixed increments; render with whatever time is left. `while (accumulated >= FIXED_STEP) { update(FIXED_STEP); accumulated -= FIXED_STEP; }`. The game state can be rendered at any point between two physics frames - **interpolation** (blending between the previous and current state by `accumulated / FIXED_STEP`) smooths the visual result. This is Gaffer's 'Fix Your Timestep' pattern, the industry standard for physics-driven games.",
            "**The spiral of death** is the failure mode of naive fixed-step loops: if a frame takes longer than `FIXED_STEP` to render (e.g., hitching at 32ms on a 16ms step budget), the update loop runs twice to catch up, making the next frame take even longer, which runs the loop three times... The system falls further and further behind. The fix: cap the maximum accumulated time (e.g., 250ms). If the game is too behind, skip physics time rather than trying to catch up - visible slowdown is better than a death spiral.",
            "**The rendering loop structure**: `input_poll() → update(delta) → render()`. Input polling should happen at the start of every frame (not at the physics step rate) so that key presses are never missed between physics steps. `render()` is separate from `update()` and can run at a different (higher) rate on hardware that supports it. On a 144Hz monitor with a 60Hz physics step, the renderer may run 2-3 times per physics step, each time interpolating the visible state. High-refresh-rate monitors benefit from this decoupling - physics stays deterministic at 60Hz while rendering is buttery smooth at 144fps.",
          ],
          resources: [
            { label: "Fix Your Timestep! - Gaffer On Games", url: "https://gafferongames.com/post/fix_your_timestep/", type: "docs", note: "the definitive reference for game loop design" },
            { label: "Game Programming Patterns - Game Loop chapter", url: "https://gameprogrammingpatterns.com/game-loop.html", type: "book" },
          ],
        },
        {
          title: "Coordinate systems, camera transforms, and world/screen space",
          body: [
            "Every 2D game uses at least two coordinate spaces: **world space** (the game's logical coordinate system, potentially infinite) and **screen space** (pixel coordinates on the display, bounded by resolution). Objects in the game world have positions in world space; the GPU needs positions in screen space. The **camera** is the transform that converts between them: it defines a rectangular region of world space that maps to the full screen.",
            "**Camera transform**: a 2D camera is defined by its world-space position, zoom factor, and rotation. To transform a world-space point to screen space: (1) subtract the camera position (translate so the camera is at the origin), (2) multiply by the zoom factor (scale), (3) add half the screen dimensions (shift origin from center to top-left if the API uses that convention). In matrix form: `screen_pos = (world_pos - camera_pos) * zoom + screen_center`. Inverting this transform converts a screen-space mouse click to a world-space position - essential for click-to-move and UI hit testing.",
            "**Coordinate system conventions** vary by engine and platform. Y-axis: OpenGL uses Y-up (positive Y is up, origin at screen center); most 2D frameworks use Y-down (positive Y is down, origin at top-left). Mixing conventions is a constant source of bugs (flipped sprites, inverted collision normals). Pick one system and convert at the boundary (at load time or shader time). **Tile coordinates** add a third space: a tilemap at 32x32 pixels per tile maps tile `(3, 5)` to world position `(96, 160)`. Functions that convert between tile, world, and screen space should be explicit and centrally defined.",
            "**Camera follow with lerp**: a camera that snaps instantly to the player is jarring. Smooth follow: `camera_pos = lerp(camera_pos, target_pos, smoothing * delta_time)`. The `smoothing` parameter controls lag: high value (e.g., 10) means the camera nearly catches up every second; low value (e.g., 1) means it lags behind significantly. **Lerp-based smoothing has a known problem**: it is frame-rate dependent. `lerp(a, b, factor * dt)` does not behave the same at 30fps vs 60fps. The frame-rate-independent version uses exponential decay: `camera_pos = b + (a - b) * exp(-smoothing * dt)`, which is mathematically equivalent to running the lerp loop at infinite fps.",
            "**Viewport and letterboxing**: at different display resolutions (4:3, 16:9, 21:9), a game designed for one aspect ratio needs strategy. Options: **stretch** (distort the image to fill the screen - only acceptable for pixel art if scaled to integer multiples), **letterbox** (black bars on the sides/top with the correct aspect ratio maintained), **expand** (show more of the world on wider screens - requires a minimum and maximum visible area). The implementation: define a fixed reference resolution, render to a framebuffer at that resolution, then blit with appropriate scaling to the actual display.",
          ],
          resources: [
            { label: "Godot 4 - Cameras and Viewports", url: "https://docs.godotengine.org/en/stable/tutorials/2d/camera_2d.html", type: "docs" },
            { label: "Red Blob Games - Coordinate transforms (interactive)", url: "https://www.redblobgames.com/", type: "tool" },
          ],
        },
        {
          title: "Sprite batching and the draw call problem",
          body: [
            "Every time you ask the GPU to render something, there is a **draw call**: a CPU-to-GPU command that sets up state (shaders, textures, blend modes, transform matrices) and then issues the render. Each draw call has overhead - the driver validates state, submits the command buffer, and the GPU processes the submission. On older hardware and mobile, 100-200 draw calls per frame is the practical limit before GPU-CPU synchronization costs dominate. A naive 2D game that issues one draw call per sprite at 500 visible sprites will spend most of its frame in driver overhead, not actual rendering.",
            "**Sprite batching** solves this by grouping many sprite draws into a single draw call. The key insight: if multiple sprites share the same texture and render state (same shader, same blend mode), their vertex data can be combined into one large vertex buffer and submitted in a single draw call. The CPU builds a vertex buffer on the fly each frame: for each sprite, compute its four corner positions (applying position, rotation, scale), write them with UV coordinates and tint color into the buffer, then submit the entire batch as one draw call when the texture changes or at frame end.",
            "**Texture atlases (sprite sheets)** are the enabler: packing many individual sprites into a single large texture means you never need to change textures between sprites. Without an atlas, every sprite with a different texture breaks the batch (a texture state change requires flushing the current batch). With an atlas, thousands of sprites from the same atlas render in one draw call, using UV coordinates to select the correct sub-region. Tools: TexturePacker, Aseprite export, Godot's built-in atlas support. The atlas must respect power-of-two texture dimensions on older hardware.",
            "**Sorting and draw order**: 2D games require sprites to draw in the correct order (a character behind a tree should not appear on top of it). This is typically sorted by Y position (the character with higher Y coordinate - lower on screen - draws in front) or by a `z_index` property. Sorting breaks batching: if sprite A and sprite C are from atlas 1, but sprite B (sorted between them) is from atlas 2, the batch is: [A], [B], [C] - three separate draw calls instead of one. Solutions: accept the cost (small games), sort within atlases (objects on the same layer use the same atlas), or use a depth buffer with transparency sorting.",
            "**Instanced rendering** is the GPU-side complement to batching. Instead of many copies of vertex data, you store vertex data once and submit instance data (position, rotation, UV offset, tint) for each instance. `glDrawElementsInstanced(primitive, count, type, indices, instance_count)` draws `instance_count` copies of the same mesh, with per-instance data read from a second vertex buffer via `gl_InstanceID`. For rendering 1000 identical trees or particles, instancing is dramatically faster than batching (the geometry is uploaded once; only the per-instance attributes vary). Modern engines use instancing for terrain tiles, particles, vegetation, and anything with many copies of the same mesh.",
          ],
          resources: [
            { label: "LearnOpenGL - Instancing", url: "https://learnopengl.com/Advanced-OpenGL/Instancing", type: "docs" },
            { label: "Game Programming Patterns - Spatial Partition", url: "https://gameprogrammingpatterns.com/spatial-partition.html", type: "book" },
          ],
        },
        {
          title: "AABB collision detection and broadphase/narrowphase separation",
          body: [
            "**AABB (Axis-Aligned Bounding Box)** collision is the foundation of 2D physics: two rectangles, aligned to the X and Y axes, overlap if and only if they overlap on both axes simultaneously. Test: `A.min_x < B.max_x && A.max_x > B.min_x && A.min_y < B.max_y && A.max_y > B.min_y`. If any axis shows separation, the boxes are not overlapping. This O(1) test is the fundamental building block of all higher-level collision systems.",
            "**Broadphase vs narrowphase**: for N objects, testing all pairs is O(N^2) - with 100 enemies, that is 4950 pair tests per frame. **Broadphase** is a fast, conservative filter that quickly eliminates most pairs: it finds pairs that *might* be colliding (their bounding volumes overlap). **Narrowphase** applies a precise (more expensive) test only to the candidate pairs from broadphase. For 2D AABB vs AABB, the narrowphase is already the AABB test; broadphase is about reducing the number of pairs to test.",
            "**Broadphase strategies**: **Spatial hashing** divides the world into a grid of cells; each object registers in every cell it overlaps; only objects in the same cell are tested against each other. O(N) insertion, O(1) lookup per cell. Best for uniformly distributed objects of similar size. **Quadtree/Octree**: recursive spatial subdivision - each node holds objects until capacity is exceeded, then splits into four children. O(N log N) insertion, efficient for sparse or clustered distributions. **Sort and sweep (sweep and prune)**: sort all bounding box extents on one axis; only boxes whose extents overlap on that axis are candidates (two boxes that are separated on any axis cannot collide). O(N log N) sort, O(N + K) sweep for K actual overlapping pairs. Excellent for mostly-stationary scenes where the sorted order changes little between frames (incremental resort is nearly O(N)).",
            "**Continuous collision detection (CCD)** solves the **tunneling problem**: a fast-moving object (a bullet, a player jumping at high speed) can pass entirely through a thin wall in a single physics step if its displacement per step exceeds the wall's thickness. Naive discrete collision detection misses this entirely. CCD computes the swept volume of the moving object (the AABB that encompasses all positions during the step) and tests it against static geometry, then finds the exact time of first contact via binary search or analytic solutions (ray-cast against the wall, find the hit time, clamp the movement). The cost: more expensive per pair; typically used only for fast-moving objects and thin geometry.",
            "**Collision response for platforms**: beyond detection, the game must respond correctly. A platformer needs to distinguish floor collisions (stop vertical velocity, allow walking) from wall collisions (stop horizontal velocity) from ceiling collisions (reverse vertical velocity). The standard approach: separate the physics into horizontal and vertical passes; resolve horizontal collisions first, then vertical. This 'axis-separated' approach is simpler and more predictable than resolving the full 2D overlap at once, at the cost of some physical inaccuracy at corners. **Corner correction**: when a player's corner barely clips a platform while moving upward, push them sideways slightly (if the overlap is small enough) rather than stopping them dead - this gives 'forgiving' platform feel and is used in virtually every commercial platformer.",
          ],
          resources: [
            { label: "Real-Time Collision Detection - Ericson", url: "https://realtimecollisiondetection.net/books/rtcd/", type: "book" },
            { label: "Red Blob Games - 2D collision detection", url: "https://www.redblobgames.com/articles/minkowski/", type: "tool" },
          ],
        },
        {
          title: "Game state machines and scene management",
          body: [
            "Every game has multiple high-level states: the main menu, gameplay, pause screen, game-over screen, loading screen. These states have different update logic, different rendering, and transitions between them must be handled cleanly (stopping music from the previous state, freeing assets no longer needed, initializing assets for the new state). A **game state machine** formalizes this structure and prevents the spaghetti code that emerges when state transitions are scattered across the codebase.",
            "**The State pattern**: each state is an object that implements an interface: `enter()` (called when the state becomes active - load assets, start music), `exit()` (called when leaving - free resources, stop sounds), `update(dt)` (per-frame logic), `render()` (per-frame drawing), `handle_input(event)` (process player input). The state machine holds the current state and delegates all calls to it. Transitions: `state_machine.change_to(new_state)` calls `current.exit()` then `new_state.enter()` and updates the current pointer.",
            "**Stacked state machine**: a simple state machine replaces the current state on transition. A stacked machine pushes states onto a stack - the gameplay state is pushed, then the pause menu is pushed on top of it. While paused, the pause menu handles input and renders; it can optionally call the gameplay state's render below it (for a see-through pause overlay). Popping the pause state resumes gameplay exactly where it left off. The stack naturally handles nested menus and modal dialogs.",
            "**Scene management** is the spatial complement to state machines. A scene (or level) is a collection of game objects with their initial state. Loading a new scene: unload the current scene (destroy all objects, free textures/audio), load the new scene's data (parse a file, instantiate objects). The loading process is often expensive - assets may be many megabytes. **Async loading** runs the load on a background thread while the main thread renders a loading screen (showing progress from a thread-safe progress counter). Unity's `LoadSceneAsync`, Godot's `ResourceLoader.load_threaded_request`, and Unreal's streaming sub-levels all implement this pattern.",
            "**Finite state machines for character behavior**: beyond game-level states, individual characters use FSMs for behavior. An enemy FSM: `Idle → Patrol → Chase → Attack → Return`. Each state has an update function and transition conditions (`if (player_distance < aggro_range) → Chase`). FSMs are predictable and debuggable: you can print the current state and reason about why a character behaves as it does. The limitation: FSMs with many states and transitions become unwieldy (the 'state explosion' problem). At that complexity, behavior trees (the next topic) are the appropriate tool.",
          ],
          resources: [
            { label: "Game Programming Patterns - State", url: "https://gameprogrammingpatterns.com/state.html", type: "book" },
            { label: "Godot 4 - State machines tutorial", url: "https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "Game Programming Patterns - Nystrom (free)", url: "https://gameprogrammingpatterns.com/", type: "book", note: "read all of it" },
        { label: "Godot 4 - documentation", url: "https://docs.godotengine.org/en/stable/", type: "docs" },
        { label: "Fix Your Timestep! - Gaffer On Games", url: "https://gafferongames.com/post/fix_your_timestep/", type: "docs" },
      ],
      connections: [
        { to: "web-react", note: "requestAnimationFrame UI loops are the same fixed/variable-timestep idea" },
        { to: "game-math", note: "Coordinate transforms set up the vector math you formalize next" },
      ],
    },
  ],
});
