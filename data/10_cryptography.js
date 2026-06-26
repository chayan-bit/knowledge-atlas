// Cryptography — domain shell (meta only).
// Topics live in 10_crypto_*.js, each appended via atlasAdd's merge-by-id.
// This keeps each topic a focused, deep, textbook-length file.
atlasAdd({
  id: "crypto",
  num: 10,
  title: "Cryptography",
  icon: "🔐",
  color: "#c0caf5",
  tagline: "From symmetric ciphers to zkSNARKs, post-quantum lattices, and protocol verification.",
  overview: [
    "Cryptography is where pure mathematics becomes a security guarantee — number theory, algebra, and probability turned into primitives you must use *exactly* right or not at all. The discipline's hardest lesson is humility: never roll your own, and understand the attacks before you trust the construction.",
    "Learn it by breaking it (Cryptopals) and by deriving it (Boneh). The arc runs symmetric → public-key (RSA/DH/ECC) → signatures/TLS → the research frontier of zero-knowledge proofs, post-quantum lattices, and MPC/FHE. It's the mathematical engine underneath both cybersecurity and web3.",
  ],
  topics: [],
});
