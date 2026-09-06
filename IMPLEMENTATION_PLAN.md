# Proven — the verified BNB agent marketplace

> Working name: **Proven** (changeable). Tagline: *Hire agents with a track record you can trust.*

## The thesis (why we win)

The ERC-8004 registry only stores **identity + client feedback** — it has **no real performance data** (no win rate, PnL, uptime). Every lazy team will wrap 8004scan and show shallow cards. We win by:

1. **Index for breadth** — pull every relevant agent from the **8004scan API** (all 4 categories, real, live on BSC).
2. **Measure for depth** — run agents forward in a **paper-trade/verification engine** to produce the performance data the chain lacks. This is the "Data Quality beyond basic counts" moat.
3. **Explain** — a read-only **pipeline visualizer** so a non-coder understands what each agent does.
4. **Hire safely** — one-click hire with an **Altana session key** (scope auto-derived from the agent, spend cap, expiry, one-click revoke).

Main track = the marketplace. We seed 4 of our own agents (built from Altana skills) for coverage + partner bounties (Altana, PancakeSwap, TermiX).

## Scope decision: own vs third-party agents

- Surface **third-party** agents via 8004scan (breadth, "live on BSC", diversity).
- Build **4 own agents** (one per vertical) from Altana's 10 composable skills — for guaranteed depth, Altana session-key demo, TermiX hiring, PancakeSwap benefit.

## The 4 verticals → Altana skills

| Vertical | Altana skill(s) | Data source | Execution |
|---|---|---|---|
| Health Factor | Venus Lending, Aave V3 Lending | Venus `Comptroller.getAccountLiquidity`, PoolLens | Gelato liquidation-protection |
| Yield | Venus, Lista Liquid Staking, Aave V3 | DeFiLlama yields API | direct / Gelato |
| Grid | PancakeSwap Trading | PancakeSwap subgraph + price | PancakeSwap native limit orders (Gelato) |
| Rebalancing | PancakeSwap Liquidity | PancakeSwap v3 positions | Gelato liquidity mgmt (must beat built-in Position Manager) |

## Architecture (lean — "less but optimized code")

Single **Next.js (latest, App Router, TS, Tailwind)** app. No separate backend for MVP.

```
web/
  src/
    app/                      # routes (App Router, RSC by default)
      page.tsx                # marketplace home: 4 categories + agent grid
      agents/[id]/page.tsx    # agent detail: pipeline viz + performance + hire
      api/                    # route handlers (thin server layer)
        agents/route.ts       # list/query agents (8004scan adapter)
    lib/
      agents/
        types.ts              # Agent, Category, Metrics, Reputation
        source.ts             # AgentSource interface
        scan-source.ts        # 8004scan adapter (live)
        mock-source.ts        # typed mock (works w/o API key; same shape)
        index.ts              # getAgents()/getAgent() — picks source by env
      score.ts                # composite VerifiedScore (feedback + measured perf)
      data/                   # DeFiLlama, Venus, PancakeSwap fetchers
    components/
      agent-card.tsx
      category-nav.tsx
      score-badge.tsx
      pipeline/               # React Flow read-only visualizer (from Arbitrax)
```

Data adapter pattern → runs on typed mock now, flips to live 8004scan by setting an env key. No code churn.

## Data sources

- Agents: **8004scan API** (free hackathon Pro tier) — identity, capability, reputation, feedback.
- Performance: **our paper-trade engine** (ported from Arbitrax).
- Yields: **DeFiLlama** `yields.llama.fi`. Health: **Venus** PoolLens. LP: **PancakeSwap** subgraph. Prices: Chainlink/Pyth.
- Hire/pay: **Altana ERC-8183 SDK**, **x402 server SDK**. Automation: **Gelato**.

## Build phases

- **P1 (now):** Scaffold + marketplace home + agent data layer (mock→live adapter) + agent cards w/ VerifiedScore + 4-category browse.
- **P2:** Agent detail = pipeline visualizer + performance chart + risk labels.
- **P3:** Hire flow w/ Altana session key (scope/cap/expiry) + revoke control.
- **P4:** Paper-trade/verification engine + real-time DeFi data wiring.
- **P5:** 4 seeded agents (Altana skills) live on BSC testnet + Agent Advantage Report (TermiX).
- **P6:** Fork-and-extend builder + Topology-A deploy (stretch).

## Stack

Next.js latest · React · Tailwind · @xyflow/react (pipeline) · lightweight charts · viem/wagmi (wallet) · Altana SDK. npm, unpinned (always latest).
