# Architecture

Next.js (App Router) + TypeScript + Tailwind v4. Server components do the data fetching; client components handle wallet, modals and the animated demo.

## Data flow

```
8004scan  ──► lib/agents/scan.ts ──► lib/agents/index.ts ──► marketplace + agent page
DeFiLlama ──► lib/market/data.ts ──► lib/market/context.ts ─► live APR panels
Binance   ──► lib/market/data.ts ─────────────────────────► prices, strategy demo
BSC RPC   ──► lib/chain/{wallet,read}.ts ─────────────────► holdings, Venus, Pancake
Etherscan ──► lib/chain/history.ts (optional) ────────────► reconstructed track record
```

## Key modules

### `lib/agents/`
- **`scan.ts`** — the 8004scan client. The list endpoint is shallow (no capabilities/health), the detail endpoint is where the useful data lives, so agent pages always fetch detail. Includes the **category classifier**: ordered regex rules matched against name + description + protocols + tool names, keeping the matched term so the UI can show *why* an agent is in a category.
- **`index.ts`** — `browse()` with sort (`score` / `feedback` / `newest`) and filters (`x402`, `reviews`), applied server-side. Also builds the balanced per-category catalogue.

Two caches matter: a soft/hard TTL catalogue (serve slightly-stale rather than blank the marketplace when upstream search flakes) and a short-lived search memo.

### `lib/chain/`
- **`wallet.ts`** — live wallet snapshot: BNB balance, major BEP-20 holdings, tx count, EOA vs contract. Keyless.
- **`read.ts`** — real contract reads: Venus account liquidity, PancakeSwap v3 pool price, gas estimates.
- **`swap.ts`** / **`testnet-tokens.ts`** — the real BSC-testnet swap the builder executes.
- **`history.ts`** — optional Etherscan-V2 reconstruction (money in/out, realized PnL, venues, equity curve). Degrades to `null` so callers fall back to the keyless snapshot.

### `lib/paper/engine.ts`
The performance data the registry does not have. Replays each category's **real strategy logic** over ~720 hours of real Binance BNB/USDT closes plus live DeFiLlama venue rates, producing 1D / 7D / 30D returns and an annualised figure.

It is a backtest and is labelled as one everywhere it surfaces — never presented as the agent's own on-chain P&L, and never a random walk.

Two agents differ because of inputs that are genuinely theirs:
- **declared protocols** → which real pools/rates the strategy can reach;
- **real wallet size** → gas is a fixed cost per action, so capital changes the outcome.

Agents that truly share venues and capital will legitimately score the same; the panel prints those inputs so that's visible rather than looking like a bug. (This replaced a category-level APR panel that showed every agent in a category an identical number.)

Category-specific notes:
- **grid** — realized PnL from a 7-level ladder over the window.
- **rebalancing** — pool fees accrued only while in range, minus gas per reset.
- **yield** — capital at the best reachable live rate, minus rebalance gas.
- **health-factor** — *loss avoided*, not yield created. Triggers on a real drawdown from the running peak. Annualising a one-off avoided penalty is nonsense (a single 10% save extrapolates to +121%/yr), so the guard reports the actual 30-day outcome instead, and shows "Safe — no top-up needed" when nothing threatened the position.

### `lib/mcp/describe.ts`
Turns machine tool names into plain English. The read/write split is decided by **verb prefix**, not nouns — `estimateAmountsForIncreasePosition` is a read despite containing "increase"; `createPool` is fund-moving despite containing "pool". Default for anything unrecognised is **fund-moving** (fail safe).

### `lib/session/store.ts`
Hired agents. A session is an EIP-712 signature over `{agent, owner, allow[], spendCap, expiry}`, persisted in `localStorage` and broadcast via a `proven:hired-changed` event so the header badge, agent page and `/hired` stay in sync. Revoke removes it.

## UI conventions

- **`.card` / `.card-hover`** — the elevated surface used everywhere. Replaced the earlier translucent "glass" on content, which muddied over a busy background.
- **`.reveal`** — entrance animation in **pure CSS**, deliberately not JS. An earlier framer-motion `whileInView` version left whole sections stuck at `opacity: 0` whenever the IntersectionObserver didn't fire. Content must never depend on JS to become visible.
- **Category accents** live in `lib/agents/types.ts` (`CATEGORIES[x].accent`) and drive card edges, pills and hero glows.
- **`CountUp`** animates with rAF but has a guaranteed `setTimeout` settle, because rAF is paused on hidden tabs and the number must never be stuck at 0.

## Gotchas worth knowing

- **Modals must be portalled.** The agent hero is a `card` with `overflow-hidden` inside an animated (transformed) wrapper. A transformed ancestor becomes the containing block for `position: fixed`, which trapped the hire popup inside that card. `hire-button.tsx` renders through `createPortal(..., document.body)`.
- **Don't call `Date.now()` during render.** The project's ESLint enforces `react-hooks/purity`; read the clock in effects/handlers (or a module-scope helper) and keep it in state.
- **Avoid `rAF` for state that must load in a background tab** — use `setTimeout`.
- DeFiLlama returns genuinely real but degenerate pools (900%+ APR farms). Yield surfaces filter to deep pools with credible rates so the numbers stay believable as well as true.
