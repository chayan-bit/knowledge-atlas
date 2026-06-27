atlasAdd({
  id: "gamedev",
  topics: [
    {
      id: "game-math",
      title: "Game math: vectors, transforms, curves",
      level: "Intermediate",
      body: [
        "**Vectors** (dot/cross products), atan2 for angles, lerp/slerp/Bezier for smooth motion, and coordinate transforms (local to world space). The geometry that makes everything render correctly and move naturally.",
        "Understand why quaternions avoid gimbal lock before you need to fix it in production.",
      ],
      subtopics: [
        {
          title: "Vectors and the dot/cross product in game contexts",
          body: [
            "A **vector** in game math is a directed quantity with magnitude and direction, typically `(x, y)` in 2D or `(x, y, z)` in 3D. Positions, velocities, forces, normals, and directions are all vectors. The fundamental operations - addition, scalar multiplication, normalization - are everywhere in game code. **Normalization**: dividing by magnitude to get a unit vector (`|v| = 1`). A direction vector should almost always be normalized before use; failure to normalize is a common source of bugs where effect strength varies with distance to a target.",
            "**The dot product** $\\mathbf{a} \\cdot \\mathbf{b} = |a||b|\\cos\\theta$ has two key game uses: (1) **angle measurement** - if both vectors are normalized, the dot product is exactly $\\cos\\theta$, giving the cosine of the angle between them without calling `acos`. For a simple field-of-view check (`is the enemy in front of me?`), compare the dot product to a threshold: `dot(forward, to_enemy) > cos(fov/2)`. (2) **projection** - `dot(a, b_hat)` gives the scalar length of `a` projected onto the direction `b_hat`. Used for shadow computation, separating velocity into normal/tangential components during collision.",
            "**The cross product** in 3D: $\\mathbf{a} \\times \\mathbf{b} = (a_y b_z - a_z b_y, a_z b_x - a_x b_z, a_x b_y - a_y b_x)$. The result is a vector perpendicular to both inputs, with magnitude $|a||b|\\sin\\theta$. Uses: computing surface normals for lighting (cross two edge vectors of a triangle to get the normal), determining turn direction (the sign of the Z component of the 2D cross product - `a.x*b.y - a.y*b.x` - tells you whether `b` is to the left or right of `a`), and angular velocity in physics. The 2D cross product is indispensable for winding-order tests and signed area calculations.",
            "**`atan2(y, x)`** is the correct function for computing angles from direction vectors. `atan(y/x)` fails when `x = 0` (division by zero) and returns angles only in the range $(-\\pi/2, \\pi/2)$. `atan2` handles all quadrants, returns $(-\\pi, \\pi]$, and never divides by zero. Converting a normalized direction vector `(dx, dy)` to an angle: `angle = atan2(dy, dx)`. Converting back: `(cos(angle), sin(angle))`. Used for: aiming a turret at the player, computing the angle between two objects, rotating a sprite to face a direction.",
            "**Reflection and refraction vectors** use dot products: the reflection of vector `d` off a surface with normal `n` (where `n` is unit length) is `r = d - 2*(dot(d, n))*n`. This is physically correct for mirrors, specular highlights, and ricocheting projectiles. For perfect collision reflection, set `velocity = reflect(velocity, collision_normal)` multiplied by a restitution coefficient. These formulas appear directly in shaders for lighting calculations and in physics engines for elastic collision response.",
          ],
          resources: [
            { label: "3Blue1Brown - Essence of Linear Algebra (YouTube)", url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab", type: "video", note: "build geometric intuition first" },
            { label: "Immersive Math - interactive linear algebra", url: "https://immersivemath.com/ila/index.html", type: "course" },
          ],
        },
        {
          title: "Matrices, transforms, and the MVP pipeline",
          body: [
            "Every object in a 3D scene lives in its own **local space** (its coordinates relative to itself). Placing it in the world requires the **model matrix** (a 4x4 affine transform): a combination of translation, rotation, and scale. Multiplying a vertex by the model matrix moves it from local space to **world space**. The **view matrix** is the inverse of the camera's model matrix: it moves everything in the world so that the camera is at the origin, looking down -Z. The **projection matrix** transforms the frustum (camera's visible volume) into NDC (Normalized Device Coordinates, the $[-1,1]^3$ cube). The GPU processes all three in sequence: `gl_Position = projection * view * model * vertex_position`.",
            "**4x4 homogeneous matrices** enable all three transforms (translation, rotation, scale) in a single matrix multiply. The trick: represent a 3D point as `(x, y, z, 1)` (w=1 for points) and a direction vector as `(x, y, z, 0)` (w=0 for vectors, so translation has no effect on directions). The translation component lives in the last column. This unified representation lets you compose a sequence of transforms into a single matrix by multiplying them - the concatenated matrix is applied in one GPU multiply per vertex rather than N separate operations.",
            "**Transform hierarchies**: in a game, a character's hand is attached to the forearm, which is attached to the upper arm, which is attached to the torso. Each bone has a local transform relative to its parent. The world-space transform of the hand is the product of all transforms up the chain: `world_hand = world_torso * local_upperarm * local_forearm * local_hand`. This **scene graph** structure means animating the torso automatically moves all attached children. Engines compute the final bone matrices (used to skin the mesh) by traversing the hierarchy once per frame.",
            "**TRS decomposition**: a transform matrix is often decomposed into Translation, Rotation (as a quaternion or Euler angles), and Scale components for serialization, interpolation, and editing. Re-composing: `M = T * R * S`. Order matters - this reads right to left: first scale, then rotate, then translate. Scaling before rotation gives different results than rotating before scaling (non-uniform scaling applied after rotation produces shear). Most game engines store transforms as TRS internally and only compute the matrix when the GPU needs it.",
            "**Normal matrix**: when you transform a mesh by a non-uniform scale, the surface normals (used for lighting) do not transform the same way as vertex positions. The correct transform for normals is the **inverse transpose** of the model matrix: `normal_matrix = transpose(inverse(model))`. For uniform scale or pure rotation, the inverse transpose equals the original matrix, so this simplification is often taken. Failing to use the correct normal transform produces incorrect lighting on scaled objects - the normals point in the wrong direction and lighting looks wrong.",
          ],
          resources: [
            { label: "LearnOpenGL - Transformations", url: "https://learnopengl.com/Getting-started/Transformations", type: "docs" },
            { label: "Scratchapixel - The MVP matrix (free)", url: "https://www.scratchapixel.com/lessons/3d-basic-rendering/perspective-and-orthographic-projection-matrix/opengl-perspective-projection-matrix.html", type: "docs" },
          ],
        },
        {
          title: "Quaternions and rotation representation",
          body: [
            "**Euler angles** (pitch, yaw, roll) represent rotation as three sequential rotations around the X, Y, Z axes. They are intuitive but have a critical failure mode: **gimbal lock**, which occurs when two rotation axes align, causing the loss of one degree of freedom. If pitch reaches 90 degrees, yaw and roll become indistinguishable - you can no longer rotate in one direction. Gimbal lock plagues any animation system that stores rotations as Euler angles and interpolates between them.",
            "**Quaternions** are the standard rotation representation in game engines. A quaternion $q = (w, x, y, z) = w + xi + yj + zk$ where $i^2 = j^2 = k^2 = ijk = -1$. A rotation by angle $\\theta$ around unit axis $(a_x, a_y, a_z)$ is $q = (\\cos(\\theta/2), a_x\\sin(\\theta/2), a_y\\sin(\\theta/2), a_z\\sin(\\theta/2))$. Key properties: unit quaternions form a group under multiplication (composition of rotations is just multiplication), they have no gimbal lock, and they interpolate smoothly. The cost: unintuitive values (you cannot directly understand what `(0.707, 0, 0.707, 0)` means).",
            "**SLERP (Spherical Linear Interpolation)**: interpolating between two rotations $q_1$ and $q_2$ by fraction $t$: $\\text{slerp}(q_1, q_2, t) = q_1 (q_1^{-1} q_2)^t$. This traces the shortest great-circle arc on the unit 4-sphere between the two rotations, giving constant angular velocity throughout the interpolation. LERP on Euler angles takes a different (and usually wrong) path. The double-cover problem: $q$ and $-q$ represent the same rotation (antipodal points on the 4-sphere), so you must ensure you interpolate in the shorter direction by checking `dot(q1, q2) < 0` and negating `q2` if so.",
            "**Rotation matrices from quaternions**: to convert quaternion `(w, x, y, z)` to a 3x3 rotation matrix (cheaper than building it from scratch with sin/cos): row 0 = $(1-2y^2-2z^2, 2xy-2wz, 2xz+2wy)$, row 1 = $(2xy+2wz, 1-2x^2-2z^2, 2yz-2wx)$, row 2 = $(2xz-2wy, 2yz+2wx, 1-2x^2-2y^2)$. This is fast (no transcendental functions) and numerically stable as long as the quaternion is normalized. Renormalizing periodically (`q = q / |q|`) prevents drift from accumulating floating-point errors over many composited rotations.",
            "**Practical use in engines**: Unity stores rotations as quaternions internally; the inspector shows Euler angles as a convenience but converts to/from quaternions on access. Unreal uses FRotator (Euler) for editing and FQuat for computation. Godot 4 uses `Quaternion` and `Basis` (rotation matrix). When you need to rotate incrementally every frame (e.g., a spinning top), the correct approach is `q *= delta_rotation` where `delta_rotation` is a small quaternion - not adding to Euler angles, which compounds gimbal-lock risk and inconsistent interpolation.",
          ],
          resources: [
            { label: "3Blue1Brown - Quaternions and 3D rotation (YouTube)", url: "https://www.youtube.com/watch?v=zjMuIxRvygQ", type: "video" },
            { label: "Visualizing quaternions - eater.net interactive", url: "https://eater.net/quaternions", type: "tool" },
          ],
        },
        {
          title: "Interpolation: lerp, slerp, splines, and easing",
          body: [
            "**Linear interpolation (lerp)** $\\text{lerp}(a, b, t) = a + t(b-a) = (1-t)a + tb$ is the simplest animation primitive: at $t=0$ you get $a$, at $t=1$ you get $b$, and in between you get a proportional blend. Used for: camera smoothing, UI transitions, color blending, fading audio volume. Lerp on scalars, vectors, and colors is constant speed - the rate of change is uniform. For most visual transitions, constant speed feels mechanical; **easing functions** add acceleration and deceleration.",
            "**Easing functions** transform the linear $t \\in [0,1]$ into a non-linear curve. Ease-in: slow start, fast end. Ease-out: fast start, slow end. Ease-in-out: slow at both ends, fast in the middle. The standard cubic ease-in-out: $f(t) = 3t^2 - 2t^3$ (smoothstep). For more control, the **Robert Penner easing equations** define a library of named curves (elastic, bounce, back) by mapping $t$ through different mathematical formulas. Most game engines and animation systems include these curves as parameters on animation tracks.",
            "**Bezier curves**: a parametric curve defined by control points. The quadratic Bezier has 3 points $P_0, P_1, P_2$: $B(t) = (1-t)^2 P_0 + 2(1-t)t P_1 + t^2 P_2$. The cubic has 4: $B(t) = (1-t)^3 P_0 + 3(1-t)^2 t P_1 + 3(1-t)t^2 P_2 + t^3 P_3$. The curve passes through the endpoints and is attracted toward (but does not pass through) the middle control points. Beziers are used for: movement paths (waypoint curves), UI animation curves (CSS `cubic-bezier`), font outlines, particle trajectories. The De Casteljau algorithm evaluates them recursively without computing the full polynomial.",
            "**Catmull-Rom splines** are a preferred choice for game paths because they automatically pass through all control points (unlike Bezier, where middle points are off-curve). Given 4 points $P_{i-1}, P_i, P_{i+1}, P_{i+2}$, the Catmull-Rom segment between $P_i$ and $P_{i+1}$ uses the neighboring points to compute tangents automatically. This makes it easy for designers to place waypoints and have the path flow smoothly through all of them. The tension parameter (default 0.5, giving Catmull-Rom) controls how tight the curve is at each point. Setting all $P_{i-1} = P_i$ at endpoints avoids the need for ghost points.",
            "**Hermite splines and animation curves**: animation systems represent keyframe data as Hermite splines - curves defined by position and tangent at each keyframe. The animator controls the in/out tangents to produce the desired acceleration profile. Hermite basis functions: $H_0(t) = 2t^3 - 3t^2 + 1$, $H_1(t) = t^3 - 2t^2 + t$, $H_2(t) = -2t^3 + 3t^2$, $H_3(t) = t^3 - t^2$. The interpolated value: $p(t) = H_0 p_0 + H_1 m_0 + H_2 p_1 + H_3 m_1$ where $m_0, m_1$ are the tangents at the endpoints. This is what Unreal's `UCurveFloat` and Unity's `AnimationCurve` implement.",
          ],
          resources: [
            { label: "Freya Holmer - Math for Game Devs (YouTube)", url: "https://www.youtube.com/watch?v=MOYiVLEnhrw", type: "video", note: "excellent visual explanations" },
            { label: "Easing functions cheatsheet - easings.net", url: "https://easings.net/", type: "tool" },
          ],
        },
        {
          title: "Raycasting and spatial queries",
          body: [
            "**Raycasting** is the operation of casting a ray (origin + direction) into the scene and finding what it hits first. It is fundamental to: mouse picking (converting a screen-space click to a 3D ray and finding the object under the cursor), line-of-sight tests (can the enemy see the player?), bullet physics (a hitscan weapon traces a ray), and the classic ray-cast 2.5D rendering of Wolfenstein-style games.",
            "**Ray-AABB intersection (slab method)**: for a ray $R(t) = O + tD$ and AABB defined by $[\\min, \\max]$ on each axis, compute the intersection interval for each axis independently: $t_{\\min,x} = (\\min_x - O_x) / D_x$, $t_{\\max,x} = (\\max_x - O_x) / D_x$ (swap if $D_x < 0$). The ray intersects the AABB if $\\max(t_{\\min,x}, t_{\\min,y}, t_{\\min,z}) \\leq \\min(t_{\\max,x}, t_{\\max,y}, t_{\\max,z})$ and the interval has positive overlap with $[0, \\infty)$. This is an O(1) test with no branches on the intersection logic (only for swapping min/max on negative direction components).",
            "**Ray-triangle intersection (Moller-Trumbore)**: for ray $R(t) = O + tD$ and triangle vertices $V_0, V_1, V_2$. Compute edges $E_1 = V_1 - V_0$, $E_2 = V_2 - V_0$, then $h = D \\times E_2$, $a = E_1 \\cdot h$ (dot product). If $a$ near zero, ray is parallel. $f = 1/a$, $s = O - V_0$, $u = f(s \\cdot h)$ - if $u < 0$ or $u > 1$, no intersection. $q = s \\times E_1$, $v = f(D \\cdot q)$ - if $v < 0$ or $u+v > 1$, no intersection. $t = f(E_2 \\cdot q)$ - hit at $R(t)$ if $t > 0$. This is the algorithm used inside GPU BVH traversal for ray tracing.",
            "**BVH (Bounding Volume Hierarchy)** for scene-wide ray queries: rather than testing the ray against every triangle (O(N)), build a binary tree where each node's bounding box encloses all geometry in its subtree. Traversal: test the ray against a node's bounding box; if miss, skip the whole subtree; if hit, recurse into children. The expected complexity is $O(\\log N)$ for well-built BVHs. BVH build quality matters enormously: a poorly split BVH (e.g., naive midpoint split) degrades toward O(N). The **SAH (Surface Area Heuristic)** chooses splits that minimize expected ray-traversal cost.",
            "**Physics-engine queries**: modern physics libraries (Bullet, PhysX, Godot's Jolt integration) expose spatial query APIs beyond single raycasts: **sphere cast** (sweep a sphere along a ray - finds objects that a sphere of given radius would hit), **shape cast** (arbitrary convex shape sweep), **overlap test** (all objects overlapping a region), and **proximity query** (all objects within a distance of a point). These are used for: melee attack range checks (sphere overlap), third-person camera obstacle avoidance (sphere cast from character to camera), and AI line-of-sight with body width (capsule cast).",
          ],
          resources: [
            { label: "Red Blob Games - Raycast tutorials", url: "https://www.redblobgames.com/pathfinding/", type: "tool" },
            { label: "Real-Time Collision Detection - Ericson (ray/AABB chapter)", url: "https://realtimecollisiondetection.net/books/rtcd/", type: "book" },
          ],
        },
      ],
      resources: [
        { label: "3Blue1Brown - Essence of Linear Algebra", url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab", type: "video" },
        { label: "Immersive Math - free interactive textbook", url: "https://immersivemath.com/ila/index.html", type: "course" },
        { label: "Freya Holmer - Math for Game Devs", url: "https://www.youtube.com/watch?v=MOYiVLEnhrw", type: "video" },
      ],
      connections: [
        { to: "ai-math", note: "Linear algebra, matrix ops, and probability are shared foundations" },
        { to: "game-rendering", note: "MVP matrix pipeline applies everything from this topic" },
      ],
    },
  ],
});
