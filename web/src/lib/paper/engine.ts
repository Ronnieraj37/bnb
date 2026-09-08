// Paper-trading engine — the performance data the registry does not have.
//
// ERC-8004 stores identity and feedback only: no PnL, no APR, no win rate. So
// we generate it ourselves the only honest way — by running each category's
// REAL strategy logic over REAL hourly Binance price history and REAL live
// DeFiLlama pool rates, then reporting 1D / 7D / 30D outcomes.
//
// This is a backtest, and it is labelled as one everywhere it surfaces. It is
// NOT the agent's own on-chain P&L, and it is NOT a random walk — an earlier
// seeded-random `simulate.ts` was deleted from this project for pretending to
// be a paper trade, and nothing here may repeat that.
//
// What makes two agents differ (rather than every agent in a category showing
// an identical number, which was the bug this replaces):
//   • the venues the agent actually declares  -> different real pool APRs
//   • the agent's real wallet size            -> different gas drag, since gas
//                                                is a fixed cost per action
// Agents that genuinely declare the same venues and hold the same capital will
// legitimately score the same, and that is the honest answer.

import { getCandles, getBscPools, type Pool } from "@/lib/market/data";
import type { Category } from "@/lib/agents/types";

const GAS_USD = 0.02; // ~$0.02 per tx on BNB Chain
const HOURS_PER_YEAR = 8760;

export type WindowKey = "d1" | "d7" | "d30";
export const WINDOW_HOURS: Record<WindowKey, number> = { d1: 24, d7: 168, d30: 720 };
export const WINDOW_LABEL: Record<WindowKey, string> = { d1: "1D", d7: "7D", d30: "30D" };

export type WindowResult = { returnPct: number; actions: number };

export type PaperResult = {
  asset: string;
  capitalUsd: number;
  venues: string[];
  baseAprPct: number | null; // the live venue APR the strategy earns on, if any
  windows: Record<WindowKey, WindowResult>;
  /** Annualised from the 30-day window. */
  aprPct: number;
  headline: string;
  method: string;
  caveats: string[];
  candles: number;
};

/** Pick the real pools this specific agent could actually route to. */
function venuesFor(protocols: string[], pools: Pool[]) {
  const known = ["venus", "lista", "pancakeswap", "aave"];
  const declared = known.filter((k) => protocols.some((p) => new RegExp(k, "i").test(p)));
  const use = declared.length ? declared : known;
  const matched = pools.filter(
    (p) => use.some((k) => new RegExp(k, "i").test(p.project)) && p.tvlUsd > 1_000_000 && p.apy > 0 && p.apy < 40,
  );
  const best = matched.sort((a, b) => b.apy - a.apy)[0] ?? null;
  const names = [...new Set(matched.map((p) => p.project))].slice(0, 3);
  return { best, names, declaredVenues: declared };
}

// ── strategies (all operate on a real hourly close series) ──────────────────

/** Grid: buy each level crossed downward, sell it one level higher. */
function runGrid(prices: number[], capital: number) {
  if (prices.length < 3) return { returnPct: 0, actions: 0 };
  const lo = Math.min(...prices), hi = Math.max(...prices);
  if (hi <= lo) return { returnPct: 0, actions: 0 };
  const LEVELS = 7;
  const step = (hi - lo) / (LEVELS - 1);
  const levels = Array.from({ length: LEVELS }, (_, i) => lo + i * step);
  const mid = (lo + hi) / 2;
  const perLevel = capital / Math.max(1, levels.filter((l) => l < mid).length);
  const held: Record<number, number> = {};
  let realized = 0, actions = 0;

  for (let n = 1; n < prices.length; n++) {
    const prev = prices[n - 1], p = prices[n];
    levels.forEach((L, i) => {
      if (prev > L && p <= L && L < mid && !held[i]) {
        held[i] = perLevel / L; actions++; realized -= GAS_USD;
      }
      if (prev < L && p >= L && held[i - 1]) {
        const amt = held[i - 1]; delete held[i - 1];
        realized += step * amt - GAS_USD; actions++;
      }
    });
  }
  return { returnPct: (realized / capital) * 100, actions };
}

/** Rebalancing LP: earn pool fees only while price sits inside the range. */
function runRange(prices: number[], capital: number, apyPct: number) {
  if (prices.length < 3) return { returnPct: 0, actions: 0 };
  const width = (Math.max(...prices) - Math.min(...prices)) * 0.35 || prices[0] * 0.05;
  let lo = prices[0] - width / 2, hi = prices[0] + width / 2;
  let inRange = 0, resets = 0;
  for (let n = 1; n < prices.length; n++) {
    const p = prices[n];
    if (p < lo || p > hi) { lo = p - width / 2; hi = p + width / 2; resets++; }
    else inRange++;
  }
  const feeUsd = capital * (apyPct / 100) * (inRange / HOURS_PER_YEAR);
  const gas = resets * 2 * GAS_USD; // remove + re-add liquidity
  return { returnPct: ((feeUsd - gas) / capital) * 100, actions: resets };
}

