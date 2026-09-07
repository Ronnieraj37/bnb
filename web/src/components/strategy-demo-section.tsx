import type { Category } from "@/lib/agents/types";
import { walletSnapshot } from "@/lib/chain/wallet";
import { getBscPools } from "@/lib/market/data";
import { StrategyDemo } from "./strategy-demo";

// Server wrapper that grounds the (client) StrategyDemo in real data before it
// renders: the agent's real wallet size becomes the demo budget, and the yield
// demo uses real live DeFiLlama venue rates. Everything still labelled honestly
// as an illustrative simulation — the agent's exact params aren't on-chain.

function realVenues(pools: Awaited<ReturnType<typeof getBscPools>>) {
  const byProject: Record<string, string> = {
    venus: "Venus", lista: "Lista", pancakeswap: "PancakeSwap", aave: "Aave",
  };
  const best: Record<string, number> = {};
  for (const p of pools) {
    for (const key in byProject) {
      if (new RegExp(key, "i").test(p.project) && p.tvlUsd > 500_000) {
        best[byProject[key]] = Math.max(best[byProject[key]] ?? 0, p.apy);
      }
    }
  }
  return Object.entries(best)
    .map(([name, apr]) => ({ name, apr: Math.round(apr * 10) / 10 }))
    .filter((v) => v.apr > 0)
    .sort((a, b) => b.apr - a.apr)
    .slice(0, 3);
}

export async function StrategyDemoSection({
  category,
  wallet,
  venue,
}: {
  category: Category;
  wallet?: string;
  venue?: string;
}) {
  const [snap, pools] = await Promise.all([
    wallet ? walletSnapshot(wallet).catch(() => null) : Promise.resolve(null),
    category === "yield" ? getBscPools().catch(() => []) : Promise.resolve([]),
  ]);

  // Use the wallet's real portfolio as the budget when it's a meaningful size;
  // otherwise fall back to a clearly-labelled example budget.
  const realBudget = snap && snap.totalUsd >= 10 ? Math.round(snap.totalUsd) : 0;
  const yieldVenues = category === "yield" ? realVenues(pools) : undefined;

  return (
    <StrategyDemo
      category={category}
      budgetUsdt={realBudget || 500}
      budgetIsReal={realBudget > 0}
      venue={venue || "PancakeSwap v3"}
      yieldVenues={yieldVenues}
    />
  );
}
