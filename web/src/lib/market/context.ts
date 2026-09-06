import { getBscPools, type Pool } from "./data";
import type { Category } from "@/lib/agents/types";

// Category-specific market context. An agent's page should tell you not just
// what the agent is, but what it would be working with right now — the real
// live rates on the venues its category operates on.

export type MarketContext = {
  heading: string;
  note: string;
  pools: Pool[];
};

const FILTERS: Record<Category, { match: RegExp; heading: string; note: string }> = {
  "health-factor": {
    match: /venus|aave/i,
    heading: "Lending markets it would protect",
    note: "Live supply APYs on the BSC lending markets where liquidations happen.",
  },
  yield: {
    match: /venus|lista|aave|pancakeswap/i,
    heading: "Best yields available right now",
    note: "What a yield router on BSC is choosing between today.",
  },
  rebalancing: {
    match: /pancakeswap/i,
    heading: "Pools it would manage",
    note: "Fee APYs on the PancakeSwap pools a range manager would sit in.",
  },
  grid: {
    match: /pancakeswap/i,
    heading: "Venues it would trade on",
    note: "The PancakeSwap pools a grid strategy would route orders through.",
  },
};

export async function marketContext(category: Category): Promise<MarketContext | null> {
  try {
    const all = await getBscPools();
    const f = FILTERS[category];
    const pools = all
      .filter((p) => f.match.test(p.project) && p.tvlUsd > 500_000)
      .sort((a, b) => b.apy - a.apy)
      .slice(0, 5);
    if (!pools.length) return null;
    return { heading: f.heading, note: f.note, pools };
  } catch {
    return null; // context is a bonus; never break the page for it
  }
}