/** Yield: capital parked at the best real rate the agent can reach. */
function runYield(hours: number, capital: number, apyPct: number) {
  const gross = capital * (apyPct / 100) * (hours / HOURS_PER_YEAR);
  const switches = Math.max(1, Math.round(hours / 168)); // reassess weekly
  return { returnPct: ((gross - switches * GAS_USD) / capital) * 100, actions: switches };
}

/**
 * Health-factor guard: this strategy does not seek yield, it avoids a loss.
 * We count how often a falling market would have pushed the position to the
 * repay trigger, and price the outcome as the liquidation penalty avoided.
 */
function runGuard(prices: number[], capital: number) {
  if (prices.length < 3) return { returnPct: 0, actions: 0 };
  const DRAWDOWN = 0.06; // collateral fall that pushes HF to the repay trigger
  const PENALTY = 0.10;  // Venus liquidation incentive, ~10%
  let peak = prices[0], repays = 0;
  for (let n = 1; n < prices.length; n++) {
    const p = prices[n];
    if (p > peak) { peak = p; continue; }
    // a real drawdown from the running peak — the guard tops up and the
    // reference resets, so a long slide triggers repeatedly rather than once.
    if (p < peak * (1 - DRAWDOWN)) { repays++; peak = p; }
  }
  const avoided = repays * capital * PENALTY;
  const gas = repays * GAS_USD;
  return { returnPct: ((avoided - gas) / capital) * 100, actions: repays };
}

export async function paperTrade(opts: {
  category: Category;
  protocols: string[];
  capitalUsd: number;
}): Promise<PaperResult | null> {
  const asset = "BNB";
  const [candles, pools] = await Promise.all([
    getCandles(asset, 31, "1h").catch(() => []),
    getBscPools().catch(() => [] as Pool[]),
  ]);
  if (candles.length < 48) return null;

  const closes = candles.map((c) => c.c);
  const { best, names, declaredVenues } = venuesFor(opts.protocols, pools);
  const apy = best?.apy ?? 0;
  // Capital: the agent's real wallet where meaningful, else a stated $1,000
  // baseline. Gas is a fixed cost, so this genuinely changes the outcome.
  const capital = opts.capitalUsd >= 50 ? opts.capitalUsd : 1000;

  const slice = (h: number) => closes.slice(Math.max(0, closes.length - h));

  const run = (h: number): WindowResult => {
    const p = slice(h);
    switch (opts.category) {
      case "grid": return runGrid(p, capital);
      case "rebalancing": return runRange(p, capital, apy);
      case "yield": return runYield(Math.min(h, p.length), capital, apy);
      case "health-factor": return runGuard(p, capital);
    }
  };

  const windows = {
    d1: run(WINDOW_HOURS.d1),
    d7: run(WINDOW_HOURS.d7),
    d30: run(WINDOW_HOURS.d30),
  } as Record<WindowKey, WindowResult>;

  const aprPct = windows.d30.returnPct * (365 / 30);

  const headline: Record<Category, string> = {
    grid: "Realized from buying dips and selling rallies across a 7-level ladder.",
    rebalancing: "Pool fees earned while in range, minus the gas of each range reset.",
    yield: "Capital parked at the best rate this agent's venues actually offer, net of gas.",
    "health-factor": "Liquidation penalty avoided by topping up before the position slipped.",
  };

  const caveats = [
    `Paper-traded by Proven on ${candles.length} hours of real ${asset}/USDT price from Binance.`,
    `Gas charged at $${GAS_USD.toFixed(2)} per action (BNB Chain).`,
    opts.capitalUsd >= 50
      ? `Sized on this agent's real wallet (${fmtUsd(capital)}).`
      : `Sized on a stated ${fmtUsd(capital)} baseline — this agent's wallet is too small to model.`,
  ];
  if (apy > 0) caveats.push(`Venue rate uses today's live ${best!.project} APR (${apy.toFixed(2)}%) held constant — we have no historical APR series.`);
  if (opts.category === "health-factor") caveats.push("Framed as loss avoided, not yield created.");
  if (!declaredVenues.length) caveats.push("This agent declares no protocols, so all major BSC venues were considered.");

  return {
    asset,
    capitalUsd: capital,
    venues: names,
    baseAprPct: apy || null,
    windows,
    aprPct,
    headline: headline[opts.category],
    method: "Real strategy logic replayed over real market data — not the agent's own on-chain P&L.",
    caveats,
    candles: candles.length,
  };
}

function fmtUsd(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
}
