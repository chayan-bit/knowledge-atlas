atlasAdd({
  id: "gamedev",
  topics: [
    {
      id: "game-ecs",
      title: "Entity-Component Systems",
      level: "Intermediate",
      body: [
        "**ECS** decouples data (components) from logic (systems). Entities are IDs; components are plain data structs; systems iterate over all entities that have the required components. Archetypes + SoA storage make this cache-friendly at scale.",
        "Understand cache-line utilization before optimizing - measure with VTune or perf before assuming the bottleneck.",
      ],
      subtopics: [
        {
          title: "The ECS model: entities, components, and systems",
          body: [
            "**Traditional OOP game objects** use deep inheritance hierarchies: `GameObject → Character → Player` or `→ Enemy → Boss`. The problems: you cannot compose behaviors that don't fit the hierarchy (a `FlyingEnemy` that also `HasInventory` requires multiple inheritance or mixins), performance is poor (virtual dispatch, pointer chasing through vtables), and adding new behavior requires modifying existing classes (violates open/closed principle). The classic example: you need a `RenderablePhysicsObject` - it must inherit from both `Renderable` and `PhysicsObject`, leading to the diamond problem.",
            "**The component approach**: instead of inheritance, objects are composed from bags of independent data components. A `Player` entity has `TransformComponent`, `RenderComponent`, `InputComponent`, `PhysicsComponent`, `HealthComponent`. An `EnemyArrow` entity has only `TransformComponent`, `RenderComponent`, `PhysicsComponent`. Each component is plain data with no behavior. Behavior is in **systems** that operate on all entities having specific component sets. The `PhysicsSystem` iterates over all entities with `TransformComponent + PhysicsComponent` and updates their positions. The `RenderSystem` iterates over `TransformComponent + RenderComponent` and draws them.",
            "**Entities as IDs**: in a pure ECS, an entity is just an integer ID. It has no data and no methods. Components are stored in component arrays indexed by entity ID (or more efficiently, in dense arrays with a mapping). `entity_id = world.create_entity()`. `world.add_component(entity_id, TransformComponent{x: 0, y: 0})`. `world.add_component(entity_id, HealthComponent{hp: 100})`. `world.destroy_entity(entity_id)` removes all its components. Entity IDs are typically 32-bit integers with a generation counter in the high bits to detect dangling references to destroyed entities.",
            "**Systems as pure functions over component queries**: a system declares the component types it needs and is given an iterator over all matching entities. `class PhysicsSystem { query: [TransformComponent, VelocityComponent]; update(dt) { for (auto [transform, vel] of world.query<Transform, Velocity>()) { transform.x += vel.x * dt; } } }`. The system has no state other than the components it reads and writes. This makes systems independently testable, easy to enable/disable at runtime, and parallelizable (systems with non-overlapping component read/write sets can run concurrently).",
            "**The relationship to the traditional component model**: Unity's original `MonoBehaviour` system is NOT ECS - it is the 'component pattern' (components on game objects with virtual method dispatch), which avoids deep inheritance but retains poor cache behavior. Unity's DOTS (Data-Oriented Technology Stack) is a real ECS. The distinction is critical: classic components are OOP with composition; ECS is data-oriented with no OOP at the entity level.",
          ],
          resources: [
            { label: "Game Programming Patterns - Component chapter", url: "https://gameprogrammingpatterns.com/component.html", type: "book" },
            { label: "Bevy ECS Book - intro", url: "https://bevyengine.org/learn/book/getting-started/ecs/", type: "docs" },
          ],
        },
        {
          title: "Archetype storage and cache efficiency",
          body: [
            "**Naive component storage**: a hash map per entity mapping component type to component data. Fast to modify (add/remove components), but terrible for systems that iterate over many entities - the components of each entity are scattered across memory, causing one cache miss per entity. A system iterating over 10,000 entities with naive storage causes 10,000 cache misses per component read.",
            "**Archetype-based storage** (used by Unity DOTS, Bevy, Flecs): entities are grouped by their exact set of components (their 'archetype'). All entities with the same archetype are stored together in contiguous arrays - one array per component type within the archetype. An entity with `[Transform, Velocity, Render]` goes into the `TVR` archetype. An entity with `[Transform, Velocity]` goes into the `TV` archetype. When a system queries for `[Transform, Velocity]`, it iterates over all archetypes that contain at least those components, which is a small set.",
            "**Structure of Arrays (SoA) vs Array of Structures (AoS)**: AoS (the natural OOP layout): `struct Entity { float x, y, z; float vx, vy, vz; Color color; }; Entity entities[N];` - when iterating to update positions, you load each entity's full struct but only use x,y,z and vx,vy,vz. The color field is wasted cache space. SoA (the ECS layout): separate arrays `float xs[N], ys[N], zs[N], vxs[N], vys[N], vzs[N], colors[N]`. The physics system loops over only xs,ys,zs,vxs,vys,vzs - tight, sequential memory access with perfect cache utilization. SIMD (AVX2, NEON) can process 8 floats simultaneously in SoA layout.",
            "**Archetype transitions**: when you add or remove a component from an entity, it moves to a different archetype. This is expensive: move all its component data from the old archetype's arrays to the new archetype's arrays. Game logic should minimize archetype transitions during gameplay. One pattern: add a `Dirty` tag component rather than removing the entity's 'active' status; system processes `[Dirty, SomeComponent]` entities. Another: pre-define all archetypes a gameplay entity will ever need (e.g., an enemy's states: `Active`, `Dead`, `Lootable`) and design transitions to be rare.",
            "**Sparse sets as an alternative**: some ECS implementations (EnTT, the popular C++ library) use **sparse set** storage: for each component type, a dense array of component data and a sparse array that maps entity ID to index in the dense array. Adding/removing components is O(1) (swap the removed component with the last element in the dense array). Iteration is over the dense array - fast and linear. Queries require intersecting the sets of entities having each required component. Sparse sets avoid archetype transitions but have worse cache behavior for large queries since entities with the same components may be scattered across the dense arrays.",
          ],
          resources: [
            { label: "flecs ECS FAQ - archetype internals", url: "https://github.com/SanderMertens/flecs/blob/master/docs/FAQ.md", type: "docs" },
            { label: "EnTT documentation - sparse sets", url: "https://github.com/skypjack/entt/wiki", type: "docs" },
          ],
        },
        {
          title: "System ordering, parallelism, and dependency graphs",
          body: [
            "**System ordering** matters: if the `InputSystem` reads input and writes `VelocityComponent`, and the `PhysicsSystem` reads `VelocityComponent` and writes `TransformComponent`, then `InputSystem` must run before `PhysicsSystem`. If you reverse the order, the physics system uses last frame's input. This ordering is typically specified explicitly (a fixed list), by dependency declarations, or derived automatically from read/write component sets.",
            "**Parallel system execution**: systems that read/write non-overlapping sets of components have no data dependencies and can run in parallel. `PhysicsSystem` (writes Transform, Velocity) and `AIDecisionSystem` (writes AIState, reads Transform) - if these don't share write targets, they can run concurrently. The ECS runtime builds a dependency graph: an edge from system A to system B if B reads a component that A writes (or vice versa). Systems with no edges between them can run in parallel.",
            "**Read/write locks on component types**: implementing parallel ECS requires careful synchronization. The common model: a system can hold multiple read locks (shared) or one write lock (exclusive) on each component type per frame. Before execution, acquire all locks; after execution, release them. This is safe but can serialize systems that need different locks on the same type. Some ECS implementations (Bevy) use a compile-time conflict checker - the borrow checker enforces that no two simultaneously running systems have conflicting access.",
            "**The 'main thread only' problem**: not all systems are parallelizable. Rendering must happen on the main thread (graphics API thread-safety constraints). Sound must happen on the audio thread. UI event processing is typically single-threaded. The standard approach: separate the ECS world into `world.update()` (can parallelize) and `world.render()` (main thread). Some engines use a double-buffer approach: the game state (ECS world) runs one frame ahead of the render frame, sending render commands to the main thread via a command queue.",
            "**Command buffers (deferred operations)**: during system execution, directly adding or removing entities and components would invalidate iterators (you're modifying the collection you're iterating over). Command buffers defer these operations: a system records `cmd.spawn(...)`, `cmd.despawn(entity)`, `cmd.add_component(entity, ...)` without immediately executing them. After all systems finish their updates, the command buffers are flushed in a safe, single-threaded phase. This is the standard pattern in Bevy, Unity DOTS, and Flecs.",
          ],
          resources: [
            { label: "Bevy ECS - system ordering and parallelism", url: "https://bevyengine.org/learn/book/programming/system-order/", type: "docs" },
            { label: "Unity DOTS - ECS concepts", url: "https://docs.unity3d.com/Packages/com.unity.entities@1.0/manual/concepts-intro.html", type: "docs" },
          ],
        },
        {
          title: "Data-driven design and scene serialization",
          body: [
            "**Data-driven design** means that game behavior is controlled by data files rather than hardcoded logic. An enemy's stats (health, speed, damage, aggro range, loot table) are defined in a JSON or CSV file that designers can edit without recompiling. The code reads this data at startup and configures component values accordingly. Benefits: designers can iterate without a programmer, balance changes don't require builds, A/B testing different parameter sets is easy, and modding is possible.",
            "**Prefabs (entity templates)**: a prefab is a serialized entity template - a predefined collection of components with default values. `enemy_goblin.prefab`: `{ Transform: {x:0,y:0}, Render: {sprite:'goblin.png'}, Health: {hp:50}, AI: {aggro_range:150, attack_damage:10} }`. Spawning a goblin instantiates this prefab (creates a new entity, copies component values, optionally overriding some). Unity, Godot, and Unreal all have prefab/blueprint/scene systems built on this concept. Prefab hierarchies allow a `chest_prefab` to contain a `lid_prefab` child.",
            "**Scene serialization**: a game scene is a collection of entities and their component data. Saving a scene: iterate over all entities, serialize their component data to JSON/binary. Loading: deserialize, create entities, assign components. The tricky part is references: component A may reference entity B by ID - those IDs must be remapped when loading into a world that already has existing entities (to avoid ID collisions). Remapping: assign new entity IDs to loaded entities, then fix up all cross-references.",
            "**The observer pattern for component events**: ECS systems are pull-based (they iterate and query). But some behaviors need push-based triggers: 'when a HealthComponent reaches zero, play a death animation'. The ECS observer pattern: register a callback `on_component_change(HealthComponent)` that fires when a component is modified. Flecs has built-in observer support. In Bevy, events are first-class resources (a component that is a queue of typed events). Unity DOTS uses change filtering (systems can query for entities whose specific components changed this frame). Push-based events are the exception; the default should always be pull-based iteration.",
          ],
          resources: [
            { label: "Flecs - relationships and hierarchy", url: "https://github.com/SanderMertens/flecs/blob/master/docs/Relationships.md", type: "docs" },
            { label: "Game Programming Patterns - Data Locality", url: "https://gameprogrammingpatterns.com/data-locality.html", type: "book" },
          ],
        },
      ],
      resources: [
        { label: "Bevy ECS Book", url: "https://bevyengine.org/learn/book/getting-started/ecs/", type: "docs" },
        { label: "flecs ECS - extensive documentation", url: "https://github.com/SanderMertens/flecs", type: "repo" },
        { label: "Game Programming Patterns - Data Locality", url: "https://gameprogrammingpatterns.com/data-locality.html", type: "book" },
      ],
      connections: [
        { to: "ll-cache", note: "SoA/AoS and cache-line awareness are the core ECS performance argument" },
        { to: "ll-rust", note: "Bevy ECS uses Rust's borrow checker for compile-time system parallelism safety" },
      ],
    },
  ],
});
