import Link from "next/link";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { getBscPools, getCandles } from "@/lib/market/data";

// The one thing a directory of agents can't give you: the real numbers those
// agents would act on, right now, without clicking into any of them or
// leaving the site to check DeFiLlama/Binance yourself.

async function priceChange(asset: string) {
  const candles = await getCandles(asset, 2);
  if (candles.length < 7) return null;
  const last = candles[candles.length - 1];
  const prior = candles[candles.length - 7]; // 4h bars, 6 back = ~24h
  return { price: last.c, pct: ((last.c - prior.c) / prior.c) * 100 };
}

export async function LivePulse() {
  const [pools, bnb, cake] = await Promise.all([
    getBscPools().catch(() => []),
    priceChange("BNB").catch(() => null),
    priceChange("CAKE").catch(() => null),
  ]);

  const topYields = pools
    .filter((p) => p.tvlUsd > 500_000)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 3);

  if (!topYields.length && !bnb && !cake) return null;

  return (
    <section className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Best BSC yields right now</h2>
          <Link href="/build" className="flex shrink-0 items-center gap-1 text-[12px] text-violet transition hover:underline">
            Build a flow around this <ArrowRight size={12} />
          </Link>
        </div>
        {topYields.length ? (
          <div className="mt-3 flex flex-col gap-2">
            {topYields.map((p) => (
              <div key={`${p.project}-${p.symbol}`} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-fg">{p.symbol}</span>
                  <span className="ml-2 truncate text-[12px] text-muted">{p.project}</span>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-pos">{p.apy.toFixed(2)}%</div>
                  <div className="text-[11px] text-muted">${(p.tvlUsd / 1e6).toFixed(1)}M TVL</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-muted">Yield data is temporarily unavailable.</p>
        )}
        <p className="mt-2 text-[11px] text-muted">Live from DeFiLlama — the same feed the flow builder reads.</p>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Live prices</h2>
        <div className="mt-3 flex flex-col gap-2">
          {([["BNB", bnb], ["CAKE", cake]] as const).map(([label, d]) =>
            d ? (
              <div key={label} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                <span className="font-medium text-fg">{label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">${d.price.toFixed(2)}</span>
                  <span className={`flex items-center gap-0.5 text-[12px] ${d.pct >= 0 ? "text-pos" : "text-neg"}`}>
                    {d.pct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {Math.abs(d.pct).toFixed(2)}%
                  </span>
                </div>
              </div>
            ) : null,
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted">24h change, from Binance.</p>
      </div>
    </section>
  );
}

export function LivePulseSkeleton() {
  return (
    <section className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="h-40 animate-pulse rounded-2xl glass" />
      <div className="h-40 animate-pulse rounded-2xl glass" />
    </section>
  );
}
