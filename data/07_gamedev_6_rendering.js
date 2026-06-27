atlasAdd({
  id: "gamedev",
  topics: [
    {
      id: "game-rendering",
      title: "3D rendering pipeline & PBR",
      level: "Advanced",
      body: [
        "The **3D rendering pipeline**: 4x4 MVP transforms, frustum culling, deferred rendering (G-buffer), shadow mapping (PCF/cascaded), PBR (Cook-Torrance BRDF, metallic/roughness model), SSAO, SSR, TAA, HDR/tonemapping with ACES, and bloom.",
        "Read PBRT cover to cover - it makes everything else click. LearnOpenGL fills in the real-time implementation details.",
      ],
      subtopics: [
        {
          title: "The 3D rendering pipeline: from vertices to pixels",
          body: [
            "The **rendering pipeline** is the fixed sequence of transformations that takes 3D geometry and produces 2D pixels on screen. The GPU implements this pipeline: vertex shader (per-vertex transforms) → primitive assembly (group vertices into triangles) → rasterization (fill triangles with pixels) → fragment shader (compute each pixel's color) → output merge (depth test, blending, write to framebuffer). Understanding this pipeline at each stage is essential for writing shaders, debugging rendering artifacts, and performance optimization.",
            "**Vertex shader**: runs once per input vertex. Receives: position in object space, normal, UV coordinates, tangent. Outputs: `gl_Position` in clip space (`gl_Position = projection * view * model * vec4(position, 1.0)`), plus any data to interpolate to fragments (normals in world space, UVs, world-space position for lighting). The vertex shader is where the MVP transform lives - the model matrix positions the object, the view matrix positions the camera, the projection matrix creates the perspective effect.",
            "**Rasterization**: converts continuous triangles to discrete pixels. For each triangle, the GPU computes which screen pixels fall inside it using edge equations. For each covered pixel, it interpolates vertex attributes (UV coordinates, normals, colors) using **barycentric coordinates** - the weights $(u, v, w)$ such that $u + v + w = 1$ and the point is $u A + v B + w C$ (the triangle vertices). **Perspective-correct interpolation**: because the rasterizer interpolates in screen space (post-projection), UVs must be divided by $w$ (the homogeneous coordinate) before interpolation and multiplied by $w$ in the fragment shader - otherwise textures warp on tilted surfaces.",
            "**Fragment shader (pixel shader)**: runs once per rasterized pixel. Receives interpolated attributes. Outputs: a color (RGBA) that goes through blending. This is where all lighting calculations happen: sample the albedo texture, sample the normal map (transform from tangent space to world space using the TBN matrix), compute the BRDF with the light direction and view direction, add shadows. The fragment shader is typically the most expensive stage per frame - optimizing it (fewer texture samples, cheaper math, fewer instructions) is the main GPU optimization target.",
            "**Depth buffer and the depth test**: the GPU maintains a depth buffer (z-buffer) - one float per pixel representing the closest geometry so far. Before writing a fragment's color to the framebuffer, the depth test compares the fragment's depth to the current depth buffer value. If the fragment is farther away (higher depth), it is discarded - the closer object is already drawn there. If it is closer, it writes its color and updates the depth buffer. Depth testing eliminates the need to sort geometry back-to-front (the painter's algorithm) for opaque objects. Transparent objects still need sorting, because depth testing does not blend - it either discards or writes.",
          ],
          resources: [
            { label: "LearnOpenGL - pipeline overview", url: "https://learnopengl.com/Getting-started/Hello-Triangle", type: "docs" },
            { label: "Scratchapixel - Rasterization: a practical implementation", url: "https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/rasterization-stage.html", type: "docs" },
          ],
        },
        {
          title: "Deferred rendering and the G-buffer",
          body: [
            "**Forward rendering**: the traditional pipeline. For each mesh, for each light affecting it, run the fragment shader with that light's contribution and accumulate. With N meshes and M lights, forward rendering does O(N*M) lighting computations - shading pixels that will be overdrawn (by closer objects drawn later) wastes work. **Forward+ (tiled forward)** reduces this: divide the screen into tiles, determine which lights affect each tile, run the fragment shader only for lights in that tile. Better for many small lights, but still does overdraw.",
            "**Deferred rendering** solves overdraw by separating geometry and lighting into two passes. **Pass 1 (geometry pass)**: render all opaque geometry but instead of computing lighting, write geometry attributes to a set of textures (the **G-buffer**): world-space position (or reconstruct from depth), world-space normal, albedo (base color), material properties (metallic, roughness, ambient occlusion). The depth test discards overdrawn fragments, so only the geometry visible in the final image is written to the G-buffer - no wasted shading work.",
            "**G-buffer layout**: typical layout using 4 textures: (1) `gPosition` (RGB32F): world-space position of the surface visible at this pixel. Can be reconstructed from depth + camera inverse projection - saves bandwidth by not storing a position texture. (2) `gNormal` (RGB16F): world-space normal vector. (3) `gAlbedoSpec` (RGBA8): RGB = albedo color, A = specular intensity. (4) `gMaterial` (RGBA8): R = metallic, G = roughness, B = AO (ambient occlusion), A = emissive. The depth buffer from the geometry pass doubles as the scene depth.",
            "**Pass 2 (lighting pass)**: render a fullscreen quad (one triangle covering the screen). The fragment shader reads from all G-buffer textures for the current pixel's screen position, reconstructs the surface properties, and computes the full lighting (sum over all lights). With N lights, you can either run the light loop in one shader, or (for many lights) render one additive pass per light (each pass reads the G-buffer, computes that light's contribution, adds to the accumulation buffer). Deferred's cost: O(M) shading per visible pixel, not O(N*M) total. The trade-off: G-buffer memory bandwidth and no native MSAA (anti-aliasing must be done as a post-process, e.g., FXAA, SMAA).",
            "**Hybrid deferred**: modern renderers use a hybrid approach. Opaque geometry: deferred (efficient with many lights). Transparent geometry: forward (transparency requires alpha blending which deferred cannot handle). Decals, particles, UI: forward. The engine switches rendering modes per-material. Unreal Engine uses a deferred renderer with selective forward passes for translucency. The G-buffer is also the source for post-process effects: SSAO reads normals and depth, SSR reads position and normals, motion vectors (stored in G-buffer) are used for TAA.",
          ],
          resources: [
            { label: "LearnOpenGL - Deferred Shading", url: "https://learnopengl.com/Advanced-Lighting/Deferred-Shading", type: "docs" },
            { label: "Aras P. - Deferred shading in Unity", url: "https://aras-p.info/texts/CompactNormalStorage.html", type: "docs" },
          ],
        },
        {
          title: "Physically Based Rendering: Cook-Torrance BRDF",
          body: [
            "**PBR (Physically Based Rendering)** uses physically correct light-matter interaction models. The key insight: real-world material appearance is determined by how surfaces reflect, absorb, and scatter light. PBR materials are characterized by artist-authored **albedo** (base color), **metallic** (0 = dielectric, 1 = metal), and **roughness** (0 = mirror-like, 1 = diffuse-like). This parameterization is intuitive and artist-friendly while being physically grounded.",
            "**The rendering equation** (Kajiya 1986): $L_o(\\mathbf{p}, \\omega_o) = L_e + \\int_{\\Omega} f_r(\\mathbf{p}, \\omega_i, \\omega_o) L_i(\\mathbf{p}, \\omega_i) (\\omega_i \\cdot \\mathbf{n}) \\, d\\omega_i$. $L_o$ is the outgoing radiance at point $\\mathbf{p}$ in direction $\\omega_o$. $L_e$ is emitted radiance. The integral is over all incoming light directions $\\omega_i$ in the hemisphere above the surface. $f_r$ is the BRDF (bidirectional reflectance distribution function): how much light from direction $\\omega_i$ is reflected toward $\\omega_o$. $(\\omega_i \\cdot \\mathbf{n})$ is the cosine term (Lambert's law: light at grazing angles contributes less).",
            "**The Cook-Torrance BRDF**: $f_r = \\frac{k_d}{\\pi} f_{lambert} + \\frac{D \\cdot G \\cdot F}{4(\\omega_o \\cdot \\mathbf{n})(\\omega_i \\cdot \\mathbf{n})}$. **D (Normal Distribution Function)**: models the statistical distribution of microfacet normals; most common is GGX/Trowbridge-Reitz: $D_{GGX}(\\mathbf{h}, \\alpha) = \\frac{\\alpha^2}{\\pi((\\mathbf{n}\\cdot\\mathbf{h})^2(\\alpha^2-1)+1)^2}$ where $\\mathbf{h}$ is the half-vector and $\\alpha$ is roughness squared. **G (Geometry function)**: models microfacet self-shadowing and masking; Smith-GGX is standard. **F (Fresnel term)**: models how reflectivity increases at grazing angles; Schlick approximation: $F_0 + (1-F_0)(1-\\cos\\theta)^5$ where $F_0$ is the surface reflectance at normal incidence (derived from metallic/albedo).",
            "**IBL (Image-Based Lighting)**: for environment lighting (light coming from a surrounding panorama, e.g., an HDRI sky image), evaluating the rendering equation integral directly is too expensive. PBR uses precomputed IBL: (1) **Diffuse irradiance map**: convolve the environment map with a hemisphere to get the average incoming diffuse light from each direction - sample this map using the surface normal. (2) **Specular radiance map**: convolve the environment map multiple times with increasing roughness (each level = one roughness value) stored in mip levels of a cubemap. (3) **BRDF LUT**: a 2D texture (NdotV, roughness) storing the precomputed split-sum approximation. Combine all three for full IBL in a single shader with three texture lookups.",
            "**Shadow mapping** for direct lights: render the scene from the light's point of view into a depth texture (the shadow map). In the lighting pass, transform the fragment's world position into the light's clip space; if the stored shadow map depth at that UV coordinate is less than the fragment's depth, the fragment is in shadow. **PCF (Percentage Closer Filtering)**: instead of a hard binary shadow test, sample the shadow map at multiple nearby locations and average the results - this softens shadow edges. **Cascaded Shadow Maps (CSM)**: use multiple shadow maps at increasing distances from the camera, with higher resolution for nearby shadows and lower for distant ones. Unreal/Unity/Godot all use CSM.",
          ],
          resources: [
            { label: "LearnOpenGL - PBR Theory", url: "https://learnopengl.com/PBR/Theory", type: "docs", note: "essential reading" },
            { label: "PBRT - Physically Based Rendering Book (free online)", url: "https://pbr-book.org/", type: "book" },
          ],
        },
        {
          title: "Post-processing: SSAO, SSR, TAA, bloom, and tonemapping",
          body: [
            "**Post-processing** transforms the rendered image after the main lighting pass, adding effects that are impractical to compute per-object. These run as fullscreen fragment shaders reading from the G-buffer, the depth buffer, or the accumulated HDR color buffer.",
            "**SSAO (Screen-Space Ambient Occlusion)**: ambient occlusion approximates how much ambient light reaches a surface point - corners and crevices receive less light. SSAO computes this from screen-space data: for each pixel, sample N random points in a hemisphere around the surface normal (in view space), check if each sample is occluded by geometry (compare depth). The fraction of occluded samples is the AO factor. Output: a grayscale AO texture, blurred to reduce noise (bilateral blur preserving edges). Multiplied into the ambient lighting term. HBAO+ and GTAO are higher-quality variants.",
            "**SSR (Screen-Space Reflections)**: glossy reflections from nearby geometry without the cost of ray tracing. For each pixel with roughness below a threshold, march a ray along the reflected direction through screen space: at each step, compare the ray's depth to the depth buffer. When the ray's depth exceeds the stored depth, a reflection hit is found; sample the color buffer at that UV. Limitations: cannot reflect geometry outside the screen (edge artifacts), degrades at high roughness (use IBL for rough reflections), cannot reflect back-facing surfaces. TAA integration is critical - raw SSR is very noisy.",
            "**TAA (Temporal Anti-Aliasing)**: accumulates the current frame with previous frames by reprojecting each pixel using a motion vector (which pixel in the previous frame corresponds to this pixel's world-space position). The accumulated result is blurry but anti-aliased. The critical challenge: **ghosting** - if a fast-moving object's motion vector is incorrect, the accumulated sample comes from the wrong place in the previous frame, leaving a ghost trail. Ghosting is reduced by: clamping the history sample to the color neighborhood of the current frame (reject samples that differ too much), using faster accumulation for moving objects, and using better motion vectors (separate motion vectors for skinned meshes and particles).",
            "**HDR tonemapping**: the rendered scene has values that far exceed the [0,1] display range (a sun is 10,000x brighter than a shaded surface). HDR rendering accumulates these large values throughout the pipeline; tonemapping compresses the HDR value to the [0,1] SDR range before display. The **ACES (Academy Color Encoding System) filmic tonemapper** is the industry standard for game rendering, producing the characteristic film-like roll-off in highlights without harsh clipping. ACES: $\\frac{x(ax+b)}{x(cx+d)+e}$ with specific constants for the filmic curve. Bloom adds light bleed from bright regions: threshold the bright pixels, blur with a Gaussian, add to the tonemapped output. Bloom must happen before tonemapping (in HDR space) to be physically correct.",
          ],
          resources: [
            { label: "LearnOpenGL - SSAO", url: "https://learnopengl.com/Advanced-Lighting/SSAO", type: "docs" },
            { label: "Karis - High Quality Temporal Supersampling (Epic GDC 2014)", url: "https://de45xmedrsdbp.cloudfront.net/Resources/files/TemporalAA_small-59732822.pdf", type: "paper" },
          ],
        },
      ],
      resources: [
        { label: "LearnOpenGL - comprehensive free tutorial", url: "https://learnopengl.com/", type: "docs" },
        { label: "PBRT - Physically Based Rendering (free online)", url: "https://pbr-book.org/", type: "book" },
        { label: "The Book of Shaders - interactive GLSL tutorial", url: "https://thebookofshaders.com/", type: "course" },
      ],
      connections: [
        { to: "gpu-model", note: "The GPU execution model (warps, occupancy) directly explains shader performance characteristics" },
        { to: "game-math", note: "MVP matrices, quaternions, and dot/cross products are applied throughout this pipeline" },
        { to: "ll-microarch", note: "Cache behavior and SIMD utilization in vertex/fragment shaders map directly to CPU microarch concepts" },
      ],
    },
  ],
});
