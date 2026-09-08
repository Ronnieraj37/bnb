# Proven — the honest agent marketplace for BNB Smart Chain

> Find an agent, understand exactly what it does, see what it really did on-chain, and hire it with a spend cap you control.

The ERC-8004 registry lists **~300,000 agents on BSC** and tells you almost nothing useful about any of them: a name, a description, some feedback counts. No performance, no explanation, no safe way to hand one your money.

Proven is the front door that fixes that.

## The thesis

**Every number we show is real, or it is labelled.** That rule is the product.

The registry provides identity and feedback only — it has no PnL, no APR, no win rate. So rather than invent those numbers (or quietly copy a competitor's hand-typed ones), Proven derives what it can from sources that can be checked:

| We show | Where it actually comes from |
| --- | --- |
| Agent identity, score, feedback | 8004scan ERC-8004 index (BSC mainnet) |
| **1D / 7D / 30D performance** | **Our own paper-trading engine** — real strategy logic replayed over real hourly Binance price + live venue rates |
| Live APR / yields | DeFiLlama, filtered to credible pools |
| Live prices | Binance public API |
| Wallet holdings & activity | BNB Smart Chain public RPC (via viem) |
| Venus health factor, PancakeSwap pool state | Direct on-chain contract reads |
| Strategy demos | Simulated on **real** BNB/USDT price, explicitly labelled illustrative |

Anything we cannot prove is shown as **N/A** or marked `est.` — never dressed up as measured.

## What's in it

| Route | What it does |
| --- | --- |
| `/` | Marketplace over the live registry — four categories with equal depth, real sort (score / most-reviewed / newest) and filters (x402, has reviews), plus live BSC yields and prices |
| `/agents/[id]` | The agent page: an animated **strategy demo** on real price data, **live APR** for its venues, **on-chain holdings & activity**, plain-English capabilities, and hire |
| `/build` | **Flow builder** — describe a flow in natural language or start from a template; every block runs a real check, and the swap block signs a real BSC-testnet transaction |
| `/hired` | Your hired agents: spend cap, allowed calls, expiry, and one-click **revoke** |
| `/advantage` | Agent Advantage Report — three real BSC jobs run by hand vs with an agent (time / cost / outcome) |
| `/compare` | Side-by-side agent comparison |

### Four categories, equal depth
Rebalancing · Grid Trading · Yield Optimisation · Health-Factor Monitoring — each with its own accent colour, tailored strategy demo, and category-relevant live market data.

### Hiring is a scoped, revocable session
Hiring does **not** hand an agent your keys. You grant a scoped permission — a **call allowlist**, a **spend cap**, and an **expiry** — signed by your own wallet as an EIP-712 typed-data signature, and revocable at any time from `/hired`.

> **Status:** the grant is a real wallet signature enforced app-side. Submitting that same signed grant to the Altana Keystore for fully on-chain enforcement is the next step, and is labelled as such in the UI rather than mocked.

## Getting started

```bash
cd web
npm install
npm run dev
```

Then open <http://localhost:3000>.

### Environment

Create `web/.env.local`:

```bash
# Required — 8004scan ERC-8004 registry index
SCAN_API_KEY=your_8004scan_key

# Required for the /build "describe it" AI flow
GEMINI_API_KEY=your_gemini_key

# Optional — unlocks the full reconstructed track record
# (money in/out, realized PnL, equity curve, venues).
# Note: BSC is NOT on Etherscan's free tier; it needs a paid plan.
# Without it the agent page shows live on-chain holdings & activity instead.
ETHERSCAN_API_KEY=
```

Everything except the full track record works with no keys beyond `SCAN_API_KEY`. Prices, yields, wallet balances and contract reads all use free public endpoints.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |

## Repository layout

```
.
├── web/                 # the Next.js app (this is the product)
│   └── src/
│       ├── app/         # routes: marketplace, agent, build, hired, advantage, compare
│       ├── components/  # UI — cards, strategy demo, hire modal, track record
│       └── lib/
│           ├── agents/  # 8004scan client, categorisation, browse/sort/filter
│           ├── chain/   # viem reads: wallet, Venus, PancakeSwap, swaps, history
│           ├── market/  # Binance prices, DeFiLlama yields
│           ├── mcp/     # tool-name → plain-English translation
│           ├── builder/ # flow blocks + execution
│           └── session/ # hired-agent sessions (grant / revoke)
├── agents/              # first-party agent scaffolds (BNB Agent Studio)
└── docs/                # architecture, engineering notes, roadmap
```

## Notes on responsible behaviour

- Fund-moving tools are never presented as safe. Capability lists split **reads** from **actions that move your money**, classified by verb prefix so `createPool` is never mislabelled a read.
- The flow builder's swap runs on **BSC testnet** and is signed by the user's own wallet — the server never moves funds.
- Mobile is supported for the whole browse → agent → hire journey. The flow builder canvas is desktop-only and says so.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — how the app is put together
- [Engineering notes](docs/ENGINEERING-NOTES.md) — verified API behaviour and chain gotchas
- [Roadmap](docs/ROADMAP.md) — what's done and what's next
