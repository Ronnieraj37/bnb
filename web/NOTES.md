
## Data integrity rules (do not break these)
The whole pitch is "we measure, we don't trust claims". So:
- **No fabricated numbers, ever.** The old `simulate.ts` was a seeded random walk
  (`mulberry32(hash(agent.id))`) presented as a "forward paper-trade" result. Deleted.
- Every displayed figure comes from `lib/verify/backtest.ts` executing real strategy
  logic over **real Binance 4h candles** and **live DeFiLlama BSC APYs**.
- Registry agents from 8004scan have **no `metrics` object at all** — the UI renders
  "No track record" instead of zeros. They can never outrank a measured agent.
- Metrics that are structurally meaningless are **not shown**:
  a grid's closed trades are profitable by construction (win rate always 100%),
  and yield/range "trades" are gas costs, not wins. `winRateInformative` gates this.
- Every result carries `caveats[]` explaining how to read the headline
  (e.g. the health guard's return is the leveraged position moving with the market,
  not something the agent created).
- Unbuilt things say so: the Altana session-key grant and CLI deploy are labelled
  "not wired yet" rather than mocked.

## Builder block rules
- Each `NodeDef` declares `requires` (wallet / Telegram chat id / Discord webhook / URL)
  and `writes` (costs gas). Nodes missing a requirement render "needs setup" and the
  canvas shows a "Before this can run" summary.
- The intent engine names protocols it cannot support instead of substituting
  (asking for Uniswap says so; it does not silently give you Venus).
