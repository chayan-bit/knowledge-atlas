atlasAdd({
  id: "crypto",
  topics: [
    {
      id: "crypto-dh",
      title: "Diffie-Hellman & discrete log",
      level: "Intermediate",
      body: [
        "DH key exchange (`g^a`, `g^b`, shared `g^{ab}`), **ECDH** (same idea on curves — smaller keys), safe-prime/group choice (RFC 3526), and small-subgroup/twist attacks (cofactor, twist security).",
        "DH is the foundation of perfect forward secrecy in modern TLS.",
      ],
      subtopics: [
        {
          title: "The Diffie-Hellman key exchange",
          body: [
            "Before 1976, all cryptography required the communicating parties to share a secret key in advance — through a physically secure channel, a trusted courier, or some other pre-arranged mechanism. The invention of **Diffie-Hellman key exchange** by Whitfield Diffie and Martin Hellman (1976; Ralph Merkle contributed the underlying idea earlier, and the British GCHQ independently discovered it in 1969 but kept it classified) fundamentally broke this assumption. DH allows two parties who have never met and share no prior secrets to establish a shared secret key over a completely public, adversarially monitored channel.",
            "The protocol over `Z_p*`: agree on public parameters — a large prime `p` and a generator `g` of `Z_p*` (or a large prime-order subgroup). Alice generates a secret `a ←_R {2, ..., p-2}` and sends `A = g^a mod p`. Bob generates a secret `b ←_R {2, ..., p-2}` and sends `B = g^b mod p`. Alice computes `K = B^a = g^{ab} mod p`. Bob computes `K = A^b = g^{ab} mod p`. Both arrive at the same shared value `g^{ab}`, which an eavesdropper — who sees only `g^a` and `g^b` — would need to compute `g^{ab}` from, which is the **computational Diffie-Hellman (CDH) problem**: given `g^a` and `g^b`, compute `g^{ab}`. This is believed as hard as the discrete logarithm problem in the chosen group.",
            "DH is not encryption — it is **key agreement**: the output is a shared secret that both parties then use to derive symmetric encryption keys (via a KDF like HKDF). Alice and Bob cannot encrypt messages using DH directly; after the exchange, they use the derived shared secret as the key for AES-GCM or ChaCha20-Poly1305. The key agreement step is often called 'ephemeral DH' when fresh key pairs are generated for each session — as opposed to 'static DH' where long-term public keys are reused, which loses forward secrecy.",
            "DH is **unauthenticated** by default: a man-in-the-middle (MitM) who intercepts `A` and `B` can replace them with their own DH values, establishing separate shared secrets with Alice and Bob while transparently forwarding their traffic. Alice thinks she is talking to Bob; Bob thinks he is talking to Alice; the MitM reads and possibly modifies everything. The fix is to **authenticate** the DH exchange: sign the public values with a long-term key pair, embed DH in a certificate-based protocol (TLS), or use a pre-shared key (IKE PSK mode). Unauthenticated DH provides confidentiality against passive eavesdroppers only.",
            "The decisional hardness assumption, **DDH (Decisional Diffie-Hellman)**, is stronger than CDH: given a triple `(g^a, g^b, g^c)`, it is computationally infeasible to determine whether `c = ab (mod p-1)` or `c` is random. DDH implies CDH but not vice versa. Security proofs for many DH-based protocols (El Gamal encryption, DH in the random oracle model) rely on DDH. In some groups, DDH is *easier* than DLP — in particular, in bilinear-pairing groups, the Weil and Tate pairings can solve DDH, which is why pairing-based cryptography (BLS signatures, zk-SNARKS) uses specially constructed curves rather than standard DH groups.",
          ],
          resources: [
            { label: "Diffie & Hellman 1976 — New Directions in Cryptography (original paper)", url: "https://ee.stanford.edu/~hellman/publications/24.pdf", type: "paper" },
            { label: "Computerphile — Diffie-Hellman", url: "https://www.youtube.com/watch?v=Yjrfm_oRO0w", type: "video" },
          ],
        },
        {
          title: "Safe primes, group parameters, and subgroup attacks",
          body: [
            "The choice of DH group parameters `(p, g)` is not arbitrary — bad parameters completely break security. The **Pohlig-Hellman algorithm** solves DLP in `Z_p*` in time proportional to the sum of square roots of the prime factors of `p-1`. If `p-1` is a smooth number (has only small prime factors), the DLP is easy. For example, if `p-1 = 2 × 3 × 5 × 7 × ... × k` for small primes up to k, Pohlig-Hellman runs in time roughly `O(√k)` — polynomial in the largest factor, not in the group size. This makes the choice of `p` critical.",
            "A **safe prime** is a prime `p` such that `(p-1)/2 = q` is also prime (`q` is a Sophie Germain prime). The factorization of `p-1 = 2q` means Pohlig-Hellman only reduces the DLP to two subproblems — mod 2 (trivial) and mod q (still hard, since q is as large as q). Working in the **prime-order subgroup** of order q (the quadratic residues mod p) restricts the DLP to `Z_p*`'s order-q subgroup, making Pohlig-Hellman completely ineffective. **RFC 3526** and **RFC 7919** standardize specific DH groups with safe prime parameters: the 2048-bit 'modp group 14' (`p` is a specific 2048-bit safe prime), the 3072-bit group 15, etc. These are widely deployed in IKE/IPsec and TLS.",
            "**Small-subgroup attacks** exploit the fact that the DH group `Z_p*` contains many subgroups — one of order `d` for each divisor `d` of `p-1`. If a party is not careful to validate the received DH public value, an attacker can send a point of small order `h` (i.e., `h^d ≡ 1 mod p` for small `d`). When Alice computes `h^a mod p`, the result cycles through only `d` possible values regardless of `a`, leaking `a mod d`. Across several such exchanges with different small-order values, the attacker reconstructs `a` via CRT. Defense: validate that the received value `h` satisfies `h ≠ 0, 1, p-1` and either check `h^q ≡ 1 mod p` (verifying it is in the safe prime's order-q subgroup) or use the cofactor by computing `h^{(p-1)/q} mod p` to clear the cofactor before using the shared value.",
            "The **Logjam attack** (2015, Adrian et al.) demonstrated a devastating form of downgrade attack on TLS DH: TLS servers that offered `DHE_EXPORT` cipher suites used 512-bit 'export' DH groups (weakened by 1990s US export regulations, but still supported). A man-in-the-middle could downgrade any DHE connection to use 512-bit DH, then precompute the NFS discrete log for the small number of commonly used 512-bit primes in advance (only a handful of groups were widely deployed — the shared-prime structure made the precomputation amortizable). The attack broke live TLS sessions in real time. The lesson: deploy only standardized, large (≥2048 bit) DH groups, and disable export/legacy cipher suites completely.",
            "**ECDH** (Elliptic Curve Diffie-Hellman) is the modern standard. It applies the same DH protocol but in the group of points on an elliptic curve over a finite field, where no sub-exponential algorithm is known. Curve25519 — designed by Daniel J. Bernstein specifically for high-security, constant-time ECDH — uses a 255-bit prime and the Montgomery-form curve `y^2 = x^3 + 486662x^2 + x`, giving ~128-bit security with only 32-byte keys. Key benefits over finite-field DH: smaller keys (32 bytes vs 256 bytes for 128-bit security), faster computation, and a design that avoids many implementation pitfalls (constant-time scalar multiplication, twist-safe group, cofactor handling built in). X25519 (the ECDH function on Curve25519) is the dominant key exchange in modern TLS 1.3.",
          ],
          resources: [
            { label: "RFC 3526 — More Modular Exponential DH Groups (safe prime parameters)", url: "https://datatracker.ietf.org/doc/html/rfc3526", type: "docs" },
            { label: "Logjam Attack paper (2015) — imperfect forward secrecy and small subgroups", url: "https://weakdh.org/imperfect-forward-secrecy-ccs15.pdf", type: "paper" },
          ],
        },
        {
          title: "Forward secrecy and the ephemeral DH design",
          body: [
            "**Forward secrecy** (or **perfect forward secrecy, PFS**) is the property that compromise of a long-term private key does not compromise past session keys. Without forward secrecy: an adversary who records encrypted TLS traffic today can retroactively decrypt it if they later obtain the server's private key (e.g. through a legal process, a breach, or a bug like Heartbleed). This 'store now, decrypt later' threat model is particularly relevant for surveillance and post-breach analysis.",
            "Forward secrecy is achieved by using **ephemeral DH** (ECDHE or DHE): instead of encrypting the session key with the server's long-term RSA public key (which is stored permanently and could be compromised later), the server generates a fresh DH key pair for each session, performs the DH exchange to derive a session key, and then *discards the ephemeral private key*. The session key is derived only from the ephemeral values — which are never stored and cannot be recovered even if the long-term key is later compromised. An adversary with the recorded traffic and the server's long-term key can authenticate the server (the certificate signature is still valid) but cannot reconstruct the ephemeral `a` or `b` values, so `g^{ab}` remains unknown.",
            "TLS 1.3 **mandates** forward secrecy for all connections: only ECDHE (or DHE) cipher suites are permitted, and the older RSA key transport mode (where the client encrypted the pre-master secret with the server's RSA key) is completely removed. This is a significant security improvement: TLS 1.2 connections without DHE or ECDHE are retroactively decryptable by anyone who later obtains the server's certificate private key. TLS 1.3 connections are not.",
            "The forward secrecy property has a precise quantification: it holds for the time window during which ephemeral private keys are not in memory. If an attacker compromises a running server (e.g. via a memory dump), they get the ephemeral key for *current* sessions but not past ones (once the session is over and the key is gone from RAM). This is why some implementations use periodic key rotation even within long-lived connections (TLS key update message), and why ephemeral keys should be securely erased from memory as soon as the key derivation is complete — not left in swap or core dumps.",
            "The trade-off of ephemeral DH over static RSA key transport is computational: generating a fresh DH key pair and computing the exchange costs more CPU than encrypting a small session key with a static RSA public key. For high-throughput servers, this was historically a concern, but modern ECDHE (especially X25519) is fast enough to be negligible — the TLS 1.3 handshake with X25519 takes microseconds on modern hardware. The security benefit (forward secrecy protecting all past sessions) is worth this cost, which is why TLS 1.3 made ECDHE the only option.",
          ],
          resources: [
            { label: "TLS 1.3 (RFC 8446) — key exchange and forward secrecy (section 4.2.7)", url: "https://datatracker.ietf.org/doc/html/rfc8446#section-4.2.7", type: "docs" },
            { label: "Curve25519 — Daniel J. Bernstein (original paper)", url: "https://cr.yp.to/ecdh/curve25519-20060209.pdf", type: "paper" },
          ],
        },
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
  ],
});
