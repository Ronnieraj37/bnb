# Hackathon intel & gotchas

## 8004scan API — verified by probing the live API (Pro key)
- Base: `https://api.8004scan.io/api/v1` (NOT `/v1` — that 404s)
- Auth: `x-api-key: <key>` (Bearer also accepted)
- List: `GET /agents?chain_id=56&limit=100&offset=N&sort_by=total_score&order=desc`
- **`limit` max is 100** — 101+ returns a validation error with zero items
- Chain filter is `chain_id` (56 = BSC). `chainId`/`chain`/`chain_ids` are ignored and silently return all chains
- Response: `{ items: [...], total, limit, offset }` — BSC total ≈ **289,798 agents**
- Item fields: `agent_id` ("56:contract:tokenId"), `token_id`, `chain_id`, `contract_address`,
  `owner_address`, `name`, `description`, `image_url`, `is_verified`, `star_count`,
  `supported_protocols`, `x402_supported`, `total_score`, `rank`, `health_score`,
  `total_feedbacks`, `average_score`, `created_at`, `updated_at`
- **No performance data** (no PnL/APR/win-rate/uptime) — confirms the thesis: the registry
  provides identity + feedback only; measured performance is ours to add.
- Registry is dominated by generic "trading" agents, so we fill **per-category buckets**
  instead of taking the global top-N, or the four categories come out badly unbalanced.

## BNB Chain advantages we build on (agent economics)
- Gas ~**$0.02/tx** vs ~**$1.20/tx** on Ethereum L1 (gas price fell 1 Gwei → 0.05 Gwei)
- Block time **0.45s** after the Fermi hard fork (Jan 14 2026), down from 0.75s; ~285 TPS vs ETH ~26
- Agents pay gas on every write, so gas/action decides viability → our Agent Economics panel
  shows gas-adjusted APR and break-even capital on BNB vs Ethereum.
- MegaFuel paymaster enables gasless UX; testnet Paymaster removes manual funding.

## From the TG group

## Action items — YOU (time-sensitive)
- [ ] **Apply for 8004scan Pro API key now** — upgrades processed in 1–3 day batches via the Developer Hub + Pro-Tier Upgrade Form. API base is `https://api.8004scan.io`.
- [ ] **Register = submit the form.** The submission form doubles as registration (confirmed by @gwenbnb).
- [ ] **Get tBNB** for BSC testnet (faucet, or ask @gwenbnb in TG with your address).
- [ ] When building the **ERC-8183 hire flow**, upgrade CLI: `npm install -g @bnbagent/studio-cli@0.0.13`. Min versions: **bag ≥ 0.0.13, TS SDK ≥ 0.5.1, Python SDK ≥ 0.4.3**. 0.0.13 checks the policy whitelist before the first on-chain write.

## Technical gotchas
- **Venus native BNB withdrawal fails with Altana 7702 wallets.** `vBNB.redeem()` reverts (empty data) because vBNB pays out via `.transfer()` (2300 gas stipend), too little to resolve a 7702 delegation. Only the **native BNB** market is affected — all 51 ERC-20 markets work.
  - **Design rule:** our Venus health-factor agent must use **WBNB / ERC-20 markets** (or a NativeTokenGateway where one exists), NOT direct native `vBNB` redeem. Venus already ships a NativeTokenGateway for the isolated LST pool (`0x24896601A4bf1b6a27E51Cb3eff750Bd9FE00d08`); core-pool vWBNB has none yet.
- **Altana session pattern** (from a competitor's Q to the team): scope the session to the relevant **contract + function selectors**, and enforce **argument-level constraints** (tokenId, recipient, amounts, deadlines) in the app. Sessions carry spend limits + expiry + revocation.

## Competitive / ecosystem
- **VEYRA** — a serious competitor building a production autonomous DeFi agent marketplace on BSC with ERC-8004 + Altana session delegation; already verified Altana sessions operating an existing PancakeSwap V3 position on testnet. Strong on the Altana production side. Our edge stays: verification/Reality-Gap trust layer, the drag-drop AI builder, and marketplace UX.
- **Global Score Agent** (Jair) — reputation layer for ERC-8004 agents (HUMI for agents, WAMI for controlling wallets), indexes BNB. Offered collaboration — a possible extra reputation signal for our composite score / discovery.

## Framing that matches our build (Altana workshop)
"Listing agents is the easy half. The hard half is the moment a user hands an agent money." The stack: **scoped sessions** (delegation) + **Keystore** (verification) + **ERC-8183** (hiring) + **x402** (per-call payments). This is exactly our Identity / Track Record / Rails / Trust thesis.

## Network strategy (testnet vs mainnet)
Deliberate split — do not "just move everything to testnet":
- **Market data → MAINNET always.** Binance prices + DeFiLlama APYs. Testnet has no
  real liquidity, so measuring a strategy on testnet prices would re-introduce
  fabricated numbers.
- **Agent identity + execution → TESTNET (chain 97).** Registry
  `0x8004a818bfb912233c491871b3d84c89a494bd9e`, RPC
  `https://data-seed-prebsc-1-s1.bnbchain.org:8545`, tBNB from the faucet,
  MegaFuel paymaster, Altana session keys — all without risking funds.
- **Marketplace index → both, toggleable.** Verified via 8004scan:
  - chain_id=56 → 289,798 agents, many real named DeFi agents (best Data Quality)
  - chain_id=97 → 2,001 agents, `is_testnet: true`, but mostly generic
    "studio-agent" placeholders from Agent Studio deploys
  Default browse is mainnet (`NEXT_PUBLIC_BROWSE_CHAIN` overrides).

## OPEN COMPLIANCE GAP
Rule: *"Agents surfaced on your marketplace must be live on BSC."*
Our 8 first-party agents are definitions we backtest — they are **not yet
registered on-chain**. To be strictly compliant they must be registered under
ERC-8004 on BSC testnet (`bag`/studio-cli ≥ 0.0.13), and their real token ids
stored in `Agent.onchain`. Until then they are honestly labelled, but a judge
could argue they should not be listed. THIS IS THE NEXT PRIORITY.

## Rules recap (from tracks.md)
- Main track = the **marketplace**, "not a portfolio of agents".
- Agent Diversity = all four categories **surfaced with equal depth** — it is about
  what the marketplace shows, NOT about us authoring four agents.
- Judged on Functionality, Data Quality, Agent Diversity. Phase 2 criteria redacted.
- Submission must be publicly accessible during judging; one entry per team;
  the submission form doubles as registration.
