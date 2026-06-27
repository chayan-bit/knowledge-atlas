atlasAdd({
  id: "gamedev",
  topics: [
    {
      id: "game-gpu-api",
      title: "Custom renderer: OpenGL / Vulkan",
      level: "Advanced",
      body: [
        "**OpenGL**: VAOs, VBOs, EBOs, UBOs, framebuffers, the shader compilation pipeline. **Vulkan**: instance, physical/logical device, swapchain, command pools/buffers, render passes, pipelines, descriptor sets, synchronization (fences, semaphores, barriers). Vulkan explicitly exposes what OpenGL hides.",
        "Build a renderer from scratch in both APIs - OpenGL first for the concepts, Vulkan second for the explicit model. vkguide.dev is the best Vulkan tutorial.",
      ],
      subtopics: [
        {
          title: "OpenGL object model: VAO, VBO, EBO, and UBO",
          body: [
            "**OpenGL state machine**: OpenGL is a global state machine. All commands operate on currently-bound objects. The bind-use-unbind pattern: `glBindVertexArray(vao); glDrawArrays(...); glBindVertexArray(0)`. Modern OpenGL (DSA - Direct State Access, 4.5+) eliminates the need to bind objects before accessing them: `glNamedBufferData(vbo, ...)` instead of `glBindBuffer(GL_ARRAY_BUFFER, vbo); glBufferData(...)`. DSA is preferred in new code but all major tutorials still use the classic bind-first approach.",
            "**VBO (Vertex Buffer Object)**: a GPU-side buffer storing per-vertex data. Create: `glGenBuffers(1, &vbo); glBindBuffer(GL_ARRAY_BUFFER, vbo); glBufferData(GL_ARRAY_BUFFER, size, data, GL_STATIC_DRAW)`. The `usage` parameter hints to the driver: `STATIC_DRAW` (uploaded once, drawn many times), `DYNAMIC_DRAW` (updated occasionally), `STREAM_DRAW` (updated every frame). This affects which memory pool the driver places the buffer in (VRAM vs shared memory). For CPU-driven updates every frame, use persistent mapped buffers (`glMapBufferRange` with `MAP_PERSISTENT_BIT`).",
            "**VAO (Vertex Array Object)**: stores the association between VBO data and shader attribute locations, plus the format of each attribute. `glVertexAttribPointer(location, size, type, normalized, stride, offset)` - this call (and `glEnableVertexAttribArray`) is recorded into the currently-bound VAO. Once set up, drawing with this VAO automatically uses the correct buffer and attribute layout. You create one VAO per mesh layout (one VAO for positions+normals+UVs, a different VAO for positions+colors). **EBO (Element Buffer Object)**: stores indices that index into the VBO, enabling vertex sharing. `glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo)` inside a VAO bind records the EBO association. Draw with `glDrawElements`.",
            "**UBO (Uniform Buffer Object)**: a buffer for sharing uniform data (constants) between multiple shaders without redundant uploads. A `CameraUBO` might contain the view matrix, projection matrix, and camera position - shared by all materials in the scene. The UBO is bound to a binding point: `glUniformBlockBinding(shader, block_index, binding_point); glBindBufferBase(GL_UNIFORM_BUFFER, binding_point, ubo)`. GLSL: `layout(std140, binding = 0) uniform CameraBlock { mat4 view; mat4 projection; }`. The `std140` layout rule specifies strict padding (vec3 is padded to 16 bytes like vec4) to ensure CPU-GPU data alignment.",
            "**Framebuffer Objects (FBO)**: render to a texture instead of the default framebuffer (the screen). Use for: shadow maps, G-buffer in deferred rendering, post-processing. `glGenFramebuffers(1, &fbo); glBindFramebuffer(GL_FRAMEBUFFER, fbo)`. Attach textures: `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, tex, 0)`. Attach depth: `glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depth_tex, 0)`. Check completeness: `glCheckFramebufferStatus`. Draw into FBO, then bind the default framebuffer and render a fullscreen quad sampling the FBO's texture.",
          ],
          resources: [
            { label: "LearnOpenGL - Getting started", url: "https://learnopengl.com/Getting-started/Hello-Triangle", type: "docs" },
            { label: "OpenGL 4.6 spec - DSA section", url: "https://registry.khronos.org/OpenGL/specs/gl/glspec46.core.pdf", type: "docs" },
          ],
        },
        {
          title: "OpenGL shader pipeline and GLSL",
          body: [
            "**Shader compilation in OpenGL**: shaders are compiled at runtime from GLSL source strings. Pipeline: `glCreateShader(GL_VERTEX_SHADER)` → `glShaderSource(shader, 1, &source, NULL)` → `glCompileShader(shader)` → check `glGetShaderiv(shader, GL_COMPILE_STATUS, &status)`. Linking: `glCreateProgram()` → `glAttachShader(program, vs)` → `glAttachShader(program, fs)` → `glLinkProgram(program)` → check link status. Use the compiled program: `glUseProgram(program)`. Shader programs are cached by drivers (the first run compiles to GPU ISA; subsequent runs load from the driver's shader cache), but binary caching (`glProgramBinary`) for explicit control is important on mobile.",
            "**GLSL (OpenGL Shading Language)**: a C-like language with built-in types: `vec2`, `vec3`, `vec4` (float vectors), `mat4` (4x4 float matrix), `sampler2D` (texture sampler). Key inputs: vertex shader receives `in vec3 aPosition; in vec3 aNormal; in vec2 aTexCoord` (vertex attributes); fragment shader receives whatever the vertex shader outputs (`out` variables become `in` in the fragment stage, automatically interpolated). Output: `out vec4 FragColor` in the fragment shader (goes to the framebuffer color attachment).",
            "**Uniform variables**: `uniform mat4 uModel; uniform sampler2D uAlbedo`. Set from the CPU: `int loc = glGetUniformLocation(program, \"uModel\"); glUniformMatrix4fv(loc, 1, GL_FALSE, glm::value_ptr(model))`. Uniforms are global state per program: every draw call with this program uses the same uniform values until you change them. For data that changes per object (model matrix), set uniforms per draw call. For data shared across objects (view/projection matrices), use UBOs. Querying `glGetUniformLocation` each frame is slow - cache the locations at startup.",
            "**Textures and samplers**: create: `glGenTextures(1, &tex); glBindTexture(GL_TEXTURE_2D, tex); glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA8, w, h, 0, GL_RGBA, GL_UNSIGNED_BYTE, pixels); glGenerateMipmap(GL_TEXTURE_2D)`. Set filtering: `glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR)` - trilinear filtering (linear between mip levels + linear within a mip level). Activate a texture unit: `glActiveTexture(GL_TEXTURE0); glBindTexture(GL_TEXTURE_2D, tex); glUniform1i(location, 0)` - sets the sampler uniform to use texture unit 0. Modern hardware has at least 16 simultaneous texture units per shader stage.",
            "**Compute shaders**: a shader stage that runs outside the graphics pipeline. `glDispatchCompute(groups_x, groups_y, groups_z)` dispatches a 3D grid of workgroups; each workgroup runs on a GPU multiprocessor with shared local memory. Uses: particle systems, cloth simulation, post-processing effects (faster than fullscreen quad for heavy computation), mip generation, skinning. Synchronization with graphics pipeline: `glMemoryBarrier(GL_SHADER_IMAGE_ACCESS_BARRIER_BIT)` after a compute pass that writes images read by the vertex/fragment pipeline.",
          ],
          resources: [
            { label: "LearnOpenGL - Shaders", url: "https://learnopengl.com/Getting-started/Shaders", type: "docs" },
            { label: "The Book of Shaders - GLSL", url: "https://thebookofshaders.com/", type: "course" },
          ],
        },
        {
          title: "Vulkan fundamentals: instances, devices, and swapchains",
          body: [
            "**Vulkan's philosophy**: expose everything the driver used to hide. In OpenGL, the driver manages: command buffer recording, synchronization between CPU and GPU, memory allocation, pipeline state caching. In Vulkan, you do all of this explicitly. The reward: significantly lower CPU overhead (driver is thin), predictable performance (no driver magic), and explicit parallelism (record command buffers on multiple threads simultaneously). The cost: 10-20x more setup code for even a simple triangle.",
            "**Instance and device**: `VkInstance` is the root Vulkan object, created with a list of extensions (`VK_KHR_surface` for window integration) and validation layers (`VK_LAYER_KHRONOS_validation` for debugging). `vkEnumeratePhysicalDevices` lists GPUs. Pick the best (`VkPhysicalDevice`), query its properties, queue families, and supported features. Create a `VkDevice` (the logical device) with the chosen queue families and enabled features. The `VkDevice` is the primary object you use for everything: creating resources, allocating memory, submitting work.",
            "**Queue families**: GPUs have queues that accept different command types. **Graphics queue**: draw calls, compute, transfer. **Compute queue**: compute only (separate queue family for async compute). **Transfer queue**: DMA-optimized memory transfers. Each queue family has one or more queues. You create `VkQueue` handles from the device at specific family indices. Submitting work: `vkQueueSubmit(queue, 1, &submit_info, fence)` - submits command buffers to the GPU. Different work can be submitted to different queues and run asynchronously.",
            "**Swapchain**: the mechanism for presenting rendered frames to the window. `VkSwapchainKHR` wraps the OS window's framebuffers. Creation: choose surface format (RGBA8 sRGB), present mode (`VK_PRESENT_MODE_MAILBOX_KHR` for triple buffering, `FIFO` for vsync), and number of images (typically 2-3). Each frame: `vkAcquireNextImageKHR(device, swapchain, timeout, image_available_semaphore, NULL, &image_index)` - get the next available image index. Render into that swapchain image. `vkQueuePresentKHR(present_queue, &present_info)` - display it. The swapchain images are `VkImage` objects; render targets need a `VkImageView` wrapping them.",
            "**Memory allocation**: in OpenGL, `glBufferData` handles allocation. In Vulkan, you call `vkAllocateMemory`, pick a memory type from `vkGetPhysicalDeviceMemoryProperties` (device-local = GPU VRAM only, host-visible = CPU-mappable), and bind it to the resource: `vkBindBufferMemory(device, buffer, memory, offset)`. In practice, allocating per-resource is inefficient (driver may have a small allocation count limit). Use **VMA (Vulkan Memory Allocator)** - a library that manages suballocations from large blocks, handling alignment requirements and memory type selection automatically.",
          ],
          resources: [
            { label: "vkguide.dev - Vulkan tutorial with modern patterns", url: "https://vkguide.dev/", type: "course", note: "the best Vulkan tutorial" },
            { label: "Vulkan Tutorial (VulkanTutorial.com)", url: "https://vulkan-tutorial.com/", type: "course" },
          ],
        },
        {
          title: "Vulkan: render passes, pipelines, and descriptor sets",
          body: [
            "**Render pass**: defines the attachments (color, depth) a set of commands will read/write, and their load/store operations. `VkRenderPassCreateInfo` specifies: attachments (format, initial/final layout, load op: `CLEAR`/`LOAD`/`DONT_CARE`, store op: `STORE`/`DONT_CARE`), and subpasses (which attachments each subpass reads/writes). Subpass dependencies define synchronization between subpasses. Why explicit render passes? On mobile (tile-based) GPUs (Arm Mali, Apple, Qualcomm), the driver uses this information to keep tile data in on-chip memory between subpasses - a massive bandwidth savings. On desktop GPUs it's less critical but still used for optimization.",
            "**Pipeline state objects (PSO)**: in OpenGL, pipeline state (depth test, blend mode, shader, vertex format) is global and changed per draw call with many separate calls. In Vulkan, all state is baked into a `VkPipeline` object at creation time. A PSO encodes: vertex input format, vertex/fragment shaders (as SPIR-V bytecode), rasterization settings (polygon mode, cull mode, line width), depth/stencil settings, color blend state, and the render pass/subpass this pipeline is used with. Creating a PSO is expensive (0.1-2ms) - do it at load time, never during gameplay. **Pipeline cache** (`VkPipelineCache`): the driver stores compiled shader binaries; serialize the cache to disk to avoid re-compilation across runs.",
            "**Descriptor sets**: Vulkan's mechanism for binding resources (textures, UBOs, SSBOs) to shaders. A `VkDescriptorSetLayout` defines the binding structure: binding 0 = uniform buffer (1 item), binding 1 = combined image sampler (16 items). A `VkDescriptorPool` pre-allocates memory for N descriptor sets. Allocate a descriptor set from the pool: `vkAllocateDescriptorSets`. Write resources into it: `vkUpdateDescriptorSets(device, 1, &write, 0, NULL)`. Bind at draw time: `vkCmdBindDescriptorSets(command_buffer, VK_PIPELINE_BIND_POINT_GRAPHICS, pipeline_layout, 0, 1, &descriptor_set, 0, NULL)`. Descriptor sets can be updated between frames (for per-frame data like camera matrices) or be static (for per-material textures).",
            "**Command buffers**: all GPU work is recorded into `VkCommandBuffer` objects and then submitted to a queue. Recording: `vkBeginCommandBuffer → vkCmdBeginRenderPass → vkCmdBindPipeline → vkCmdBindDescriptorSets → vkCmdDrawIndexed → vkCmdEndRenderPass → vkEndCommandBuffer`. Command buffers can be recorded in parallel on different threads (each thread needs its own `VkCommandPool`). After recording, submit: `vkQueueSubmit`. **Primary vs secondary command buffers**: primary buffers can begin/end render passes; secondary buffers can only be called from within a render pass via `vkCmdExecuteCommands`. Secondary buffers enable: recording per-object draw calls on multiple threads, then executing them all in one primary buffer.",
          ],
          resources: [
            { label: "vkguide.dev - Chapter 2: Triangle", url: "https://vkguide.dev/docs/chapter-2/triangle_walkthrough/", type: "docs" },
            { label: "Vulkan spec - render passes", url: "https://registry.khronos.org/vulkan/specs/1.3-extensions/html/vkspec.html#renderpass", type: "docs" },
          ],
        },
        {
          title: "Vulkan synchronization: fences, semaphores, and barriers",
          body: [
            "Vulkan synchronization is the most complex and error-prone part of the API. Without it, you submit commands and hope the GPU executes them in order - sometimes it does, sometimes it doesn't, and the bugs are GPU-specific and hard to reproduce. Vulkan's explicit synchronization requires you to express every ordering dependency between GPU operations.",
            "**Fences**: CPU-GPU synchronization. A fence is signaled by the GPU when a `vkQueueSubmit` completes. The CPU waits: `vkWaitForFences(device, 1, &fence, VK_TRUE, UINT64_MAX)`. Fences are used for: waiting until a frame has finished rendering before reusing its command buffer, waiting for an upload to complete before using the resource. Never busy-wait - always use `vkWaitForFences`. Create signaled for first-frame correctness: `VkFenceCreateInfo { .flags = VK_FENCE_CREATE_SIGNALED_BIT }`.",
            "**Semaphores**: GPU-GPU synchronization between queue submissions. `image_available_semaphore` (signaled by `vkAcquireNextImageKHR`, waited on by the render submission) and `render_finished_semaphore` (signaled by the render submission, waited on by `vkQueuePresentKHR`). In `vkQueueSubmit`: `pWaitSemaphores` (semaphores to wait for before executing), `pWaitDstStageMask` (at which pipeline stage to wait), `pSignalSemaphores` (semaphores to signal when done). Timeline semaphores (`VK_KHR_timeline_semaphore`) allow CPU-side wait and signal, replacing most fence use cases with a unified model.",
            "**Pipeline barriers and image layout transitions**: GPU resources have a current **image layout** that determines how the GPU accesses them: `UNDEFINED` (initial), `COLOR_ATTACHMENT_OPTIMAL` (when used as a render target), `SHADER_READ_ONLY_OPTIMAL` (when sampled in a shader), `TRANSFER_DST_OPTIMAL` (when being written by a transfer), `PRESENT_SRC_KHR` (when handed to the swapchain for display). Transitioning between layouts requires a **pipeline barrier**: `vkCmdPipelineBarrier(cmd, src_stage, dst_stage, 0, 0, NULL, 0, NULL, 1, &image_barrier)`. The image barrier specifies: old layout, new layout, src access mask (what was the last write operation), dst access mask (what will the next read be). The barrier both transitions the layout and flushes/invalidates caches between operations.",
            "**Synchronization validation**: Vulkan validation layers (`VK_LAYER_KHRONOS_validation`) check synchronization correctness at runtime. **Vulkan Synchronization Validation** detects hazards (read-before-write, write-after-write without a barrier). Always develop with validation layers enabled - they catch 90% of synchronization bugs early. **RenderDoc**: a frame capture tool that records every Vulkan command, shows resource states at each point, and reports barriers and layout transitions. Indispensable for debugging synchronization issues and verifying that barriers are placed correctly.",
          ],
          resources: [
            { label: "Vulkan synchronization examples - KhronosGroup", url: "https://github.com/KhronosGroup/Vulkan-Docs/wiki/Synchronization-Examples", type: "docs", note: "the authoritative practical reference" },
            { label: "RenderDoc - GPU frame debugger", url: "https://renderdoc.org/", type: "tool" },
          ],
        },
      ],
      resources: [
        { label: "vkguide.dev - modern Vulkan tutorial", url: "https://vkguide.dev/", type: "course" },
        { label: "LearnOpenGL - comprehensive", url: "https://learnopengl.com/", type: "docs" },
        { label: "Vulkan Tutorial", url: "https://vulkan-tutorial.com/", type: "course" },
      ],
      connections: [
        { to: "gpu-model", note: "Vulkan's execution model maps directly to GPU SM/warp/memory hierarchy" },
        { to: "web-advanced", note: "WebGPU is Vulkan-inspired; understanding Vulkan makes WebGPU trivial" },
        { to: "ll-concurrency", note: "Vulkan synchronization primitives (fences, semaphores, barriers) parallel CPU synchronization concepts" },
      ],
    },
  ],
});
