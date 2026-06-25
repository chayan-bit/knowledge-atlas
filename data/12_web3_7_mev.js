atlasAdd({
  id: "web3",
  topics: [
    {
      id: "web3-mev",
      title: "MEV (Maximal Extractable Value)",
      level: "Advanced",
      body: [
        "MEV is the hidden financial layer of blockchains - the profit that can be extracted by controlling *which* transactions are included and *in what order*. It exists because two facts from the fundamentals topic combine explosively: pending transactions sit in a *public* mempool for anyone to see, and whoever builds a block has total freedom over its transaction ordering. Order is money, the mempool is a transparent queue, and a whole industry of searchers, builders, and relays has grown up to capture and reshape this value.",
        "This topic explains what MEV is and why it is inevitable, the taxonomy of extraction (arbitrage, sandwiches, liquidations, JIT), the architecture built to manage it (proposer-builder separation, MEV-Boost, the searcher→builder→relay→proposer pipeline), and how it is actually executed (Flashbots bundles, simulation, private orderflow) plus where it is heading (MEV-Share, SUAVE). MEV is the crypto incarnation of high-frequency trading - the same latency, simulation, and adversarial-ordering game - which is why it connects straight to the quant/HFT and low-level networking domains.",
      ],
      subtopics: [
        {
          title: "What MEV is & why it is inevitable",
          body: [
            "**Maximal Extractable Value** (originally 'Miner Extractable Value', renamed after the Merge since proposers, not miners, now order blocks) is the maximum value that can be captured by *including, excluding, and reordering* transactions within a block, *beyond* the standard block reward and priority fees. It is the economic surplus latent in the power to sequence transactions.",
            "It is inevitable given two structural properties. First, the **mempool is public**: anyone running a node can observe pending, unconfirmed transactions before they are mined - so a profitable opportunity created by someone's pending transaction (a large swap about to move a price, a loan that just became liquidatable, a mispriced NFT listing) is visible to everyone simultaneously. Second, the **block builder has ordering freedom**: nothing forces transactions to be ordered by arrival time; the builder can place its own or others' transactions anywhere, including immediately before or after a victim's. Put together, the mempool is a transparent order queue and the builder is an auctioneer who can rearrange it at will.",
            "The mental model that makes everything else fall into place: think of the mempool as a fully transparent order book where every pending order is visible *before* it executes, and the block proposer/builder gets to decide the final matching order. Any transaction whose effect on state is *predictable* - and most DeFi transactions are - is an opportunity for someone to position around it. This is precisely the information and ordering advantage that high-frequency traders fight for on traditional exchanges, except here the 'order book' is public to all and the 'matching engine' is auctioned every block.",
            "MEV's scale is enormous - cumulative extraction is measured in the billions of dollars - and it cuts both ways: some MEV is *beneficial* (arbitrage that keeps prices accurate, liquidations that keep lending solvent), and some is *predatory* (sandwich attacks that tax ordinary users). Understanding MEV is therefore essential whether your goal is to *capture* it (as a searcher), to *defend users* from it (as a protocol or wallet designer), or simply to understand why your swap sometimes executes at a worse price than you expected.",
          ],
          resources: [
            { label: "Ethereum.org — MEV (overview & taxonomy)", url: "https://ethereum.org/en/developers/docs/mev/", type: "docs" },
          ],
        },
        {
          title: "Arbitrage, sandwiches, liquidations & JIT",
          body: [
            "**Arbitrage** is the benign core of MEV and the 'good' kind that keeps DeFi honest. When the same asset is priced differently across venues - two AMMs, or an AMM versus a centralized exchange (CEX-DEX arbitrage) - a searcher atomically buys where it is cheap and sells where it is expensive, pocketing the spread and, in doing so, pushing the prices back into alignment. This is exactly the arbitrage mechanism from the AMM subtopic; it is what tethers AMM prices to the real market, and it is socially useful (it improves price accuracy for everyone). DEX-DEX arbitrage within a single transaction is risk-free given atomicity.",
            "**Sandwich attacks** are the predatory kind that taxes ordinary traders. Seeing a victim's large swap pending in the mempool, the attacker **front-runs** it with their own buy of the same asset (pushing the price up along the AMM curve), lets the victim's swap execute at the now-worse price (the victim suffers extra slippage), then **back-runs** with a sell, capturing the price difference the victim's own trade created. The victim's slippage tolerance is literally the attacker's profit margin. This is why setting a *tight slippage limit* and using private transaction submission are the key user defenses (covered next).",
            "**Liquidations** are competitive but socially necessary MEV. When a lending position's health factor drops below 1 (DeFi topic), it becomes liquidatable, and searchers race to be the one who repays the bad debt and claims the collateral *plus the liquidation bonus*. The competition is intense (often won by the highest priority-fee bid or the fastest bundle), and while it is a transfer from the liquidated borrower, it performs the essential function of keeping the protocol solvent before positions go underwater. **JIT (just-in-time) liquidity** is a v3-specific play: a searcher adds a large, tightly-concentrated liquidity position in the *same block* as a big incoming swap to capture most of that swap's fees, then removes the liquidity immediately after - earning fees with near-zero duration risk, at the expense of passive LPs.",
            "Other forms exist - long-tail arbitrage, NFT-mint sniping, oracle-update back-running, and 'generalized front-running' where bots blindly copy any profitable-looking pending transaction. But arbitrage, sandwiches, and liquidations are the bulk of the value and the ones to understand deeply.",
            "The **user defenses** follow directly from the mechanics. Set a **tight slippage tolerance** so a sandwich cannot move the price far enough to profit (too tight and your trade may revert in volatile conditions - a tradeoff). Submit through a **private relay** (e.g. Flashbots Protect / MEV-blocker RPCs) so your transaction never enters the public mempool and thus cannot be seen and sandwiched. Use **MEV-aware routers/aggregators** that split orders and route to minimize impact. And understand that on an AMM, a large market order in a thin pool is *inherently* exposed - splitting it or using a different venue may be the right call. For a protocol designer, the lesson is to avoid mechanisms that create easy, predictable MEV against your users.",
          ],
          resources: [
            { label: "Flashbots — MEV research, explainers & taxonomy (writings)", url: "https://writings.flashbots.net/", type: "docs" },
          ],
        },
        {
          title: "Proposer-Builder Separation (PBS) & MEV-Boost",
          body: [
            "Left unmanaged, MEV is a **centralizing force**. Extracting MEV well requires sophisticated, capital-intensive infrastructure (mempool monitoring, simulation, optimization), and whoever extracts the most can afford to bid the most for block space and earn the most - so over time block production would concentrate among a few hyper-optimized players, undermining Ethereum's decentralization. **Proposer-Builder Separation (PBS)** is the architectural response: split the *building* of a block (a specialized, competitive, MEV-intensive task) from the *proposing* of it (a simple task any validator can do).",
            "Under PBS, **builders** compete to assemble the most valuable possible block - they ingest the public mempool and private orderflow (searcher bundles), solve the optimization of which transactions in which order maximize total value, and produce a complete block with a bid (the value they will pay the proposer). **Proposers** (ordinary validators) do *not* need any MEV machinery; they simply receive bids from many builders and select the highest-paying block header to propose. This lets a solo validator with 32 ETH earn near the same MEV-adjusted reward as a sophisticated operation, preserving decentralization at the validator layer while concentrating the specialized work in a competitive builder market.",
            "Today this is implemented **off-protocol** via **MEV-Boost**, software the large majority of Ethereum validators run. The missing trust piece is the **relay**: a builder will not reveal its full block (with all the valuable MEV) to a proposer who could simply steal the transactions and propose them itself, and a proposer will not commit to a block it cannot see. The relay sits between them as a trusted intermediary - it receives full blocks from builders, validates them, shows only the *header* and bid to the proposer, and releases the full block body *only after* the proposer has cryptographically committed (signed) to that header. This prevents both parties from cheating.",
            "So the **actor pipeline** to memorize is: **searchers** find MEV opportunities and submit bundles → **builders** assemble complete, ordered blocks from the mempool plus bundles, competing on total value → **relays** broker trust and prevent header/body theft → **proposers** (validators) pick the highest-paying header and propose it. Each arrow is effectively an auction. The roadmap aims to move PBS *into* the protocol itself (**enshrined PBS / ePBS**) so the trusted relay is no longer needed, and related research (inclusion lists, encrypted mempools) aims to curb censorship and predatory MEV.",
          ],
          resources: [
            { label: "Flashbots — MEV-Boost & PBS documentation", url: "https://docs.flashbots.net/flashbots-mev-boost/introduction", type: "docs" },
          ],
        },
        {
          title: "Flashbots bundles, simulation & the frontier",
          body: [
            "A searcher does **not** broadcast their MEV transactions to the public mempool - doing so would reveal the strategy and invite other bots to copy or counter-front-run it, and would expose the searcher to failed-transaction gas costs. Instead, searchers submit **bundles** directly to builders. A **bundle** is an *ordered list of transactions that must execute together, atomically, in exactly the specified order, or not at all* - submitted via `eth_sendBundle`. Critically, a bundle can include *someone else's* transaction pulled from the public mempool (e.g. the victim's swap), which is how a sandwich is constructed: `[attacker buy, victim swap, attacker sell]` as one atomic, ordered unit.",
            "Before bidding, searchers **simulate** their bundles against current state with `eth_callBundle` to verify profitability and correctness - if the bundle would not profit (because state changed, or a competitor got there first), they do not submit it, so they never waste gas on a failing attempt. Searchers pay builders for inclusion either through a high **priority fee** or via a direct **`coinbase` transfer** (paying the block proposer) *conditioned on the bundle succeeding* - so the searcher only pays when the bundle actually lands and profits. This private, atomic, simulated, pay-on-success workflow is what makes professional MEV a precise engineering discipline rather than a gamble, and it is the literal analogue of an HFT firm's co-located, simulated, latency-optimized execution stack.",
            "The frontier is about **redistributing** MEV and **decentralizing** its infrastructure, because the status quo has two problems: predatory MEV taxes users, and the builder/relay layer is worryingly centralized. **MEV-Share** lets users *selectively* reveal parts of their transaction to searchers (rather than the all-or-nothing of the public mempool) and receive a **rebate** of the MEV their transaction creates - so value flows *back* to the user who generated it, instead of being fully captured by searchers. **MEV-blocker / protect RPCs** give ordinary users private submission plus rebates by default. And **SUAVE** (Single Unifying Auction for Value Expression) is Flashbots' proposed decentralized, chain-agnostic network that unbundles the mempool, block-building, and orderflow auction into a shared public good - aiming to break the centralization of today's builders and relays.",
            "Two deeper threads to be aware of. **Encrypted mempools / threshold encryption** would hide transaction contents until they are ordered, eliminating front-running at the source (you cannot sandwich what you cannot read) - a cryptographic rather than economic fix. And **cross-domain MEV** (across L2s, across chains, and CEX-DEX) is the next frontier as the ecosystem fragments, raising the same latency and trust questions one level up.",
            "The synthesis to carry away: MEV is the inevitable economic consequence of public mempools plus ordering freedom; it is simultaneously a useful price-correction/solvency mechanism and a user-harming tax; an entire auction-based infrastructure (PBS, MEV-Boost, searchers/builders/relays, bundles) has formed to capture and manage it; and the active research direction is to *redistribute* it to users (MEV-Share), *decentralize* its plumbing (SUAVE, ePBS), and *suppress* its predatory forms (encrypted mempools). It is, end to end, high-frequency trading reimagined for a transparent, programmable, adversarial public ledger - which is exactly why the quant/HFT and low-level networking skill sets transfer directly.",
          ],
          resources: [
            { label: "Flashbots — documentation (bundles, simulation, MEV-Share)", url: "https://docs.flashbots.net/", type: "docs" },
            { label: "Paradigm — MEV & mechanism-design research", url: "https://www.paradigm.xyz/team/research", type: "docs" },
          ],
        },
      ],
      resources: [
        { label: "Flashbots — documentation", url: "https://docs.flashbots.net/", type: "docs" },
        { label: "Flashbots — MEV explainers (writings)", url: "https://writings.flashbots.net/", type: "docs" },
        { label: "Paradigm — MEV research", url: "https://www.paradigm.xyz/team/research", type: "docs" },
      ],
      connections: [
        { to: "quant-hft", note: "MEV searching is HFT-style latency/arbitrage, on-chain" },
        { to: "web3-defi", note: "MEV extracts value from AMM, lending and liquidation mechanics" },
        { to: "ll-network", note: "Competitive searching/building pushes toward low-latency networking" },
      ],
    },
  ],
});
