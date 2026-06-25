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
  topics: [
    {
      id: "crypto-symmetric",
      title: "Symmetric crypto, hashing & MACs",
      level: "Beginner",
      body: [
        "**Kerckhoffs's principle**, AES as a substitution-permutation network, **block-cipher modes** (ECB's penguin failure, CBC + padding oracles, CTR, **GCM/AEAD**), hash functions (SHA-256 Merkle-Damgård, SHA-3 Keccak sponge, BLAKE3) and their three resistance properties, **MACs** (HMAC — why not `H(key‖msg)` due to length extension), and password hashing (bcrypt/scrypt/**Argon2id**).",
        "Cryptopals Sets 1-2 — implement these *and* break them — is the fastest route to real understanding.",
      ],
      resources: [
        { label: "Cryptopals Challenges (free)", url: "https://cryptopals.com/", type: "practice", note: "learn by breaking real crypto" },
        { label: "Dan Boneh — Crypto I (Stanford/Coursera)", url: "https://www.coursera.org/learn/crypto", type: "course" },
        { label: "Serious Cryptography — Aumasson (book)", url: "https://nostarch.com/seriouscrypto", type: "book" },
      ],
      connections: [
        { to: "dsa-hashing", note: "Cryptographic hashes add collision-resistance to the hashing you met in DSA" },
        { to: "web3-fundamentals", note: "Keccak-256 and Merkle trees are the hashing core of blockchains" },
        { to: "cyber-foundations", note: "AEAD and HMAC are what TLS uses to protect traffic" },
      ],
    },
    {
      id: "crypto-numbertheory",
      title: "Number theory foundations",
      level: "Intermediate",
      body: [
        "Modular arithmetic, Fermat's little theorem and Euler's theorem, the **extended Euclidean algorithm** (modular inverses), the **CRT** (RSA speedup), quadratic residues (Legendre symbol), and the **discrete logarithm problem** — the hardness assumption underpinning DH and ECC.",
        "This is the math that makes public-key crypto possible; the same rigor (derive, don't memorize) as the ML math foundations.",
      ],
      resources: [
        { label: "An Introduction to Mathematical Cryptography — Hoffstein et al.", url: "https://link.springer.com/book/10.1007/978-1-4939-1711-2", type: "book" },
        { label: "A Graduate Course in Applied Cryptography — Boneh & Shoup (free)", url: "https://toc.cryptobook.us/", type: "book" },
      ],
      connections: [
        { to: "ai-math", note: "Same 'prove it from the axioms' rigor as ML's math foundations" },
        { to: "crypto-rsa", note: "Euler's theorem is exactly why RSA decryption works" },
      ],
    },
    {
      id: "crypto-rsa",
      title: "RSA",
      level: "Intermediate",
      body: [
        "Key generation (`n=pq`, `φ(n)`, `d=e⁻¹ mod φ(n)`), why it works (Euler's theorem), the **attack catalog** (small-`e` cube root, unpadded homomorphism, common modulus, **Bleichenbacher's** PKCS#1v1.5 padding oracle), correct usage (**OAEP** for encryption, **PSS** for signatures), and timing side-channels + blinding.",
        "RSA is the cleanest case study in 'the textbook scheme is broken; padding is the real cryptosystem.'",
      ],
      resources: [
        { label: "Cryptopals — RSA sets (3-6)", url: "https://cryptopals.com/sets/5", type: "practice" },
        { label: "RSA attacks survey — Boneh (Twenty Years of Attacks)", url: "https://crypto.stanford.edu/~dabo/abstracts/RSAattack-survey.html", type: "paper" },
      ],
      connections: [
        { to: "crypto-numbertheory", note: "RSA is Euler's theorem + CRT made into a cryptosystem" },
        { to: "crypto-pqc", note: "Shor's algorithm breaks RSA — the motivation for post-quantum crypto" },
        { to: "cyber-web", note: "Padding-oracle attacks (Bleichenbacher) recur in TLS/web exploits" },
      ],
    },
    {
      id: "crypto-dh",
      title: "Diffie-Hellman & discrete log",
      level: "Intermediate",
      body: [
        "DH key exchange (`g^a`, `g^b`, shared `g^{ab}`), **ECDH** (same idea on curves — smaller keys), safe-prime/group choice (RFC 3526), and small-subgroup/twist attacks (cofactor, twist security).",
        "DH is the foundation of perfect forward secrecy in modern TLS.",
      ],
      resources: [
        { label: "Boneh — Crypto I (DH module)", url: "https://www.coursera.org/learn/crypto", type: "course" },
        { label: "Computerphile — Diffie-Hellman", url: "https://www.youtube.com/watch?v=Yjrfm_oRO0w", type: "video" },
      ],
      connections: [
        { to: "crypto-ecc", note: "ECDH applies DH on elliptic-curve groups for smaller keys" },
        { to: "crypto-tls", note: "Ephemeral (EC)DHE gives TLS forward secrecy" },
      ],
    },
    {
      id: "crypto-ecc",
      title: "Elliptic curve cryptography",
      level: "Intermediate → Advanced",
      body: [
        "EC over finite fields (point addition/doubling, the group law), scalar multiplication (double-and-add, why ECDLP is hard), curve parameters, and the practical curves: P-256 (NIST), **secp256k1** (Bitcoin/Ethereum), and **Curve25519** (Montgomery form, twist-safe, constant-time by design).",
        "secp256k1 is exactly the curve every blockchain signature uses — this topic is the hinge between crypto and web3.",
      ],
      resources: [
        { label: "A (Relatively Easy to Understand) Primer on ECC — Cloudflare", url: "https://blog.cloudflare.com/a-relatively-easy-to-understand-primer-on-elliptic-curve-cryptography/", type: "docs" },
        { label: "Andrea Corbellini — ECC series", url: "https://andrea.corbellini.name/2015/05/17/elliptic-curve-cryptography-a-gentle-introduction/", type: "docs" },
      ],
      connections: [
        { to: "web3-evm", note: "secp256k1 ECDSA signs every Ethereum/Bitcoin transaction" },
        { to: "crypto-signatures", note: "Curves are the substrate for ECDSA and EdDSA" },
      ],
    },
    {
      id: "crypto-signatures",
      title: "Digital signatures",
      level: "Advanced",
      body: [
        "RSA-PSS, **ECDSA** (and the **nonce-reuse catastrophe** — reuse `k` and the private key falls out, the PS3 hack; plus biased-nonce lattice attacks), **EdDSA/Ed25519** (deterministic nonce eliminates the problem), and blind signatures.",
        "ECDSA nonce handling is one of the highest-stakes implementation details in all of crypto.",
      ],
      resources: [
        { label: "Cryptopals — break ECDSA with repeated nonce", url: "https://cryptopals.com/sets/8", type: "practice" },
        { label: "EdDSA / Ed25519 — RFC 8032", url: "https://datatracker.ietf.org/doc/html/rfc8032", type: "docs" },
      ],
      connections: [
        { to: "crypto-ecc", note: "ECDSA/EdDSA are built on the elliptic-curve group operations" },
        { to: "web3-security", note: "Signature replay & malleability are real smart-contract vulnerabilities" },
      ],
    },
    {
      id: "crypto-tls",
      title: "Key exchange & TLS 1.3",
      level: "Advanced",
      body: [
        "The **TLS 1.3** handshake (ClientHello→ServerHello→Cert→Finished), ephemeral **(EC)DHE** for forward secrecy, **HKDF** (extract/expand), and certificate chains (root→intermediate→leaf, X.509).",
        "TLS is where every primitive above composes into the protocol that secures the internet.",
      ],
      resources: [
        { label: "TLS 1.3 — RFC 8446", url: "https://datatracker.ietf.org/doc/html/rfc8446", type: "docs" },
        { label: "The Illustrated TLS 1.3 Connection", url: "https://tls13.xargs.org/", type: "tool", note: "byte-by-byte walkthrough" },
      ],
      connections: [
        { to: "cyber-foundations", note: "This is the protocol behind the TLS handshakes you dissect in security" },
        { to: "emb-safety", note: "Secure boot / signed firmware reuse certificate chains and signatures" },
      ],
    },
    {
      id: "crypto-zk",
      title: "Zero-knowledge proofs",
      level: "Advanced → Research",
      body: [
        "Interactive proofs (completeness/soundness/zero-knowledge), **Sigma protocols** (Schnorr), commitments (Pedersen), the **Fiat-Shamir** transform (interactive→non-interactive), **zkSNARKs** (arithmetic circuits → R1CS → QAP → Groth16/PLONK), **zkSTARKs** (transparent, hash-based, quantum-resistant), and proof recursion (Nova folding).",
        "ZK is the hottest area at the crypto↔web3 boundary — write a circuit in circom/halo2 to make it real.",
      ],
      resources: [
        { label: "ZK-Learning — MOOC (Stanford/Berkeley/CMU, free)", url: "https://zk-learning.org/", type: "course" },
        { label: "Vitalik — zkSNARKs explainer series", url: "https://vitalik.eth.limo/general/2021/01/26/snarks.html", type: "docs" },
        { label: "Moon Math Manual (free, math for ZK)", url: "https://github.com/LeastAuthority/moonmath-manual", type: "book" },
      ],
      connections: [
        { to: "web3-zk", note: "On-chain verifiers, zkrollups and Circom circuits apply ZK to blockchains" },
        { to: "comp-llvm", note: "Circom/Noir compile high-level circuits to constraint systems like compilers" },
        { to: "dsa-paradigms", note: "QAP/FFT-based proving leans on polynomial algorithms from DSA" },
      ],
    },
    {
      id: "crypto-pqc",
      title: "Post-quantum cryptography",
      level: "Advanced → Research",
      body: [
        "Why (Shor breaks RSA/ECC), the NIST standards: **ML-KEM (Kyber)**, **ML-DSA (Dilithium)**, **SLH-DSA (SPHINCS+)**, and **lattice cryptography** (SVP/CVP/**LWE**, Ring-LWE, NTRU). Plus code-based (McEliece) and hash-based signatures (XMSS/LMS).",
        "Lattices are the new workhorse assumption — and they connect straight back to computational geometry (LLL/BKZ reduction).",
      ],
      resources: [
        { label: "NIST — Post-Quantum Cryptography project", url: "https://csrc.nist.gov/projects/post-quantum-cryptography", type: "docs" },
        { label: "Lattice-based crypto — A Decade of Lattice Crypto (Peikert, PDF)", url: "https://web.eecs.umich.edu/~cpeikert/pubs/lattice-survey.pdf", type: "paper" },
      ],
      connections: [
        { to: "dsa-complexity", note: "SVP/CVP and LLL/BKZ reduction are lattice/computational-geometry problems" },
        { to: "crypto-rsa", note: "PQC exists because Shor's algorithm breaks RSA/ECC" },
      ],
    },
    {
      id: "crypto-mpc",
      title: "Threshold, MPC & FHE",
      level: "Research",
      body: [
        "**Shamir's Secret Sharing** (polynomial interpolation, (t,n)-threshold), **threshold signatures** (FROST, GG18/20), **multi-party computation** (Yao's garbled circuits, SPDZ + Beaver triples, ORAM), and **homomorphic encryption** (Paillier additive; FHE: BFV/BGV/CKKS/TFHE) — computing on encrypted data, at a 10⁶-10⁹× cost.",
        "These power private ML inference, MPC wallets, and on-chain FHE — the privacy frontier.",
      ],
      resources: [
        { label: "A Pragmatic Introduction to Secure MPC (free)", url: "https://securecomputation.org/", type: "book" },
        { label: "FHE.org — resources & community", url: "https://fhe.org/resources/", type: "docs" },
      ],
      connections: [
        { to: "web3-zk", note: "Threshold sigs and on-chain FHE (fhEVM) extend privacy to blockchains" },
        { to: "ai-mlops", note: "FHE enables private ML inference on encrypted inputs" },
      ],
    },
  ],
});
