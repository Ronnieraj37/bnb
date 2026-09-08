# Engineering notes

Verified behaviour and hard-won gotchas. Everything here was confirmed by probing the real API/chain, not read off a docs page.

## Data-integrity rules (do not break these)

The whole pitch is "we measure, we don't trust claims":

- **No fabricated numbers, ever.** An early `simulate.ts` produced a seeded random walk presented as paper-trade results. It was deleted, and nothing like it may come back.
- Registry agents have **no performance object at all** — the UI renders "N/A" or falls back to what the chain can prove, never zeros dressed up as data.
- Numbers that are structurally meaningless are **not shown**.
- Illustrative things are **labelled illustrative**. The strategy demo runs on real BNB/USDT price but with typical category parameters, and says so on screen, because agents don't publish their strategy config on-chain.
- Unbuilt things say so. The Altana Keystore on-chain grant is labelled as the next step, not mocked.
- Yield figures are filtered for credibility as well as truth — see the DeFiLlama note below.

## 8004scan API (verified by probing the live API)

- Base: `https://api.8004scan.io/api/v1` (**not** `/v1` — that 404s)
- Auth: `x-api-key: <key>` (Bearer also accepted)
- List: `GET /agents?chain_id=56&limit=100&offset=N&sort_by=total_score&order=desc`
- **`limit` max is 100** — 101+ returns a validation error with zero items
- Chain filter is `chain_id` (56 = BSC). `chainId` / `chain` / `chain_ids` are silently ignored and return all chains
- Response: `{ items, total, limit, offset }` — BSC total ≈ **300k agents**
- **The list endpoint never returns `services` (tools), `scores` or health** — only the detail endpoint does. So an empty `capabilities` on a list record means "not checked", not "no interface". Cards must not conflate the two.
- Detail: `GET /agents/56/{contract}/{tokenId}`
- **No performance data** (no PnL/APR/win-rate/uptime) — this is the core reason the product exists.
- The registry is dominated by generic "trading" agents, so the catalogue fills **per-category buckets** via targeted searches instead of taking a global top-N, which would come out badly unbalanced.
- `search=` is observed to fail outright for stretches (every `search=` query 500s for ~10s while the plain list endpoint stays healthy). Hence soft/hard TTL caching: serve a few-minutes-stale-but-real catalogue rather than blanking the marketplace.

## Etherscan / BSC history

- Etherscan V2 is one multichain API: `https://api.etherscan.io/v2/api?chainid=56`.
- **BSC is not on the free tier.** A valid free key returns `"Free API access is not supported for this chain"` for chainid 56 while working fine on chainid 1. Full history therefore needs a paid (Lite) plan.
- Field names confirmed against live responses: `timeStamp`, `from`, `to`, `value`, `contractAddress`, `tokenSymbol`, `tokenDecimal`, `gasUsed`, `gasPrice`, `isError`.
- Because of this, the agent page's default is the **keyless** live RPC snapshot (holdings, balances, tx count), which needs no key at all.

## Chain gotchas

- **Venus native BNB withdrawal fails with Altana 7702 wallets.** `vBNB.redeem()` reverts (empty data) because vBNB pays out via `.transfer()` (2300 gas stipend), too little to resolve a 7702 delegation. Only the **native BNB** market is affected — all ERC-20 markets work.
  - *Design rule:* health-factor flows must use **WBNB / ERC-20 markets** (or a NativeTokenGateway where one exists), never direct native `vBNB` redeem.
- PancakeSwap v3 Factory / SwapRouter / NonfungiblePositionManager are deployed at the **same addresses on bsc-testnet as mainnet** — verified by reading real bytecode at those addresses on testnet.
- **Testnet pool prices are not arbitraged.** A live WBNB/CAKE testnet pool returned a ratio off by ~11 orders of magnitude from the real market rate (seeded liquidity at an arbitrary ratio). The pool read is real; the *number* is not a trading signal. Report the deviation plainly rather than implying an arbitrage opportunity.
- Price math uses `1.0001^tick` rather than converting a ~160-bit `sqrtPriceX96` straight to a JS `Number` and squaring, which loses precision.

## DeFiLlama

- The `/pools` payload covers every chain and is ~15MB — over Next's 2MB fetch-cache ceiling, so `next: { revalidate }` silently fails to cache it and every call re-fetches everything. We cache the filtered BSC-only result ourselves and use `cache: "no-store"`.
- Real but degenerate pools exist (900%+ APR reward farms). These are *true* yet read as fake and aren't what a responsible yield agent would route into, so credible-yield surfaces filter to deep pools with sane rates.

## BNB Chain economics

- Gas ≈ **$0.02/tx** vs ≈ $1.20 on Ethereum L1.
- Sub-second block times.
- Agents pay gas on every write, so gas-per-action decides viability — which is why "is the extra APR worth the gas?" is a first-class check in the builder and the Advantage Report.

## Network strategy (deliberate split)

- **Market data → mainnet, always.** Binance prices and DeFiLlama APYs. Testnet has no real liquidity, so measuring a strategy against testnet prices would re-introduce fabricated numbers.
- **Executable writes → testnet.** The builder's swap is a real, wallet-signed transaction on BSC testnet.

## Registry: mainnet vs testnet

- `chain_id=56` (mainnet) → ~300k agents, many real named DeFi agents. Best data quality; this is the default browse.
- `chain_id=97` (testnet) → ~2k agents, `is_testnet: true`, but mostly generic `studio-agent` placeholders from Agent Studio deploys.

## Open item: first-party agent compliance

The submission rule is *"agents surfaced on your marketplace must be live on BSC."* The marketplace itself satisfies this — every listed agent is a real on-chain ERC-8004 registry entry.

The scaffolds under `agents/` (gridpilot, healthguard, rangekeeper, yieldrouter) are **definitions, not yet registered on-chain**. To surface them they must be registered under ERC-8004 on BSC testnet and their real token ids stored. Until then they must not be listed as if they were live registry agents.

Relevant tooling versions (checked): `@bnbagent/studio-cli` ≥ **0.0.13** (it validates the policy whitelist before the first on-chain write), TS SDK ≥ 0.5.1, Python SDK ≥ 0.4.3.

## Ecosystem context

- **Altana** framing that matches this build: *"Listing agents is the easy half. The hard half is the moment a user hands an agent money."* The stack for that moment is scoped sessions (delegation) → Keystore (verification) → ERC-8183 (hiring) → x402 (per-call payments).
- **VEYRA** — a competing production DeFi agent marketplace on BSC using ERC-8004 + Altana session delegation, with verified sessions operating a PancakeSwap V3 position on testnet. Strong on the Altana production side.
- **4lpha** — curated ~9 flagship agents with hand-set metrics and no mobile support. See [ROADMAP](ROADMAP.md) for how we position against it.
- **Global Score Agent** — a reputation layer for ERC-8004 agents that indexes BNB; a possible additional signal for a composite score.

## Builder rules

- Each block declares `requires` (wallet / Telegram chat id / URL) and `writes` (costs gas). Blocks missing a requirement render "needs setup" instead of failing at run time.
- The intent engine **names protocols it cannot support** instead of substituting one (asking for Uniswap says so; it does not silently hand you Venus).
- The server never moves funds: read blocks run server-side, and any write block is handed to the user's own wallet to sign.
