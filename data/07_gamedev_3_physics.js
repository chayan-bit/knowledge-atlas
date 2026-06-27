atlasAdd({
  id: "gamedev",
  topics: [
    {
      id: "game-physics",
      title: "Physics & collision",
      level: "Intermediate",
      body: [
        "**Rigid-body dynamics** (Euler vs Verlet integration), impulse-based collision resolution, **SAT** for convex shapes, broadphase strategies (spatial hashing, BVH), raycasting (slab method), and XPBD for constraint-based simulation.",
        "Writing a physics engine from scratch is one of the highest-leverage learning exercises in game dev - you touch every layer of the stack.",
      ],
      subtopics: [
        {
          title: "Rigid-body dynamics: integration schemes",
          body: [
            "A **rigid body** is an idealized solid that doesn't deform under forces. Its state is described by position $\\mathbf{x}$, velocity $\\mathbf{v}$, orientation $\\mathbf{q}$ (quaternion), and angular velocity $\\boldsymbol{\\omega}$. Each simulation step integrates the equations of motion: $\\dot{\\mathbf{x}} = \\mathbf{v}$, $m\\dot{\\mathbf{v}} = \\mathbf{F}$ (Newton's second law), $\\dot{\\mathbf{q}} = \\frac{1}{2}\\boldsymbol{\\omega}^* \\otimes \\mathbf{q}$ (quaternion derivative from angular velocity). The mass $m$ and inertia tensor $\\mathbf{I}$ (a 3x3 matrix relating angular impulse to angular velocity) define resistance to linear and rotational change.",
            "**Euler integration** (explicit Euler): $\\mathbf{v}_{n+1} = \\mathbf{v}_n + (\\mathbf{F}/m)\\Delta t$, $\\mathbf{x}_{n+1} = \\mathbf{x}_n + \\mathbf{v}_n \\Delta t$. Simple to implement, but it is an unstable integration scheme: energy accumulates over time, causing simulated springs to explode and orbits to spiral outward. The instability grows with timestep size - at small timesteps it is acceptable, but at large timesteps it diverges. Never use explicit Euler for stiff systems (springs with high stiffness constants).",
            "**Symplectic Euler** (a small fix): update velocity first, then use the updated velocity for position: $\\mathbf{v}_{n+1} = \\mathbf{v}_n + \\mathbf{a}_n \\Delta t$, $\\mathbf{x}_{n+1} = \\mathbf{x}_n + \\mathbf{v}_{n+1} \\Delta t$. This one change makes the integrator energy-conserving for conservative forces (Hamiltonian systems) and is the default in most game physics engines. Box2D, Bullet, and PhysX all use symplectic Euler as their core integrator.",
            "**Verlet integration**: $\\mathbf{x}_{n+1} = 2\\mathbf{x}_n - \\mathbf{x}_{n-1} + \\mathbf{a}_n \\Delta t^2$. Stores two positions rather than position and velocity. The implicit velocity is $\\mathbf{v}_n \\approx (\\mathbf{x}_{n+1} - \\mathbf{x}_{n-1}) / (2\\Delta t)$. Verlet integration is second-order accurate (error is $O(\\Delta t^2)$ vs $O(\\Delta t)$ for Euler) and is excellent for cloth, rope, and particle systems where constraints are important. The Jakobsen-style position correction (apply constraints by directly moving positions) works naturally with Verlet.",
            "**Runge-Kutta 4 (RK4)**: evaluates derivatives at four intermediate points within each timestep and combines them with weights $(1, 2, 2, 1)/6$ to achieve fourth-order accuracy ($O(\\Delta t^4)$ error per step). Significantly more accurate than Euler for the same timestep, at the cost of 4x more force evaluations per step. Used in orbital mechanics, flight simulation, and any simulation where accuracy matters more than speed. Rarely used in real-time games because the 4x evaluation cost is steep and symplectic Euler is sufficient for most rigid-body needs.",
          ],
          resources: [
            { label: "Gaffer On Games - Physics integration", url: "https://gafferongames.com/post/integration_basics/", type: "docs" },
            { label: "Randy Gaul - Game Physics tutorials", url: "https://gaul.io/", type: "docs" },
          ],
        },
        {
          title: "Impulse-based collision resolution",
          body: [
            "When two rigid bodies collide, you need to apply forces that push them apart and give each a physically correct post-collision velocity. **Impulse-based resolution** computes an instantaneous velocity change (impulse) that simultaneously satisfies the non-penetration constraint (objects should not overlap) and the restitution condition (how bouncy the collision is). The advantage over force-based resolution: it works correctly at a single timestep without requiring small sub-steps.",
            "**Collision detection gives you**: the contact point $\\mathbf{c}$, the collision normal $\\hat{\\mathbf{n}}$ (pointing from B to A), and the penetration depth $d$. **Step 1 - compute relative velocity at the contact point**: $\\mathbf{v}_{rel} = (\\mathbf{v}_A + \\boldsymbol{\\omega}_A \\times \\mathbf{r}_A) - (\\mathbf{v}_B + \\boldsymbol{\\omega}_B \\times \\mathbf{r}_B)$ where $\\mathbf{r}_A, \\mathbf{r}_B$ are vectors from each body's center of mass to the contact point. The relative velocity along the normal is $v_n = \\mathbf{v}_{rel} \\cdot \\hat{\\mathbf{n}}$.",
            "**Step 2 - compute the impulse scalar**: using the coefficient of restitution $e$ ($e=0$: perfectly inelastic, $e=1$: perfectly elastic), the impulse magnitude is $j = \\frac{-(1+e)v_n}{\\frac{1}{m_A} + \\frac{1}{m_B} + \\hat{\\mathbf{n}} \\cdot (\\mathbf{I}_A^{-1}(\\mathbf{r}_A \\times \\hat{\\mathbf{n}}) \\times \\mathbf{r}_A) + \\hat{\\mathbf{n}} \\cdot (\\mathbf{I}_B^{-1}(\\mathbf{r}_B \\times \\hat{\\mathbf{n}}) \\times \\mathbf{r}_B)}$. The denominator is the effective mass of the system along the normal direction, accounting for both linear and angular inertia. **Step 3 - apply the impulse**: $\\mathbf{v}_A += \\frac{j}{m_A}\\hat{\\mathbf{n}}$, $\\boldsymbol{\\omega}_A += \\mathbf{I}_A^{-1}(\\mathbf{r}_A \\times j\\hat{\\mathbf{n}})$, and subtract for body B.",
            "**Penetration resolution (position correction)**: after applying the velocity impulse, the bodies may still overlap (penetrating). Simply separating them by the overlap amount can cause jitter (objects bouncing erratically). The standard fix is **slop + Baumgarte stabilization**: allow a small penetration (`slop`, e.g., 1mm) before correcting; correct only the excess overlap; apply a fraction of the correction per frame (e.g., 20%). This prevents jitter at the cost of allowing some visible interpenetration on large overlaps. Modern engines (Box2D v3, Jolt) use **speculative contacts** or **sub-stepping** to avoid penetration rather than correcting after the fact.",
            "**Friction**: during a collision, friction applies an impulse tangential to the contact normal. Coulomb's friction law: the tangential impulse magnitude is at most $\\mu |j|$ where $\\mu$ is the friction coefficient. **Static friction** (object at rest) allows up to $\\mu_s |j|$; if the tangential impulse needed to prevent sliding exceeds this, the object slides and **kinetic friction** applies a tangential impulse of exactly $\\mu_k |j|$ opposing motion. In impulse resolution, clamp the tangential impulse by this cone constraint. Stacking (a box resting on another box) requires solving multiple contact points simultaneously and is where naive sequential impulse resolution can fail - the Projected Gauss-Seidel solver iterates over all contacts multiple times per step.",
          ],
          resources: [
            { label: "Real-Time Collision Detection - Ericson", url: "https://realtimecollisiondetection.net/books/rtcd/", type: "book" },
            { label: "Box2D Lite source (reference implementation)", url: "https://github.com/erincatto/box2d-lite", type: "repo", note: "Erin Catto's minimal physics engine - read this code" },
          ],
        },
        {
          title: "Convex shape collision: SAT and GJK",
          body: [
            "AABB collision handles rectangles aligned to the axes. For general convex shapes (oriented boxes, hexagons, capsules), the **Separating Axis Theorem (SAT)** is the standard narrowphase test. SAT: two convex shapes do not overlap if and only if there exists an axis (a direction) on which their projections do not overlap. The algorithm: test a finite set of candidate axes (for 2D polygons: all edge normals of both shapes); if any axis separates them, they are disjoint; if no axis separates them, they are overlapping. For 3D, also test cross products of pairs of edges.",
            "**Computing the MTV (Minimum Translation Vector)**: when shapes overlap, SAT also finds the axis of minimum overlap - the direction to push them apart by the smallest distance. This is the collision normal, and the overlap on this axis is the penetration depth. For a polygon vs polygon test: for each face normal of both shapes, project both shapes onto the normal axis, compute the overlap; track the minimum overlap and its axis. The MTV is the axis with minimum overlap, scaled by the overlap distance.",
            "**GJK (Gilbert-Johnson-Keerthi)**: a more general algorithm for convex shape collision that works by computing the Minkowski difference $A \ominus B = \\{a - b : a \\in A, b \\in B\\}$. If the Minkowski difference contains the origin, the shapes overlap. GJK finds the closest point to the origin in the Minkowski difference using an iterative simplex search, without explicitly computing the Minkowski difference (which could have O(N*M) vertices). GJK runs on any convex shapes (including circles, capsules, convex meshes) and returns the closest points and distance when shapes are separated.",
            "**EPA (Expanding Polytope Algorithm)**: when GJK determines that shapes overlap, EPA finds the penetration depth and normal. Starting from the simplex built by GJK, it iteratively expands a polytope toward the boundary of the Minkowski difference in the direction closest to the origin. EPA is the standard companion to GJK for generating contact manifolds in physics engines. Together, GJK + EPA replace SAT for general convex shapes, with SAT remaining useful for simple polygon vs polygon tests due to its simpler implementation.",
            "**Capsule collisions** are particularly common in game engines because capsules (a cylinder with hemispherical caps) are a good approximation for characters and bullets, and their collision math is simpler than arbitrary meshes. Capsule vs capsule: find the closest points between the two line segments (the capsule axes), then check if the distance between them is less than the sum of radii. Capsule vs sphere: find the closest point on the capsule's segment to the sphere center, compare distance to sum of radii. These formulas avoid SAT/GJK entirely and are much cheaper for these common cases.",
          ],
          resources: [
            { label: "dyn4j - SAT explanation (interactive diagrams)", url: "https://dyn4j.org/2010/01/sat/", type: "docs" },
            { label: "GJK - Casey Muratori (YouTube)", url: "https://www.youtube.com/watch?v=Qupqu1xe7Io", type: "video", note: "definitive intuitive explanation" },
          ],
        },
        {
          title: "Broadphase: spatial hashing, BVH, and sweep-and-prune",
          body: [
            "With N physics objects, the naive O(N^2) pair-check becomes prohibitively expensive beyond a few hundred objects. **Broadphase** is a coarse filter: it quickly identifies pairs of objects whose bounding volumes overlap (and thus might be in actual contact), discarding all non-overlapping pairs before the expensive narrowphase check. A good broadphase reduces the narrowphase candidate set from O(N^2) pairs to O(N) or O(N log N).",
            "**Uniform spatial hashing**: divide space into a fixed grid of cells. Hash each cell coordinate to an index in a hash table. For each object, compute which cells its AABB overlaps and insert it into those cells. To find collision candidates for an object: compute its cells, iterate over all objects in those cells. Pros: O(1) insertion, O(1) lookup per cell, simple implementation. Cons: cell size is a critical parameter (too large reduces efficiency, too small causes objects to span many cells), performs poorly for objects of very different sizes (a large object may span thousands of cells). Best for uniformly distributed objects of similar size - particles, bullets, grid-based levels.",
            "**Dynamic AABB tree (used by Box2D, Bullet)**: a binary tree where each leaf node holds one object's AABB and each internal node holds the union of its children's AABBs (a 'fat' AABB that grows over time). Query: traverse the tree, skip nodes whose AABB doesn't intersect the query AABB. Update: when an object moves, check if it has left its stored fat AABB; if so, remove and reinsert. The fat AABB is slightly larger than the object's true AABB so minor movements don't trigger constant reinserts. Pros: handles dynamic scenes with varying object sizes well. Cons: more complex than spatial hashing, tree can become unbalanced.",
            "**Sort and sweep (sweep and prune)**: maintain sorted lists of the minimum and maximum extents of each AABB on X, Y (and Z in 3D). Overlapping pairs on an axis are pairs whose intervals overlap. The key insight: if intervals don't overlap on ANY axis, the shapes don't collide. To find overlapping pairs: merge-sort the extents on each axis; pairs that appear in the overlap set on ALL axes are collision candidates. Incrementally maintain the sorted lists between frames (insertion sort is O(N) for nearly sorted lists). Pros: very cache-friendly, excellent for scenes where little changes between frames. Cons: sorting cost grows with randomness of motion.",
            "**Broadphase in practice**: most production physics engines combine approaches. Box2D uses a dynamic AABB tree. Bullet uses a dynamic AABB tree. Godot 4 uses Jolt, which uses a hierarchical grid. For game-specific needs: a tilemap level might use the tilemap structure as a perfect spatial index (O(1) tile lookup); a space shooter might use spatial hashing since all bullets are similar size and uniformly distributed. The broadphase is not the physics engine's hottest loop (the constraint solver usually is), so the simpler approach is often fine.",
          ],
          resources: [
            { label: "Collision Detection - dyn4j broad phase", url: "https://dyn4j.org/2010/08/collision-detection-using-a-dynamic-aabb-tree/", type: "docs" },
            { label: "Real-Time Collision Detection - spatial partitioning chapters", url: "https://realtimecollisiondetection.net/books/rtcd/", type: "book" },
          ],
        },
        {
          title: "XPBD: extended position-based dynamics for constraints",
          body: [
            "**Position-Based Dynamics (PBD)**, introduced by Muller et al. 2007, is a simulation approach where constraints are enforced by directly correcting particle positions rather than applying forces. A cloth simulation: particles connected by distance constraints (edges). Each iteration: find pairs of particles where the distance differs from the rest length; push them toward the correct distance. Repeat until constraints are (approximately) satisfied. PBD is unconditionally stable (it never explodes) and fast for large systems of particles - the reason it replaced impulse-based methods for cloth, hair, and soft bodies in most game engines.",
            "**The compliance problem with PBD**: in original PBD, the stiffness of a constraint is controlled by iterating it multiple times (more iterations = stiffer). This couples stiffness to timestep size and iteration count, making the behavior unstable to parameter changes and non-physical (stiffness is not independent of simulation frequency). Tuning PBD parameters for a specific timestep breaks when the timestep changes (e.g., physics step changes from 60Hz to 30Hz).",
            "**XPBD (Extended PBD)** by Macklin et al. 2016 fixes this by introducing an explicit **compliance** parameter $\\alpha$ (the inverse of stiffness) that is independent of timestep. The constraint update: given a constraint $C(\\mathbf{x})$ with compliance $\\alpha$, the position correction is $\\Delta \\mathbf{x} = \\frac{-C(\\mathbf{x}) - \\tilde{\\alpha}\\lambda}{\\nabla C^T M^{-1} \\nabla C + \\tilde{\\alpha}}$ where $\\tilde{\\alpha} = \\alpha / \\Delta t^2$ and $\\lambda$ is a Lagrange multiplier tracking accumulated constraint force. Physical stiffness: $k = 1/\\alpha$. This gives XPBD consistent behavior regardless of timestep, making it fully position-based but physically grounded.",
            "**Constraint types in XPBD**: distance constraint (edge length), bending constraint (dihedral angle between two triangles), volume preservation (for soft bodies), shape matching (for rigid-like behavior), and positional constraint (pin a particle to a fixed point). Unreal Engine's Chaos physics, Nvidia's Flex, and Unity's recent cloth systems all use XPBD or variants. The drag-and-drop setup: define particles, connect them with constraints specifying compliance, run XPBD iterations per physics step.",
            "**Substeps and convergence**: a single XPBD pass (one constraint iteration per substep) requires many substeps (e.g., 10-30 per frame) to converge to a tight solution - each substep runs constraint iteration in sequence. Alternatively, run multiple Gauss-Seidel iterations within a single larger substep. The substep approach is preferred for games: it is unconditionally stable, the behavior degrades gracefully as substeps decrease (constraints loosen rather than exploding), and it maps well to parallel hardware (constraints on independent particles can be solved simultaneously with graph coloring).",
          ],
          resources: [
            { label: "XPBD - Macklin et al. 2016 paper", url: "https://matthias-research.github.io/pages/publications/XPBD.pdf", type: "paper" },
            { label: "Muller - Position-Based Simulation (2024 course notes)", url: "https://matthias-research.github.io/pages/publications/PBSTutorial.pdf", type: "paper" },
          ],
        },
      ],
      resources: [
        { label: "Real-Time Collision Detection - Ericson", url: "https://realtimecollisiondetection.net/books/rtcd/", type: "book" },
        { label: "Gaffer On Games - Physics articles", url: "https://gafferongames.com/", type: "docs" },
        { label: "Box2D Lite (minimal reference engine)", url: "https://github.com/erincatto/box2d-lite", type: "repo" },
      ],
      connections: [
        { to: "dsa-complexity", note: "Broadphase selection is an algorithmic complexity tradeoff" },
        { to: "dsa-hashing", note: "Spatial hashing is a direct application of hash table design" },
        { to: "quant-options", note: "Stochastic differential equations underlie both options pricing and physics simulation" },
      ],
    },
  ],
});
