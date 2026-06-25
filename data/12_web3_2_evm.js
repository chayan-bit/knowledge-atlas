atlasAdd({
  id: "web3",
  topics: [
    {
      id: "web3-evm",
      title: "Ethereum & the EVM",
      level: "Beginner → Intermediate",
      body: [
        "The previous topic ended at 'a transaction is included in a block'. This one picks up there and goes inside the machine. Ethereum is best understood as a **deterministic world computer**: a single global state, advanced by transactions, where the rules of advancement are executed by the **Ethereum Virtual Machine (EVM)**. Every node runs the same EVM on the same transactions and must arrive at the same new state - that determinism is what makes consensus over computation possible.",
        "We will build the full picture: the two account types, how a transaction is signed and travels through its lifecycle, how **gas** prices computation and how EIP-1559 sets fees, the EVM's three-region execution architecture (stack/memory/storage), how raw **opcodes** and bytecode actually run, and how the **Merkle-Patricia Trie** commits the whole world state to a single root. By the end you should be able to read a contract's bytecode on evm.codes and explain what every gas charge is for.",
      ],
      subtopics: [
        {
          title: "Accounts: EOA vs contract",
          body: [
            "Ethereum's state is one mapping from 20-byte address → account, and there are exactly two kinds of account, distinguished only by whether they have code. An **Externally Owned Account (EOA)** is controlled by a private key: it has a balance and a nonce but no code and no storage. A **contract account** has code (`codeHash`) and persistent storage (`storageRoot`) but no private key - it cannot initiate anything on its own; it only runs when something calls it.",
            "Every account, of either type, stores exactly four fields. The **nonce** is a counter: for an EOA it is the number of transactions it has sent (incremented each time), and for a contract it is the number of contracts it has created. The **balance** is the account's ether holdings, denominated in **wei** (1 ETH = 10¹⁸ wei - always reason in wei to avoid rounding bugs). The **storageRoot** is the Merkle-Patricia root of the contract's storage trie (empty for an EOA). The **codeHash** is the hash of the account's EVM bytecode (the hash of empty code marks an EOA; this is how the protocol tells the two apart).",
            "The nonce does two jobs worth dwelling on. First, **replay protection**: because each transaction must carry the sender's current nonce and the protocol rejects a nonce it has already seen, you cannot rebroadcast someone's old signed transaction to repeat it. Second, **strict ordering**: transactions from one account execute in nonce order, so a transaction with nonce 5 will not be included until the nonce-4 transaction has been. This is why a single stuck (underpriced) transaction can block every later transaction from the same account - a common operational gotcha - and why deterministic contract addresses for plain `CREATE` are derived from `(deployer, nonce)`.",
            "The single most important structural fact: **contracts cannot act autonomously**. There is no cron, no background thread, no self-firing code on Ethereum. *Nothing happens without an EOA-signed transaction at the root of the call tree.* An EOA's transaction can call a contract, which can call another contract, which can call ten more - an arbitrarily deep call tree - but the spark that ignites any execution is always an externally signed transaction. This is why protocols that need 'do X when condition Y holds' (liquidations, limit orders, scheduled rebases) depend on **keeper bots** - off-chain agents that watch for the condition and send the triggering transaction (often incentivized by a reward). It is also part of the motivation for account abstraction, which lets the *account* carry richer logic even though the trigger is still external.",
          ],
          resources: [
            { label: "Ethereum.org — accounts (EOA vs contract, the four fields)", url: "https://ethereum.org/en/developers/docs/accounts/", type: "docs" },
          ],
        },
        {
          title: "The transaction: structure, signing, lifecycle",
          body: [
            "A transaction is a single signed message that is the *only* way to change Ethereum's state. Its core fields are: `nonce` (sender's ordering counter), `to` (recipient address, or empty for contract creation), `value` (wei to transfer), `data` (arbitrary calldata - the payload), `gasLimit` (max gas you authorize), and the fee fields (`maxFeePerGas`, `maxPriorityFeePerGas` post-EIP-1559). There is no explicit 'from' field - and that absence is the whole point of the next paragraph.",
            "Transactions are signed with **ECDSA over the secp256k1 curve** - the same curve and signature scheme Bitcoin uses. You hash the transaction's fields, sign that hash with your private key, and attach the signature as `(v, r, s)`. The sender address is then *recovered* from the signature via `ecrecover` rather than asserted: given the message hash and `(v, r, s)`, the curve math reproduces the signer's public key, from which the address is derived. The implication is strong - you cannot forge a 'from' without the private key, and the protocol does not need to store who signed; it derives it. (The `v` value also encodes the chain id since EIP-155, which prevents replaying a mainnet transaction on another chain.)",
            "The **lifecycle**, step by step: (1) you construct and sign the transaction locally (in a wallet); (2) you broadcast it to a node, which validates it - signature recovers to an account with sufficient balance to cover `value + gasLimit × maxFeePerGas`, and the nonce is the account's next expected nonce; (3) the node adds it to its **mempool** and gossips it to peers; (4) the current slot's **proposer** (or, in practice, a block **builder** - see MEV) selects transactions, almost always prioritizing higher fees, and chooses their *order*; (5) the EVM executes them sequentially against the current state, producing a new state root and a **receipt** per transaction (status, gas used, logs); (6) the block is proposed, attested, and eventually **finalized**, at which point the state change is irreversible.",
            "The `data` field is where the richness lives, and learning to read it is a genuine skill. For a plain ETH transfer between EOAs, `data` is empty. For a contract call, `data` is the ABI encoding: the first 4 bytes are the **function selector** (the first 4 bytes of `keccak256(\"transfer(address,uint256)\")`), followed by the 32-byte-padded arguments. For a contract *creation*, `to` is empty and `data` is the contract's init bytecode. On a block explorer, decoding the input data of any transaction shows you precisely which function was called with which arguments - the fastest way to understand what a transaction *did* rather than what its sender claims.",
            "One more subtlety: a transaction either fully succeeds or fully **reverts** (all-or-nothing within the EVM), but a *reverted* transaction is still included in a block and still costs gas for the work performed before the revert. 'Included' is not 'succeeded' - always check the receipt's status. This atomicity is also what makes flash loans and complex multi-step DeFi safe to attempt: if any step fails, the whole thing unwinds.",
          ],
          resources: [
            { label: "Ethereum.org — transactions (fields, signing, lifecycle)", url: "https://ethereum.org/en/developers/docs/transactions/", type: "docs" },
          ],
        },
        {
          title: "Gas: metering computation",
          body: [
            "Because the EVM is Turing-complete and every node must execute every transaction, an unmetered loop could halt the entire network (the halting problem made economic). **Gas** is the solution: every operation costs a fixed amount of gas reflecting its computational, bandwidth, and (especially) state-storage burden, and you must pay for what you use. Gas decouples the *amount* of work (measured in gas units, a protocol constant per opcode) from the *price* of work (gas price in ETH, set by the market).",
            "A rough cost ladder builds intuition: an arithmetic op like `ADD` costs 3 gas; a memory expansion is cheap but grows quadratically; reading storage (`SLOAD`) costs ~2,100 gas cold / 100 warm; *writing* a storage slot from zero to nonzero (`SSTORE`) costs 20,000 gas; deploying contract code costs 200 gas per byte; the base cost of any transaction is 21,000 gas. The dominance of storage costs - storage is 3-4 orders of magnitude more expensive than arithmetic - is the single most important fact for gas optimization, and it is *because* storage is permanent global state that every node must keep forever.",
            "You set a **gasLimit** (the maximum gas you authorize) and the EVM meters execution against it. If execution finishes under the limit, you pay only for what was used and the rest is not charged. If execution *hits* the limit mid-way, the EVM throws **out-of-gas**, reverts all state changes - but you still pay for all the gas consumed up to that point. This 'revert but still pay' rule is the anti-DoS mechanism: an attacker cannot make nodes do unbounded free work, because work always costs gas whether or not it ultimately succeeds.",
            "Estimating gasLimit matters in practice. Wallets simulate the transaction to estimate gas, but state can change between estimation and execution (e.g. a branch that writes a fresh storage slot now versus an already-set one), so a too-tight limit causes out-of-gas reverts and a too-loose one risks more cost only if the work actually runs. Understanding that gas equals 'units of metered work' (and that storage writes dominate) is what lets you reason about why one transaction costs $2 and another costs $200.",
          ],
          resources: [
            { label: "Ethereum.org — gas and fees (units, limits, out-of-gas)", url: "https://ethereum.org/en/developers/docs/gas/", type: "docs" },
          ],
        },
        {
          title: "EIP-1559: the fee market",
          body: [
            "Before EIP-1559, Ethereum used a first-price auction: you guessed a gas price, and proposers took the highest bids. It was inefficient (chronic overpaying and failed underbids) and volatile. **EIP-1559** (live since the London upgrade, August 2021) restructured the fee per gas into two components with very different destinations and dynamics.",
            "The **base fee** is set *by the protocol*, not by users, and is **burned** (permanently removed from supply). It adjusts every block by a deterministic rule: each block has a target size (15M gas) and a max (30M); if the previous block was above target, the base fee rises by up to 12.5%, and if below, it falls by up to 12.5%. This makes the base fee an automatic **congestion controller** that converges toward a price where blocks sit ~50% full, so users can predict the next block's base fee precisely instead of guessing. Burning it also means heavy network usage is *deflationary* for ETH (the 'ultrasound money' narrative).",
            "The **priority fee** (the 'tip') goes to the block proposer and is how you *bid for faster inclusion* when blocks are contended. You also set a `maxFeePerGas` - the absolute ceiling you will pay per gas - and the protocol charges `baseFee + min(priorityFee, maxFeePerGas - baseFee)`, refunding any difference. So your total cost ≈ `gasUsed × (baseFee + priorityFee)`, capped by `gasUsed × maxFeePerGas`.",
            "The practical consequences are everywhere. During demand spikes - a hyped NFT mint, a market crash triggering mass liquidations - block space is scarce, the base fee ratchets up rapidly, and priority-fee bidding wars ensue; this is exactly the contention that MEV searchers compete in (they bid large priority fees, or pay builders directly, to win ordering). And it sharpens the incentive for **gas optimization** in Solidity: every storage write you eliminate, every variable you pack into a shared slot, directly reduces `gasUsed` and thus user cost, which matters most precisely when fees are high.",
          ],
          resources: [
            { label: "EIP-1559 — fee market change (the exact specification)", url: "https://eips.ethereum.org/EIPS/eip-1559", type: "docs" },
            { label: "Ethereum.org — gas (EIP-1559 base + priority fee)", url: "https://ethereum.org/en/developers/docs/gas/", type: "docs" },
          ],
        },
        {
          title: "EVM architecture: stack, memory, storage",
          body: [
            "The EVM is a **deterministic, quasi-Turing-complete, 256-bit, big-endian stack machine**. Unpack that: *deterministic* (same input + state → same output on every node), *quasi-Turing-complete* (it can compute anything, but gas bounds execution so it always halts), *256-bit* (its native word is 32 bytes, chosen to match Keccak-256 output and elliptic-curve field sizes - which is why `uint256` is the cheapest, most natural integer type), and a *stack machine* (no registers; operands are pushed and popped on a stack).",
            "There are three data regions, and the entire art of EVM programming and gas optimization is understanding their cost and lifetime. The **stack** holds up to **1024** 256-bit words and is where computation happens: opcodes pop their inputs off the top and push results. It is essentially free but tiny - exceed 1024 depth (e.g. via deep recursion or too many local variables) and you hit a stack-too-deep error.",
            "**Memory** is a linear, byte-addressable scratchpad, zero-initialized and *wiped at the end of each call*. It is cheap to use but volatile - it exists only for the duration of the current execution frame. Its cost grows **quadratically** as you expand it (to disincentivize using memory as cheap storage), so reading/writing a few KB is fine but ballooning memory is expensive. Memory is where you build dynamic arrays, ABI-encode call data, and stage return values.",
            "**Storage** is the persistent `uint256 → uint256` key-value map that *is* the contract's part of the world state (committed in its `storageRoot`). It survives across transactions forever, and it is therefore *extremely* expensive: `SSTORE` and `SLOAD` cost orders of magnitude more than stack/memory ops, because every full node on Earth must store and maintain that data indefinitely. This single asymmetry drives almost all of Solidity gas optimization: keep working data on the stack and in memory, touch storage as rarely as possible, batch writes, and pack multiple small variables into one 32-byte slot (covered in the Solidity topic).",
            "The clean analogy to systems programming: stack ≈ CPU registers/stack (fast, tiny, ephemeral), memory ≈ process heap (cheap, larger, freed on return), storage ≈ disk/persistent DB (slow, expensive, permanent, globally replicated). If you have written low-level code, this maps almost one-to-one - which is why systems programmers pick up the EVM quickly. There are also **transient storage** (EIP-1153, `TSTORE`/`TLOAD`) for cheap within-transaction persistence, and **calldata** (read-only transaction input), which we treat in the Solidity data-locations subtopic.",
          ],
          resources: [
            { label: "Ethereum.org — the EVM (architecture, the exact internals page)", url: "https://ethereum.org/en/developers/docs/evm/", type: "docs", note: "canonical EVM page" },
          ],
        },
        {
          title: "Opcodes, bytecode & reading the machine",
          body: [
            "Compiled Solidity becomes **EVM bytecode**: a flat byte sequence of ~140 distinct **opcodes**, each one byte, interleaved with the immediate data of `PUSH` instructions. There are no functions, variables, types, or scopes at this level - only a stack, three memory regions, and jumps. Learning to read bytecode is the same cognitive skill as reading assembly, and it demystifies contracts completely.",
            "The opcode families: **arithmetic/logic** (`ADD`, `MUL`, `SUB`, `DIV`, `MOD`, `EXP`, `LT`, `GT`, `EQ`, `AND`, `OR`, `XOR`); **environment/context** (`CALLER` = msg.sender, `CALLVALUE` = msg.value, `CALLDATALOAD`, `ADDRESS`, `TIMESTAMP`, `NUMBER`); **memory/storage** (`MLOAD`, `MSTORE`, `SLOAD`, `SSTORE`); **control flow** (`JUMP`, `JUMPI` for conditional jump, and `JUMPDEST` which marks legal jump targets - you can only jump to a `JUMPDEST`); **logging** (`LOG0`-`LOG4` for events); and **call/create** (`CALL`, `STATICCALL`, `DELEGATECALL`, `CREATE`, `CREATE2`).",
            "**Function dispatch** is worth seeing explicitly. A contract has no built-in notion of methods; instead, compiled contracts begin with a **dispatcher**: they load the first 4 bytes of calldata (the function selector), then compare it against each function's selector (`keccak256` of the signature, first 4 bytes) and `JUMPI` to the matching code block, reverting if none match. So calling `transfer(to, amount)` really means: send calldata whose first 4 bytes are `0xa9059cbb` followed by the encoded arguments, and the dispatcher routes to the transfer logic. Selector collisions (two functions with the same first-4-bytes hash) are a real, occasionally exploited edge case.",
            "The most consequential opcode to understand deeply is **`DELEGATECALL`**. A normal `CALL` to contract B runs B's code in B's context (B's storage, `msg.sender` = the caller). `DELEGATECALL` runs B's code in *the caller's* context - the caller's storage, the original `msg.sender` and `msg.value` preserved. This is what makes **proxy/upgradeable** contracts possible (the proxy holds state and delegatecalls into a swappable logic contract) and is simultaneously the source of the nastiest bugs (storage collisions, the Parity self-destruct freeze) - all detailed in the Solidity and Security topics. `STATICCALL` is `CALL` that forbids state changes (used for `view` calls), and `CREATE2` deploys to a deterministic, pre-computable address (used by factories and account abstraction).",
            "The fastest way to truly internalize all of this: open **evm.codes**, paste a small contract's bytecode (or write a few opcodes in its playground), and *single-step* through execution, watching the stack, memory, and storage mutate with each instruction and seeing the gas meter tick. An hour of stepping teaches more than any amount of reading - and it builds exactly the reverse-engineering intuition you will use when auditing or analyzing unverified contracts.",
          ],
          resources: [
            { label: "evm.codes — interactive opcode reference & step-through playground", url: "https://www.evm.codes/", type: "tool" },
            { label: "Ethereum.org — opcodes reference (gas + semantics per opcode)", url: "https://ethereum.org/en/developers/docs/evm/opcodes/", type: "docs" },
          ],
        },
        {
          title: "World state & the Merkle-Patricia Trie",
          body: [
            "Everything above operates on Ethereum's **world state**: a single mapping from every 20-byte address to its account record, where each contract's storage is itself a mapping from 256-bit key to 256-bit value. The protocol must commit this entire, *mutable* dataset to one 32-byte root per block - so that block headers are tiny, light clients can verify facts, and rollups can post and prove state. The structure that achieves this is the **Merkle-Patricia Trie (MPT)**.",
            "An MPT combines two ideas. A **Patricia (radix) trie** stores key→value pairs by walking the key's nibbles down a tree, sharing common prefixes (efficient for the sparse, hex-keyed address space). The **Merkle** part means each node is identified and linked by the *hash* of its contents, exactly like a Merkle tree - so the root hash commits to the whole structure, and any change to any value propagates up to change the root. Ethereum's MPT has three node types (branch, extension, leaf) plus an RLP encoding for serialization; the details matter when you implement one, but the conceptual takeaway is 'a hash-committed, prefix-sharing key-value map'.",
            "Two roots are central. The **state root** in each block header commits to *all accounts* (address → account record). Each contract account's **storageRoot** commits to *that contract's storage slots* (slot key → value). Because both are Merkle structures, you can produce a compact **proof** that 'account A has balance B and nonce N' or 'slot S of contract C equals V' that verifies against just the root - which is exactly what the `eth_getProof` RPC returns. This is the machinery behind trustless light clients (verify state from headers + proofs, no full node) and behind both optimistic and ZK rollups (which commit L2 state as a root on L1 and later prove things about it).",
            "The MPT has a known weakness: its proofs are relatively large (a path of branch nodes, each up to 16 children), which is a barrier to **stateless clients** (clients that hold no state and verify everything via proofs). The planned upgrade is **Verkle trees**, which replace the hash-based Merkle commitments with **polynomial/vector commitments (KZG-style)** to produce dramatically smaller proofs - a direct example of advanced cryptography reshaping a core data structure to unlock a scaling property. Whether MPT or Verkle, the role is identical: turn a huge mutable state into one verifiable root, so the rest of the system can reason about state succinctly. That capability is the quiet foundation under light clients, bridges, and the entire L2 ecosystem in later topics.",
          ],
          resources: [
            { label: "Ethereum.org — Merkle-Patricia Trie (state encoding, exact page)", url: "https://ethereum.org/en/developers/docs/data-structures-and-encoding/patricia-merkle-trie/", type: "docs" },
            { label: "Ethereum Yellow Paper — formal state & EVM specification", url: "https://ethereum.github.io/yellowpaper/paper.pdf", type: "paper" },
          ],
        },
      ],
      resources: [
        { label: "Ethereum.org — the EVM (exact internals page)", url: "https://ethereum.org/en/developers/docs/evm/", type: "docs", note: "the exact EVM-internals page" },
        { label: "evm.codes — interactive opcode reference", url: "https://www.evm.codes/", type: "tool" },
        { label: "Ethereum Yellow Paper (formal spec)", url: "https://ethereum.github.io/yellowpaper/paper.pdf", type: "paper" },
      ],
      connections: [
        { to: "crypto-ecc", note: "secp256k1 ECDSA signs and authenticates every transaction via ecrecover" },
        { to: "comp-bytecode", note: "The EVM is exactly the stack-based bytecode VM studied in compilers" },
        { to: "ll-asm", note: "Reading EVM opcodes is the same skill as reading x86/ARM assembly" },
      ],
    },
  ],
});
