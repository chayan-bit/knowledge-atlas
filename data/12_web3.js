// Web3 & Blockchain — domain shell (meta only).
// Topics live in 12_web3_*.js, each appended via atlasAdd's merge-by-id.
// This keeps each topic a focused, deep, textbook-length file.
atlasAdd({
  id: "web3",
  num: 12,
  title: "Web3 & Blockchain",
  icon: "⛓️",
  color: "#f7931a",
  tagline: "From blockchain fundamentals to smart-contract security, DeFi internals, zkEVMs, and MEV.",
  overview: [
    "A blockchain is a beautiful composition of things you already know: cryptographic hashes + Merkle trees (crypto/DSA), a P2P gossip network (low-level/networking), a deterministic bytecode VM (compilers), and an adversarial economic game on top. Web3 is where cryptography becomes money, which makes its security stakes uniquely brutal - bugs are instantly, irreversibly exploited for millions.",
    "The arc: fundamentals + the EVM → Solidity + DeFi primitives → smart-contract security, MEV, and Layer 2 / zero-knowledge. Treat security as the through-line: learn the vuln classes, exploit them in Damn Vulnerable DeFi, and read every post-mortem on Rekt.",
    "Each topic keeps its short description, then a **Deep dive** section of expandable, textbook-length subtopics that teach the idea in full - paired with exact deep-links to the canonical reference for each. This domain is built for genuine mastery, not orientation.",
  ],
  topics: [],
});
