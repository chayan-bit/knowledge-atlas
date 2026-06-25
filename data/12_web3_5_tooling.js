atlasAdd({
  id: "web3",
  topics: [
    {
      id: "web3-tooling",
      title: "Development tooling (Foundry)",
      level: "Intermediate",
      body: [
        "Tooling is not a side concern in smart-contract development - because contracts are immutable and adversarial, your test suite *is* your safety net, and the quality of your tooling largely determines whether bugs ship. **Foundry** has become the default professional toolkit precisely because it lets you write tests *in Solidity* against a real EVM, fuzz aggressively, fork mainnet, and script deployments - all extremely fast.",
        "This topic covers the four pillars - Forge (testing), cheatcodes (controlling the test EVM), fuzzing/invariant testing (tests as proofs), and Cast/Anvil plus deterministic deploys - and then static analysis with Slither. The throughline is a layered assurance strategy: cheap automated checks catch the known patterns, fuzzing catches the accounting bugs, and the deep logic flaws are left to manual audit and formal methods (Security topic). A contract that has only example-based unit tests is under-tested by modern standards.",
      ],
      subtopics: [
        {
          title: "Forge: Solidity-native testing",
          body: [
            "**Forge** is Foundry's testing engine, and its defining choice is that you write tests *in Solidity*, not JavaScript. The advantage is more than convenience: tests run directly in a native EVM implementation in-process, so there is no ABI marshalling between a JS runtime and the chain, no async ceremony, and execution is extremely fast (an entire suite can run in seconds). You stay in one language and one mental model, which matters when you are reasoning about subtle storage and call semantics.",
            "The structure mirrors standard test frameworks. A test contract inherits Foundry's `Test` base, defines a `setUp()` function that runs fresh before *each* test (deploying contracts, seeding balances), and any function named `test...` is a test case. You assert with `assertEq`, `assertTrue`, `assertGt`, `assertApproxEqAbs`, etc. Functions named `testFail...` are expected to revert (though the explicit `vm.expectRevert` is preferred for precision). Running `forge test` executes everything; `-vvvv` prints the full call trace with per-call gas, which is invaluable for understanding *why* a test failed deep in a call tree.",
            "Two features elevate Forge beyond a unit-test runner. **Mainnet forking** (`forge test --fork-url $RPC_URL`, or `vm.createSelectFork`) spins up a local EVM seeded with *real mainnet state*, so you can test your contract against the actual deployed Uniswap, Aave, or any live protocol - and, critically, **reproduce historical hacks** by forking to the block just before an exploit and replaying it. This is the single best way to learn DeFi security. The other is built-in **gas profiling**: `forge snapshot` records gas per test and diffs it across changes, so you can prove an optimization actually saved gas and catch regressions.",
            "Coverage (`forge coverage`), gas reports, and deployment scripting (`forge script`, next subtopic) round it out. The recommended way to actually learn: pick a small token or vault, write its tests in Forge while reading the Foundry Book, and use `-vvvv` traces to *watch* state, reverts, and gas change. You will absorb more EVM and Solidity from debugging a failing Forge test than from any tutorial, because the feedback is immediate and concrete.",
          ],
          resources: [
            { label: "Foundry Book — Forge testing guide (writing & running tests)", url: "https://book.getfoundry.sh/forge/tests", type: "docs" },
          ],
        },
        {
          title: "Cheatcodes: controlling the test EVM",
          body: [
            "**Cheatcodes** are special operations exposed through Foundry's `vm` interface that manipulate the test EVM in ways impossible on a real chain - and that is exactly what makes them invaluable: they let you construct *precisely* the conditions you need to test, including adversarial ones. They are the difference between 'I hope this branch is covered' and 'I have placed the contract in exactly this state and asserted the outcome'.",
            "The essential identity and balance cheatcodes: **`vm.prank(addr)`** makes the *next* call appear to come from `addr` (and `vm.startPrank`/`stopPrank` for a range), which is how you test access control - call a privileged function as a non-owner and assert it reverts, then as the owner and assert it succeeds. **`vm.deal(addr, amount)`** sets an account's ETH balance; **`deal(token, addr, amount)`** (from the std library) sets an ERC-20 balance by writing the storage slot directly - so you can fund test actors without elaborate setup.",
            "The time and control cheatcodes let you test temporal logic deterministically: **`vm.warp(timestamp)`** sets `block.timestamp` and **`vm.roll(blockNumber)`** sets `block.number`, so you can fast-forward past a timelock, a vesting cliff, or a TWAP window and assert behavior on both sides of the boundary. **`vm.expectRevert(selector)`** asserts the next call reverts *with a specific error* (not just any revert - precision matters so you do not mask a different bug). **`vm.expectEmit(...)`** asserts that a specific event with specific args is emitted. **`vm.mockCall(...)`** forces an external call to return a value you choose, so you can simulate an oracle returning a manipulated price, or a dependency failing.",
            "The deepest ones reach into storage directly: **`vm.store(addr, slot, value)`** and **`vm.load(addr, slot)`** read and write arbitrary storage slots. This both lets you set up otherwise-unreachable adversarial states and forces you to use the **storage-layout** knowledge from the Solidity topic (you must compute which slot a variable or mapping entry lives in). Using `vm.store` to corrupt a proxy's implementation slot, for instance, lets you test your collision defenses.",
            "Together, cheatcodes turn testing from 'observe what happens' into 'engineer the exact scenario and assert the exact result' - including the malicious scenarios an attacker would create. The discipline of writing, for every privileged function and every state-machine transition, a test that uses `vm.prank`/`vm.warp`/`vm.expectRevert` to pin down who-can-do-what-when is what gives a codebase real confidence.",
          ],
          resources: [
            { label: "Foundry Book — cheatcodes reference (the exact catalog)", url: "https://book.getfoundry.sh/cheatcodes/", type: "docs" },
          ],
        },
        {
          title: "Fuzzing & invariant (stateful) testing",
          body: [
            "Example-based tests only check the cases you thought of - and the bugs that drain protocols are precisely the ones nobody thought of. **Property-based fuzzing** flips this: instead of hardcoding inputs, you declare a test with *parameters* (`function testDeposit(uint256 amount) public`), and Forge throws hundreds or thousands of pseudo-random inputs at it, automatically probing boundary values (0, 1, `type(uint256).max`, values near your require-thresholds). When it finds an input that breaks an assertion, it **shrinks** the failure to a minimal reproducing counterexample, handing you the smallest input that triggers the bug. You can constrain the input domain with `vm.assume(...)` or `bound(...)` to keep fuzzing in the meaningful range.",
            "**Invariant testing** is the more powerful, and more conceptually important, mode. Rather than fuzzing a single function call, Forge runs *random sequences of calls* across your contracts - this is **stateful fuzzing** - and after every step it checks your declared **invariants**: properties that must hold *no matter what sequence of operations* occurs. You define `invariant_...()` functions and configure which contracts/functions the fuzzer may call (the 'handlers' and 'targets'). The fuzzer becomes an adversary trying to drive your system into a state where an invariant breaks.",
            "The canonical examples make the idea click. For an **AMM**, the invariant is that the constant-product `k = reserveX · reserveY` must never *decrease* due to a bug (it may only grow from fees) - if any random sequence of swaps/mints/burns makes it drop, you have found an accounting flaw. For a **lending market**, total debt must always be backed (`Σ collateral ≥ Σ borrows` adjusted for thresholds), or the sum of all users' balances must always equal `totalSupply`. For a **vault**, total assets must always equal the sum of what is redeemable. You *specify what must always be true* and let the machine try to falsify it - this is genuinely 'tests as proofs' (lightweight, probabilistic, but enormously effective).",
            "This matters because invariant fuzzing catches exactly the bug classes that unit tests miss: subtle accounting drift, rounding that accumulates, reentrancy that corrupts state across calls, and edge-case sequences (deposit-then-donate inflation attacks, liquidation-during-update races). It is the smart-contract analogue of coverage-guided fuzzers like AFL/libFuzzer in security research - the same philosophy of 'generate adversarial inputs to break a stated property', applied to stateful on-chain systems. Echidna (Security topic) is a complementary, more configurable fuzzer in the same family.",
            "Practical advice: write invariants *first*, as you would write a spec, then let fuzzing pressure-test them; invest in good handlers (so the fuzzer explores realistic action sequences); and treat any invariant failure as a high-priority finding. A protocol with a strong invariant suite is dramatically harder to break than one with only happy-path unit tests.",
          ],
          resources: [
            { label: "Foundry Book — invariant testing (stateful fuzzing, handlers)", url: "https://book.getfoundry.sh/forge/invariant-testing", type: "docs" },
          ],
        },
        {
          title: "Cast, Anvil & deterministic (CREATE2) deploys",
          body: [
            "**Cast** is Foundry's command-line Swiss army knife for interacting with chains and decoding data - the tool you live in for inspection, scripting, and forensics. `cast call` reads from a contract (a `view` function) without sending a transaction; `cast send` sends a state-changing transaction; `cast 4byte` and `cast 4byte-decode` resolve a function selector to its signature and decode calldata; `cast storage` reads a contract's storage slot (exercising your storage-layout knowledge); `cast run` replays and traces a historical transaction locally; and there are unit converters (`cast --to-wei`), ABI encoders/decoders, and block/tx inspectors. Turning 'what did this transaction actually do' into a one-line command is most of the value.",
            "**Anvil** is Foundry's local development node: a fast, EVM-accurate chain you run on your machine for end-to-end testing before touching a public testnet. It supports instant or interval mining, forking mainnet state, and **account impersonation** (`anvil_impersonateAccount`) so you can send transactions *as* any address (e.g. a whale or a protocol admin) to set up scenarios. Combined with `forge script`, Anvil gives you a reproducible local pipeline: deploy, seed, interact, and assert, all locally, before spending real gas.",
            "**`forge script`** is the deployment-and-automation mechanism: you write deployment logic in Solidity (a script contract with a `run()` function), simulate it locally, then broadcast it to a network with `--broadcast`, getting deterministic, version-controlled deployments instead of fragile ad-hoc commands. Scripts can read environment variables for keys/addresses and verify contracts on explorers in the same flow.",
            "**CREATE2** deserves its own attention because it underpins a lot of modern architecture. Normal `CREATE` derives a new contract's address from `(deployer, nonce)` - so it depends on deployment order and is not known in advance. **CREATE2** derives the address deterministically from `keccak256(0xff ‖ deployerAddress ‖ salt ‖ keccak256(initCode))[12:]` - independent of nonce, fully computable *before* deployment. This enables three important patterns: **counterfactual instantiation** (you can compute a contract's address and even let users interact with / send funds to it before it is deployed, deploying only when needed - core to some wallet and account-abstraction designs), **consistent cross-chain addresses** (deploy the same contract to the same address on many chains by using the same salt and init code), and **deterministic factories** (a factory that mints predictable child-contract addresses). Understanding the address-derivation formula is what lets you reason about - and audit - all three.",
            "Together, Cast (inspect/script), Anvil (local node), forge script (deploy), and CREATE2 (deterministic addresses) form the operational layer around the testing core. Mastery here means you can go from 'an idea' to 'tested, deployed, and inspectable on-chain' without leaving the toolkit, and you can dissect anyone else's deployed contract with Cast when something goes wrong.",
          ],
          resources: [
            { label: "Foundry Book — Cast reference (chain interaction & decoding)", url: "https://book.getfoundry.sh/cast/", type: "docs" },
            { label: "Foundry Book — Anvil (local node, forking, impersonation)", url: "https://book.getfoundry.sh/anvil/", type: "docs" },
          ],
        },
        {
          title: "Static analysis with Slither",
          body: [
            "**Slither** (by Trail of Bits) is a static-analysis framework that parses Solidity into an intermediate representation (**SlithIR**) and runs roughly 90 built-in **detectors** for known bug patterns - all without executing the code, in seconds. It is the cheapest, fastest first line of defense, and there is no excuse for a serious contract not to pass it. Running `slither .` in a project surfaces issues ranked by confidence and severity.",
            "Its detectors cover the recurring vulnerability classes you will meet in the Security topic: reentrancy (it distinguishes the dangerous from the benign forms), uninitialized storage variables and uninitialized proxy state, dangerous `delegatecall` and arbitrary-`call` destinations, incorrect or non-standard ERC implementations, `tx.origin` authentication, shadowed state variables, unused return values from low-level calls, and many more. Because it reasons over data and control flow, it catches things a regex linter never could - e.g. that a state write happens *after* an external call (a CEI-pattern violation enabling reentrancy).",
            "Slither is more than a checker. Its **printers** generate useful artifacts: inheritance graphs (to verify your C3 linearization is what you intend), function-level call graphs, data-dependency and variable-write summaries, and human-readable contract summaries - all of which speed up understanding an unfamiliar codebase during review. And it is **extensible**: you can write custom detectors in Python to encode project-specific invariants ('this privileged function must always be behind `onlyOwner`', 'this value must never be set without emitting an event'), turning institutional knowledge into automated checks.",
            "The right way to use it is in **CI**: run Slither (and `forge test`/coverage) on every push, fail the build on high-severity findings, and triage the rest. This catches whole categories of mistakes before a human ever reviews the code, freeing reviewers to focus on the deep logic. The related `crytic`/Trail-of-Bits ecosystem also gives you **Echidna** (property fuzzer) and other tools that compose with Slither.",
            "The mental model to leave with - the **assurance ladder**, cheapest first: **Slither** (static analysis) finds the *known patterns* in seconds; **Forge invariant fuzzing** and **Echidna** find the *accounting and sequence* bugs by trying to break your stated properties; **Certora / formal verification** (Security topic) *proves* specific properties hold for all inputs; and a careful **human audit** finds the deep, design-level logic flaws none of the tools can express. Each rung catches what the cheaper one misses, and none replaces the others - real protocols climb the whole ladder.",
          ],
          resources: [
            { label: "Slither — static analyzer (repo, detector list, printers)", url: "https://github.com/crytic/slither", type: "repo" },
          ],
        },
      ],
      resources: [
        { label: "Foundry Book (free) — the canonical reference", url: "https://book.getfoundry.sh/", type: "docs", note: "Forge, Cast, Anvil, scripts" },
        { label: "OpenZeppelin Contracts — docs", url: "https://docs.openzeppelin.com/contracts/", type: "docs" },
      ],
      connections: [
        { to: "cyber-research", note: "Invariant/property fuzzing here is the smart-contract cousin of AFL/libFuzzer" },
        { to: "ll-rust", note: "Foundry itself is written in Rust, as is much of the ZK/L2 tooling stack" },
        { to: "web3-security", note: "This tooling is the practical front line of the security assurance ladder" },
      ],
    },
  ],
});
