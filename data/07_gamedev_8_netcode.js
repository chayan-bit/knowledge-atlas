atlasAdd({
  id: "gamedev",
  topics: [
    {
      id: "game-netcode",
      title: "Netcode for multiplayer",
      level: "Advanced",
      body: [
        "**Deterministic lockstep** (strategy games), **client-server + client-side prediction + reconciliation** (shooters), **entity interpolation** (smooth remote player movement), **lag compensation** (rewind server state at time of shot), and **UDP vs TCP** tradeoffs for real-time games.",
        "Gaffer On Games is required reading. Understand why latency is the fundamental enemy before trying to hide it.",
      ],
      subtopics: [
        {
          title: "Network fundamentals for games: latency, UDP vs TCP",
          body: [
            "**Latency** is the fundamental problem of multiplayer games. A network round-trip between two players (input sent to server, state update received back) takes 20-200ms depending on distance and ISP routing. At 60fps, 100ms of latency is 6 frames behind reality - a character's movement responds to input that happened 6 frames ago. Every netcode technique is a strategy for hiding or compensating for this latency without making the game feel unresponsive or unfair.",
            "**Bandwidth and packet loss**: a game sending state updates to 32 players at 60Hz generates significant traffic. State compression is critical: instead of sending full world state, send only deltas (what changed since the last acked packet). Packet loss is inevitable on the public internet (typically 1-3% on WiFi, 0.1% on Ethernet). Unlike HTTP (which retransmits lost packets), game netcode must handle loss gracefully: the next packet contains enough information to recover, or the game interpolates across the gap.",
            "**TCP vs UDP**: TCP provides reliable, ordered delivery - lost packets are retransmitted before later packets are delivered. For real-time games, TCP's retransmission mechanism is fatal: if a position update packet is lost, TCP blocks all subsequent packets until the retransmit arrives - causing a stall that manifests as a freeze spike. **UDP**: unreliable, unordered delivery. No retransmission, no head-of-line blocking. Games can receive later state updates even if earlier ones are lost - they just interpolate over the gap. Almost all multiplayer games use UDP (or QUIC, which provides selective reliability over UDP). The exception: turn-based games, lobby messages, and reliable events (chat) may use TCP or reliable UDP channels.",
            "**Building reliability over UDP**: game netcode implements its own lightweight reliability layer: sequence numbers (detect out-of-order packets), acknowledgment bits (know which packets the remote side received), round-trip estimation (measure RTT from send time to ack arrival), and selective retransmission (resend unacked reliable messages after a timeout). This gives the game precise control: unreliable channels for position updates (lose it, it doesn't matter, the next one arrives), reliable channels for game events (death, score, item pickup) that must not be lost.",
            "**DTLS and encryption**: raw UDP has no security. Game servers must prevent packet injection and cheating. DTLS (Datagram TLS) provides encryption and authentication for UDP, preventing packet forgery. WebRTC uses DTLS mandatorily. For game-specific needs, custom lightweight encryption (XOR cipher with per-session keys) is common - not cryptographically strong but sufficient to prevent casual packet injection. Valve's Steam Networking Sockets provides encrypted UDP with the convenience of TCP-like reliability.",
          ],
          resources: [
            { label: "Gaffer On Games - Networking for game programmers", url: "https://gafferongames.com/categories/game-networking/", type: "docs", note: "read every article" },
            { label: "Valve - Source multiplayer networking", url: "https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking", type: "docs" },
          ],
        },
        {
          title: "Deterministic lockstep for strategy games",
          body: [
            "**Deterministic lockstep** is the oldest and most bandwidth-efficient multiplayer architecture. The premise: if all players start with the same game state and execute the same sequence of inputs in the same order, they will always end up with the same game state. Therefore, you only need to synchronize **inputs**, not state. Bandwidth: sending only the inputs of all N players (a few bytes per player per frame) instead of full game state (kilobytes). Used by: Age of Empires, Starcraft, Street Fighter, Rocket League (uses a hybrid lockstep/state-sync).",
            "**The lockstep protocol**: each game frame, every client sends its inputs for that frame to all other clients (via a relay server or peer-to-peer). Players hold their simulation at frame F until they have received inputs from all players for frame F. Once all inputs are received, all clients advance simultaneously. The delay this introduces: `input_delay` (typically 2-7 frames, ~33-117ms at 60fps) is added to every player to give inputs time to arrive. Higher latency between players requires higher input delay, which makes the game feel sluggish.",
            "**Determinism requirements**: for lockstep to work, simulation must be **bit-identical** across all machines. This is extraordinarily difficult in practice. Sources of non-determinism: floating-point arithmetic (results can differ between CPU architectures, compilers, and optimization levels due to FMA instructions, extended precision x87 registers, and denormal handling). Solutions: use **fixed-point arithmetic** (integers representing fractional values - used by StarCraft, Age of Empires); mandate `SSE2`-only math with `MXCSR` register set to consistent rounding mode; use a deterministic physics library (Godot provides deterministic fixed-point physics options). Even `std::unordered_map` iteration order can vary between platforms.",
            "**Rollback netcode** (GGPO, used by fighting games): instead of waiting for inputs, simulate ahead with predicted inputs (assume each player continues their last action). When the real input arrives and differs from the prediction, **roll back** to the last known-good state and resimulate from there. Players never see input delay in favorable conditions - the game feels as responsive as single-player. The cost: rollback requires saving/loading complete game state (state serialization) and resimulating up to N frames (where N is the rollback window, typically 7-10 frames). This is O(N) physics simulation per frame when rollback occurs. Games like Street Fighter V, Guilty Gear Strive, and Brawlhalla use GGPO or GGPO-inspired rollback.",
            "**Desync detection**: even with careful determinism, desyncs can occur (bugs in code, platform differences). Lockstep games implement **checksum verification**: every N frames (e.g., every 30 frames), hash the game state and broadcast the hash to all players. If any player's hash differs, a desync is detected. On desync: log the frame, upload state, and kick the player (or resync from server state). StarCraft's famous desync bugs were caught exactly this way.",
          ],
          resources: [
            { label: "GGPO - rollback netcode library", url: "https://github.com/pond3r/ggpo", type: "repo" },
            { label: "Gaffer On Games - What is rollback?", url: "https://gafferongames.com/post/what_every_programmer_needs_to_know_about_game_networking/", type: "docs" },
          ],
        },
        {
          title: "Client-server: authority, prediction, and reconciliation",
          body: [
            "**Client-server architecture** separates game clients from a dedicated server that is the **authority** on all game state. Clients send inputs to the server; the server simulates the game and sends authoritative state back to all clients. No client can cheat by modifying their own simulation - the server discards any simulation the client has done and sends the true state. Used by: all modern first-person shooters, battle royales, competitive online games.",
            "**The input latency problem**: without prediction, a player pressing 'W' sends the input to the server (50ms RTT), the server simulates the movement, and sends the new position back (another 50ms RTT). The player sees their character respond 100ms later - clearly unacceptable. **Client-side prediction**: the client simulates its own inputs immediately (without waiting for server confirmation). The player sees instant response. The server also simulates the inputs; when the authoritative state arrives, the client compares it to its predicted state.",
            "**Server reconciliation**: when the server's authoritative position differs from the client's predicted position (due to the server having other inputs the client didn't know about, or the server running at a different rate), the client must **reconcile**. The naive approach (snap to server position) causes visible jitter. The correct approach: the client maintains a history of its recent inputs with timestamps. When an authoritative state arrives (tagged with the server tick it corresponds to), roll back to that state, replay all unacknowledged inputs, and produce a corrected current state. Interpolate smoothly to the corrected position if the error is small; snap for large errors.",
            "**Entity interpolation** for other players: player A's position is updated at the server's tick rate (20-30Hz). Without smoothing, remote players appear to teleport between positions. Entity interpolation maintains a small **jitter buffer** (100-200ms of historical states) and renders remote entities at a point in the past, interpolating between the two most recent received states. This produces smooth movement at the cost of 100-200ms of additional latency for the remote player's visual position. The delay is acceptable because you're not controlling those entities.",
            "**Input prediction for remote players**: instead of interpolating historical states (which requires a jitter buffer delay), predict where the remote player will be based on their last known velocity and position. **Dead reckoning**: `predicted_position = last_known_position + velocity * elapsed_time`. Corrects with a smooth snap when a new authoritative position arrives. Better for fast-moving objects (vehicles, projectiles) where interpolation introduces too much delay. Many games use both: interpolation for nearby players (smoother but delayed) and dead reckoning for distant players or vehicles.",
          ],
          resources: [
            { label: "Gaffer On Games - Snapshot interpolation", url: "https://gafferongames.com/post/snapshot_interpolation/", type: "docs" },
            { label: "Valve - Source multiplayer prediction", url: "https://developer.valvesoftware.com/wiki/Prediction", type: "docs" },
          ],
        },
        {
          title: "Lag compensation: rewinding the server clock",
          body: [
            "**The fairness problem in shooters**: player A (50ms latency) aims at player B and fires. Due to entity interpolation, player A sees player B's position as it was 100ms ago. Player A aims at the interpolated position and fires. The server, when it processes the shot (50ms after player A fired it), sees player B's current position (100ms ahead of what player A aimed at). The shot misses even though the client-side visuals showed a hit. This is unfair to player A.",
            "**Lag compensation** solves this by **rewinding the server state** to the moment the player fired. The server stores a history of all player positions for the last N seconds. When a hit-scan shot is processed: (1) determine when the client fired (current server time minus the client's latency); (2) rewind all other players' positions to that point in time; (3) perform the shot detection against the rewound state; (4) if it hits, apply the hit. The client's shot registers as a hit if the client aimed correctly at the time of firing, even though the server processes it later.",
            "**The tradeoffs of lag compensation**: rewinding the server state is 'fair' to the shooter but potentially 'unfair' to the victim. Player B may have already moved behind cover by the time the shot is processed on the server, but lag compensation rewinds their position to before they moved - they still get hit. This 'getting shot around corners' complaint is inherent to lag compensation and is accepted as the lesser evil compared to the shooter never being able to hit anything. Countermeasures: cap the rewind window (only compensate up to N ms), apply partial rewind (favor defender in ambiguous cases).",
            "**Anti-cheat implications**: lag compensation creates a constraint on server-side validation. A hack that sends forged fire packets with manipulated timestamps could trigger lag compensation to rewind to an arbitrary time. The server must validate: the claimed fire time is within the player's actual RTT window (not farther back than possible), the shot direction is plausible given the player's recent positions, and the claimed hit is physically possible from the claimed fire position.",
            "**Server tick rate vs client frame rate**: the server processes game logic at a fixed tick rate (typically 20-128Hz for competitive games). Higher tick rate: more accurate simulation, more precise collision detection, better lag compensation (more history granularity), but higher server cost. Counter-Strike 2 uses 128Hz server tickrate for competitive. Valorant uses 128Hz. Most battle royales use 30Hz (less critical because the game is slower-paced and fights are at longer ranges). The client renders at a higher frame rate than the server tick rate - the visual frames between server ticks are interpolated.",
          ],
          resources: [
            { label: "Valve - Latency compensating methods (GoldSrc/Source)", url: "https://developer.valvesoftware.com/wiki/Latency_Compensating_Methods_in_Client/Server_In-game_Protocol_Design_and_Optimization", type: "docs", note: "the seminal paper on lag compensation" },
            { label: "Gaffer On Games - Networked physics", url: "https://gafferongames.com/post/networked_physics_in_virtual_reality/", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "Gaffer On Games - Game networking", url: "https://gafferongames.com/categories/game-networking/", type: "docs" },
        { label: "Valve - Source multiplayer networking wiki", url: "https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking", type: "docs" },
      ],
      connections: [
        { to: "ll-network", note: "UDP socket programming, epoll/io_uring, and kernel bypass are the transport implementation layer" },
        { to: "web-systemdesign", note: "Game servers are distributed systems with the same CAP/consistency tradeoffs" },
      ],
    },
  ],
});
