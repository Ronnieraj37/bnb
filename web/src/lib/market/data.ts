// Real market data. No keys required, both endpoints are public.
//   Binance klines  -> real OHLC price history for BNB / CAKE / BTCB / ETH
//   DeFiLlama yields -> real, current APYs for BSC lending & LP pools
//
// Everything the marketplace reports is computed from these. We do not
// synthesise prices or returns anywhere.

export type Candle = { t: number; o: number; h: number; l: number; c: number };

const BINANCE = "https://api.binance.com/api/v3/klines";
const LLAMA = "https://yields.llama.fi/pools";

export const SYMBOL: Record<string, string> = {
  BNB: "BNBUSDT",
  CAKE: "CAKEUSDT",
  BTCB: "BTCUSDT",
  ETH: "ETHUSDT",
};

const BARS_PER_DAY: Record<string, number> = { "1h": 24, "4h": 6, "1d": 1 };

/**
 * Real OHLC candles from Binance. `days` of bars at `interval` (default 4h).
 * Use "1h" when a strategy needs intra-day resolution — e.g. paper-trading a
 * 1-day window, where 4h bars give only six data points.
 */
export async function getCandles(asset: string, days = 60, interval: "1h" | "4h" | "1d" = "4h"): Promise<Candle[]> {
  const symbol = SYMBOL[asset] ?? SYMBOL.BNB;
  const limit = Math.min(1000, Math.ceil(days * (BARS_PER_DAY[interval] ?? 6)));
  const url = `${BINANCE}?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`binance ${res.status}`);

  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    t: Number(k[0]),
    o: Number(k[1]),
    h: Number(k[2]),
    l: Number(k[3]),
    c: Number(k[4]),
  }));
}

export type Pool = {
  project: string;
  symbol: string;
  apy: number;
  apyBase: number;
  tvlUsd: number;
};

// DeFiLlama's /pools payload covers every chain and is ~15MB — over Next's
// 2MB fetch-cache ceiling, so `next: { revalidate }` silently fails to cache
// it and every call re-fetches the full 15MB. Cache the filtered (BSC-only)
// result ourselves instead; `cache: "no-store"` skips Next's cache entirely
// rather than logging a failed-cache-set warning on every request.
const store = globalThis as typeof globalThis & { __provenPoolsCache?: { at: number; value: Pool[] } };
const POOLS_TTL_MS = 30 * 60_000;

/** Real current APYs for BSC pools, filtered to the protocols our agents use. */
export async function getBscPools(): Promise<Pool[]> {
  const cached = store.__provenPoolsCache;
  if (cached && Date.now() - cached.at < POOLS_TTL_MS) return cached.value;

  const res = await fetch(LLAMA, { cache: "no-store" });
  if (!res.ok) throw new Error(`defillama ${res.status}`);

  const json = (await res.json()) as { data: (Pool & { chain: string })[] };
  const pools = json.data
    .filter((p) => p.chain === "BSC")
    .filter((p) => /pancakeswap|venus|lista|aave/i.test(p.project))
    .map((p) => ({
      project: p.project,
      symbol: p.symbol,
      apy: p.apy ?? 0,
      apyBase: p.apyBase ?? 0,
      tvlUsd: p.tvlUsd ?? 0,
    }))
    .sort((a, b) => b.tvlUsd - a.tvlUsd);

  store.__provenPoolsCache = { at: Date.now(), value: pools };
  return pools;
}

/** Best real APY among pools matching a protocol filter. */
export function bestApy(pools: Pool[], match: RegExp): Pool | undefined {
  return pools
    .filter((p) => match.test(p.project) && p.tvlUsd > 100_000)
    .sort((a, b) => b.apy - a.apy)[0];
}
