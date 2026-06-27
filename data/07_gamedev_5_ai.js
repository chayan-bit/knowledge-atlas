atlasAdd({
  id: "gamedev",
  topics: [
    {
      id: "game-ai",
      title: "Game AI: FSMs, behavior trees, pathfinding",
      level: "Intermediate",
      body: [
        "**FSMs** for simple state logic, **behavior trees** for hierarchical reactive behavior, **A\\*** with a binary heap for optimal pathfinding, **steering behaviors** (seek, flee, pursue, arrive, flocking) for movement, and **spatial data structures** (KD-tree, spatial hashing) for neighbor queries.",
        "Game AI is about creating the _illusion_ of intelligence cheaply - not solving the AI problem. A cheap behavior tree that feels right beats an expensive model that feels wrong.",
      ],
      subtopics: [
        {
          title: "Finite state machines for character behavior",
          body: [
            "**Finite state machines (FSMs)** are the oldest and most widely used game AI technique. A character FSM has a set of states (Idle, Patrol, Chase, Attack, Flee, Dead), a set of transitions between states (each with a condition), and one current active state. Each state defines what the character does while in that state (`patrol_update()`: follow waypoints) and which transitions to check each frame. Transitions are priority-ordered: check the highest-priority transition first; if its condition is true, switch to the target state.",
            "**Implementation options**: switch-statement (simplest - a big switch/case on the current state enum, calling state-specific update logic), state table (a 2D array of [current_state][event] = next_state, separating transition data from logic), and the **State object pattern** (each state is an object with `enter()`, `update()`, `exit()` methods - the cleanest for complex states). For most game characters, a switch statement with clear functions per state is perfectly adequate.",
            "**Hierarchical FSMs (HFSM)**: when FSMs grow large, **superstates** group related states. A `Combat` superstate contains `Chase`, `Attack`, and `Takingcover` - any of these states can transition to `Flee` or `Dead` without repeating that transition in each sub-state. HFSMs reduce the number of transitions needed and allow common behavior to be inherited from the superstate. They are the natural stepping stone between FSMs and behavior trees.",
            "**Transition conditions and their implementation**: transitions check world state (enemy distance, health level, line-of-sight, timer elapsed). Efficient condition checking: don't run expensive queries (ray casts, pathfinding) on every transition every frame. Cache results: 'last_player_position' is updated by a nearby-cast every 200ms, not every frame. Timer-based transitions: track time since entering the current state; transition after a duration (Patrol → Idle after 5 seconds without a target).",
            "**FSM debugging**: FSMs are predictable - you can log every transition with context and replay exactly why a character made a decision. Build a debug overlay that shows the current state and recent transitions for any selected NPC. This visibility is a key advantage over neural approaches: when a character does something wrong, you can identify the exact transition that was taken and the condition that triggered it.",
          ],
          resources: [
            { label: "Game AI Pro - FSM articles", url: "https://www.gameaipro.com/", type: "book" },
            { label: "Game Programming Patterns - State", url: "https://gameprogrammingpatterns.com/state.html", type: "book" },
          ],
        },
        {
          title: "Behavior trees: structure, node types, and design",
          body: [
            "**Behavior trees (BTs)** are a hierarchical reactive control architecture. They supersede FSMs for complex characters because: (1) they don't have the state-explosion problem (adding behavior adds branches, not O(N^2) new transitions), (2) they naturally express priority-based behavior (try the best action first, fall back on failure), and (3) they are reusable (a 'find-cover' subtree can be shared across enemy types). BTs originated in AAA game AI (Halo 2, 2004) and are now the standard for complex NPCs.",
            "**The four fundamental node types**: **Selector** (priority fallback): tries children left-to-right; succeeds as soon as one child succeeds; fails only if all children fail. Use for: 'try to attack, if that fails try to find cover, if that fails flee'. **Sequence**: tries children left-to-right; succeeds only if all children succeed; fails as soon as one child fails. Use for: 'move to position AND aim AND fire' (all must succeed). **Decorator**: a single-child node that modifies the child's behavior (Inverter flips success/failure, Repeater runs the child N times, Timeout fails if child takes too long). **Leaf (Action/Condition)**: the actual behavior nodes - `MoveToPosition`, `AttackTarget`, `IsHealthAbove50%`.",
            "**Tick semantics and returning status**: every BT node returns one of three statuses: `SUCCESS`, `FAILURE`, or `RUNNING` (the action is still in progress and needs more ticks). On the next tick, the tree restarts from the root (reactive) or resumes from the previously `RUNNING` node (stateful/with memory). The reactive model is simpler and ensures the tree always reflects current world state. The stateful model is more efficient but requires explicit interruption handling when conditions change mid-execution.",
            "**Blackboard**: BTs need to share data between nodes (e.g., 'EnemySeekSubtree' finds the nearest enemy and stores it in the blackboard as `target`; 'AttackSubtree' reads `target` from the blackboard). The blackboard is a typed key-value store per entity. It is NOT global - each entity has its own blackboard. Design: leaf nodes read from and write to the blackboard; they don't query the world directly (centralizes world queries and makes the BT testable with a mock blackboard).",
            "**Common BT design patterns**: the **Guard** pattern: a Selector with a Condition first - `Selector([HasAmmo?, Sequence([Aim, Fire])])` - the sequence only runs if the guard condition passes. The **Cooldown** pattern: a Decorator that prevents an action from running again for N seconds after it succeeds. The **Service** pattern (Unreal BT): a node that runs periodically on a subtree's tick - e.g., update the nearest enemy reference every 500ms while the attack subtree is active. Services avoid running expensive queries every frame while keeping the blackboard reasonably fresh.",
          ],
          resources: [
            { label: "Behavior Tree primer - Chris Simpson", url: "https://www.gamedeveloper.com/programming/behavior-trees-for-ai-how-they-work", type: "docs" },
            { label: "Unreal Engine - Behavior Tree overview", url: "https://dev.epicgames.com/documentation/en-us/unreal-engine/behavior-trees-in-unreal-engine---overview", type: "docs" },
          ],
        },
        {
          title: "A* pathfinding: algorithm, heuristics, and optimizations",
          body: [
            "**A\\*** is the standard pathfinding algorithm for games: it finds the optimal (shortest cost) path between two nodes in a graph. It combines Dijkstra's algorithm (which finds the optimal path but explores in all directions) with a heuristic that guides exploration toward the goal. The heuristic $h(n)$ estimates the cost from node $n$ to the goal. A* is guaranteed to find the optimal path if $h$ is admissible (never overestimates the true cost) and consistent ($h(n) \\leq \\text{cost}(n, n') + h(n')$ for each neighbor $n'$).",
            "**A* algorithm**: maintain an open set (nodes to evaluate) and a closed set (already evaluated). Start: insert the start node with $g = 0$. Loop: extract the node with minimum $f = g + h$ from the open set. If it's the goal, reconstruct the path by following parent pointers. Otherwise: for each neighbor, compute $g_{new} = g_{current} + \\text{edge\\_cost}$. If the neighbor is not in the closed set and $g_{new}$ is better than any previous path to it, update its parent and $g$, add it to the open set. The open set is a min-heap keyed on $f$ - the critical implementation detail. Using a naive sorted array degrades to O(N^2); a binary heap gives O(N log N).",
            "**Grid pathfinding**: for grid-based maps, nodes are tiles and edges connect adjacent tiles (4-directional: horizontal/vertical; 8-directional: adds diagonals). Heuristics: Manhattan distance $|dx| + |dy|$ (for 4-directional movement only), Chebyshev distance $\\max(|dx|, |dy|)$ (for 8-directional), Euclidean $\\sqrt{dx^2 + dy^2}$ (for any-direction). For 8-directional movement, the octile distance $|dx| + |dy| + (\\sqrt{2} - 2) \\min(|dx|, |dy|)$ is the most accurate admissible heuristic. Weighted A* ($f = g + w \\cdot h$ with $w > 1$) finds suboptimal paths much faster - acceptable in games where near-optimal is fine.",
            "**Navigation meshes (NavMesh)**: for 3D environments, a grid is too coarse. A NavMesh is a set of convex polygons (cells) that cover the walkable floor. Pathfinding on a NavMesh: build a graph where each cell is a node, edges connect adjacent cells; run A* on this graph to find the sequence of cells from start to goal; use funnel algorithm (or string-pulling) to compute the actual smooth path through cell corridors. NavMesh pathfinding is faster than fine-grained grids and handles arbitrary 3D geometry. Recast/Detour (the open-source NavMesh library behind Unity, Godot, and Unreal's NavMesh) implements this.",
            "**Pathfinding optimizations**: **hierarchical pathfinding**: divide the map into regions; precompute inter-region connectivity; at query time, find the high-level region path first, then detail within each region. **Jump-point search (JPS)**: for uniform-cost grids, prune symmetric paths by 'jumping' past intermediate nodes, reducing the nodes explored by 10-40x over A*. **Flow fields**: for many agents going to the same destination (RTS games), compute A* once to the goal and store a 'flow direction' at every tile; agents read their local flow direction to move. Handles thousands of agents without individual pathfinding calls.",
          ],
          resources: [
            { label: "Red Blob Games - A* tutorial (interactive)", url: "https://www.redblobgames.com/pathfinding/a-star/introduction.html", type: "tool", note: "the best interactive explanation on the web" },
            { label: "Recast/Detour NavMesh library", url: "https://github.com/recastnavigation/recastnavigation", type: "repo" },
          ],
        },
        {
          title: "Steering behaviors and flocking",
          body: [
            "**Steering behaviors** (Craig Reynolds, 1999) compute a desired velocity for an agent based on its goal and environment. Unlike pathfinding (which finds a route), steering handles the continuous movement toward that route in a responsive, natural way. Each behavior returns a desired velocity vector; multiple behaviors can be combined (weighted sum, priority blend) to produce complex emergent motion.",
            "**Core behaviors**: **Seek**: desired velocity = `normalize(target - position) * max_speed`. The agent moves directly toward the target at maximum speed. **Flee**: the opposite - move away from the target. **Arrive**: like seek, but slows down as the agent approaches the target. Compute the distance; if within `stopping_radius`, desired velocity = `(target - position) * (max_speed / stopping_radius)` (proportional to distance). **Pursue**: seek to the predicted future position of the target: `target + target_velocity * look_ahead_time`. **Evade**: flee from the predicted future position.",
            "**Separation, alignment, cohesion (Reynolds flocking)**: **Separation**: steer away from neighbors within a minimum distance (avoid crowding). **Alignment**: steer toward the average heading of nearby neighbors (fly in the same direction as the flock). **Cohesion**: steer toward the average position of nearby neighbors (stay with the group). Combining all three with weights produces the emergent flocking behavior seen in bird murmurations, fish schools, and crowd simulations. The neighbor queries (who is within radius R?) are handled by spatial hashing or a KD-tree.",
            "**Combining behaviors**: **Weighted sum**: add all behavior vectors with weights. Simple but can produce contradictory results (e.g., seek and flee at equal weight cancel out, leaving the agent stuck). **Priority**: evaluate behaviors in priority order; use the first non-zero result. A fleeing agent ignores arrive and cohesion while in danger. **Context steering** (by Jaime Dawson): instead of summing directions, build a circular interest and danger map. Each behavior writes interest weights to directions around the agent; the movement direction is chosen by selecting the highest-interest direction that is not blocked by danger. This handles obstacles naturally and avoids the cancellation problem.",
            "**Path following with steering**: steering behaviors and A* pathfinding work together. A* gives the planned route (a series of waypoints). Steering implements the actual movement: the agent seeks the next waypoint using the 'arrive' behavior (slowing to stop at the waypoint before moving to the next). For smoother motion, use 'path following' (seek a point that is `look_ahead_distance` ahead along the path rather than the next waypoint) - this produces smoother curves and allows the agent to cut corners.",
          ],
          resources: [
            { label: "Red Blob Games - Steering behaviors", url: "https://www.red3d.com/cwr/steer/", type: "docs" },
            { label: "Boids original paper - Reynolds 1987", url: "https://www.cs.toronto.edu/~dt/siggraph97-course/cwr87/", type: "paper" },
          ],
        },
        {
          title: "Spatial structures for AI queries: KD-trees and flow fields",
          body: [
            "**Nearest-neighbor queries** are ubiquitous in game AI: find the nearest enemy (for targeting), find all enemies within aggro range (for alerting), find the nearest cover point (for combat AI). A linear scan over all N entities is O(N) per query - with 100 enemies making 100 queries per frame, that's 10,000 comparisons per frame, which becomes a bottleneck. Spatial data structures reduce this to O(log N) per query.",
            "**KD-tree (K-dimensional tree)**: a binary tree that partitions space. Build: choose a splitting plane (alternating X/Y/Z axes); split entities by position relative to the plane; recurse on each half. Query (nearest neighbor): traverse the tree, pruning branches whose bounding regions are farther from the query point than the current best candidate. Expected O(log N) for random data; O(N) worst case for adversarial data. KD-trees work well for static or slow-changing point sets. For highly dynamic scenes (all entities moving every frame), the rebuild cost is prohibitive - prefer spatial hashing.",
            "**Rebuilding vs updating**: KD-trees are expensive to update (a single point moving may require restructuring much of the tree). For game AI, a common strategy: rebuild the KD-tree once per frame from scratch (fast if N < 10,000 and entities are points, not large shapes) using a cache-friendly construction. Alternatively, use the tree only for slow queries (target acquisition every 500ms) and accept linear scan for cheap frequent queries.",
            "**Flow fields for large-scale movement**: in RTS games, thousands of units may need to navigate to the same destination. Running A* for each unit is too expensive. Instead, compute a **flow field**: run a Dijkstra backward from the goal (expanding outward from the goal, computing the minimum cost to reach the goal from each cell). Store a 'flow direction' (the direction of the cheapest next cell) at every cell. Each unit reads its current cell's flow direction and moves in that direction - O(1) per unit per frame after the O(N cells) one-time computation. Flow fields also naturally handle dynamic obstacles (recompute the affected region) and can be layered (a separate flow field per unit type with different terrain costs).",
            "**Influence maps**: a game AI tool for spatial awareness. An influence map is a grid where each cell stores a score: how much military presence each faction has in that area. Computed by: for each unit, add its 'influence' to nearby cells (using a distance-decay function). Systems read influence maps to make strategic decisions: 'move toward high enemy influence' (aggressive) or 'avoid high enemy influence' (defensive). Influence maps are used in RTS games for macro AI (where to expand, where to attack), not per-unit decisions. They are cheap to maintain (incrementally updated as units move) and naturally aggregate spatial information.",
          ],
          resources: [
            { label: "Red Blob Games - Pathfinding collection", url: "https://www.redblobgames.com/pathfinding/", type: "tool" },
            { label: "Game AI Pro - Flow fields chapter", url: "https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter23_Crowd_Pathfinding_and_Steering_Using_Flow_Field_Tiles.pdf", type: "paper" },
          ],
        },
      ],
      resources: [
        { label: "Red Blob Games - game AI collection", url: "https://www.redblobgames.com/", type: "tool" },
        { label: "Game AI Pro (free PDF)", url: "https://www.gameaipro.com/", type: "book" },
      ],
      connections: [
        { to: "dsa-graphs", note: "A* and Dijkstra are graph traversal algorithms" },
        { to: "ai-rl", note: "BTs and FSMs are handcrafted; RL learns the policy automatically - compare tradeoffs" },
      ],
    },
  ],
});
