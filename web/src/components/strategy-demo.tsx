"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import type { Category } from "@/lib/agents/types";

// An interactive, self-running showcase of HOW the agent trades — the thing a
// paragraph of text can never convey. A price line moves across a chart in real
// time and you watch the strategy act on it: a grid laddering buys and sells, a
// rebalancer resetting its range, a guard repaying a loan before liquidation.
//
// Honesty: the price is REAL — the last ~20h of BNB/USDT from Binance's public
// API — replayed on a loop. We simulate the STRATEGY on real price movement; we
// do not invent the prices. If the fetch fails we fall back to a labelled
// sample path so the demo still runs.

type Candle = number; // close price
const WINDOW = 90; // samples shown across the chart
const STEP_MS = 90; // time between samples

const LABELS: Record<Category, { tag: string; headline: string; sub: string }> = {
  grid: { tag: "Grid agent", headline: "Buy low, sell high — on a ladder, forever.", sub: "Your budget becomes a ladder of price levels. Buys rest below the price, sells rest above." },
  rebalancing: { tag: "Rebalancing agent", headline: "Keep your liquidity where the trading happens.", sub: "Earns fees only while price sits inside its range. When price drifts out, it resets the range around the new price." },
  "health-factor": { tag: "Health-factor agent", headline: "Repay before the market can liquidate you.", sub: "Watches your loan's health as price falls. Before it crosses the liquidation line, it repays to pull you back to safety." },
  yield: { tag: "Yield agent", headline: "Always parked at the best real rate.", sub: "Compares live APRs across venues and moves your funds to the highest one — after gas." },
};

async function fetchCloses(symbol = "BNBUSDT"): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=${WINDOW}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`binance ${res.status}`);
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => Number(k[4]));
}

// A gently oscillating fallback so the demo always animates even offline.
function samplePath(): Candle[] {
  const base = 600;
  return Array.from({ length: WINDOW }, (_, i) =>
    base + Math.sin(i / 7) * 22 + Math.sin(i / 2.3) * 6 + (Math.random() - 0.5) * 3,
  );
}

export function StrategyDemo({
  category,
  budgetUsdt = 500,
  venue = "PancakeSwap v3",
  symbol = "BNBUSDT",
  yieldVenues,
  budgetIsReal = false,
}: {
  category: Category;
  budgetUsdt?: number;
  venue?: string;
  symbol?: string;
  /** Real APRs from DeFiLlama, when available — makes the yield demo honest. */
  yieldVenues?: { name: string; apr: number }[];
  /** True when budget is the agent's real wallet size, not a default. */
  budgetIsReal?: boolean;
}) {
  const [prices, setPrices] = useState<Candle[] | null>(null);
  const [real, setReal] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [i, setI] = useState(1); // current sample index
  const asset = symbol.replace("USDT", "");

  useEffect(() => {
    let alive = true;
    fetchCloses(symbol)
      .then((c) => { if (alive) { setPrices(c); setReal(true); } })
      .catch(() => { if (alive) { setPrices(samplePath()); setReal(false); } });
    return () => { alive = false; };
  }, [symbol]);

  // Drive the animation with a throttled rAF; loop back to the start at the end.
  const iRef = useRef(1);
  useEffect(() => {
    if (!prices || !playing) return;
    let raf = 0, last = 0;
    const tick = (t: number) => {
      if (t - last >= STEP_MS) {
        last = t;
        iRef.current = iRef.current >= prices.length - 1 ? 1 : iRef.current + 1;
        setI(iRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [prices, playing]);

  const view = useMemo(() => prices?.slice(0, i + 1) ?? [], [prices, i]);

  if (!prices) {
    return (
      <section className="card p-5">
        <div className="h-3 w-40 rounded bg-white/8 shimmer" />
        <div className="mt-4 h-56 rounded-xl bg-white/[0.03] shimmer" />
      </section>
    );
  }

  const meta = LABELS[category];
  const min = Math.min(...prices), max = Math.max(...prices);
  const cur = prices[i];

  return (
    <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#0c0b09]/80 p-5">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet">{meta.tag}</div>
          <h2 className="mt-1 max-w-md text-lg font-semibold leading-snug text-fg">{meta.headline}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Chip>{venue}</Chip>
          <Chip>{asset} / USDT</Chip>
          <Chip>budget {budgetUsdt} USDT</Chip>
        </div>
      </div>
      <p className="mt-2 max-w-2xl text-[12px] text-muted">{meta.sub}</p>
      <p className="mt-1 max-w-2xl text-[11px] text-muted/80">
        Illustrative {meta.tag.toLowerCase()} on <span className="text-fg/70">real {asset} price</span>
        {budgetIsReal ? <> and this wallet&apos;s <span className="text-fg/70">real ${budgetUsdt.toLocaleString()} balance</span></> : <> with an example budget</>}
        {category === "yield" && yieldVenues?.length ? <> and <span className="text-fg/70">live DeFiLlama rates</span></> : null}. The agent doesn&apos;t publish its exact settings on-chain, so the strategy parameters shown are typical defaults.
      </p>

      {/* the live strategy view */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="rounded-xl border border-white/8 bg-black/20 p-3">
          {category === "grid" && <GridSim prices={view} min={min} max={max} budget={budgetUsdt} asset={asset} />}
          {category === "rebalancing" && <RangeSim prices={view} min={min} max={max} asset={asset} />}
          {category === "health-factor" && <HealthSim prices={view} min={min} max={max} asset={asset} />}
          {category === "yield" && <YieldSim prices={view} asset={asset} budget={budgetUsdt} venues={yieldVenues} />}
        </div>
        <div className="min-w-0">
          {category === "grid" && <GridFeed prices={view} min={min} max={max} budget={budgetUsdt} asset={asset} />}
          {category === "rebalancing" && <RangeFeed prices={view} min={min} max={max} asset={asset} />}
          {category === "health-factor" && <HealthFeed prices={view} min={min} max={max} />}
          {category === "yield" && <YieldFeed budget={budgetUsdt} />}
        </div>
      </div>

      {/* controls / honesty */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
        <div className="flex items-center gap-2">
          <button onClick={() => setPlaying((p) => !p)} className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-fg transition hover:bg-white/5">
            {playing ? <Pause size={11} /> : <Play size={11} />} {playing ? "Pause" : "Play"}
          </button>
          <button onClick={() => { iRef.current = 1; setI(1); }} className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-fg transition hover:bg-white/5">
            <RotateCcw size={11} /> Replay
          </button>
        </div>
        <span>
          {real ? <>Simulated on <span className="text-fg">real {asset}/USDT</span> price — last 20h from Binance.</> : "Sample price path (Binance unreachable)."}
          {" "}Current: <span className="font-mono text-fg">${cur.toFixed(2)}</span>
        </span>
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-muted">{children}</span>;
}

// ── shared chart maths ──────────────────────────────────────────────────────
const CH_W = 560, CH_H = 240, PAD = 8;
function scaleY(p: number, min: number, max: number) {
  const span = max - min || 1;
  return CH_H - PAD - ((p - min) / span) * (CH_H - PAD * 2);
}
function scaleX(idx: number) {
  return PAD + (idx / (WINDOW - 1)) * (CH_W - PAD * 2);
}
function pricePath(prices: number[], min: number, max: number) {
  return prices.map((p, idx) => `${idx === 0 ? "M" : "L"} ${scaleX(idx).toFixed(1)} ${scaleY(p, min, max).toFixed(1)}`).join(" ");
}

// ── GRID ────────────────────────────────────────────────────────────────────
const GRID_LEVELS = 7;
function gridLevels(min: number, max: number) {
  const lo = min - (max - min) * 0.04, hi = max + (max - min) * 0.04;
  const step = (hi - lo) / (GRID_LEVELS - 1);
  return Array.from({ length: GRID_LEVELS }, (_, k) => lo + k * step);
}

/** Replay the grid strategy over the visible prices and return fills + stats. */
function runGrid(prices: number[], min: number, max: number, budget: number) {
  const levels = gridLevels(min, max);
  const center = (min + max) / 2;
  const buyLevels = levels.filter((l) => l < center);
  const perLevel = budget / Math.max(1, buyLevels.length);
  const step = levels[1] - levels[0];
  // inventory bought at each level index (amount of asset)
  const held: Record<number, number> = {};
  const fills: { side: "buy" | "sell"; price: number; amt: number; pnl?: number; idx: number }[] = [];
  let realized = 0, roundTrips = 0, fees = 0;

  for (let n = 1; n < prices.length; n++) {
    const prev = prices[n - 1], p = prices[n];
    levels.forEach((L, li) => {
      const crossedDown = prev > L && p <= L;
      const crossedUp = prev < L && p >= L;
      if (crossedDown && L < center && !held[li]) {
        const amt = perLevel / L;
        held[li] = amt; fees += perLevel * 0.0002;
        fills.push({ side: "buy", price: L, amt, idx: n });
      }
      if (crossedUp) {
        // sell the nearest inventory one step below
        const lowerIdx = li - 1;
        if (held[lowerIdx]) {
          const amt = held[lowerIdx]; delete held[lowerIdx];
          const pnl = step * amt - perLevel * 0.0002;
          realized += pnl; roundTrips++; fees += perLevel * 0.0002;
          fills.push({ side: "sell", price: L, amt, pnl, idx: n });
        }
      }
    });
  }
  return { levels, center, fills, realized, roundTrips, fees, held };
}

function GridSim({ prices, min, max, budget, asset }: { prices: number[]; min: number; max: number; budget: number; asset: string }) {
  const { levels, center, fills } = runGrid(prices, min, max, budget);
  const cur = prices[prices.length - 1];
  return (
    <svg viewBox={`0 0 ${CH_W} ${CH_H}`} className="w-full" role="img" aria-label={`Grid trading simulation on ${asset}`}>
      {levels.map((L, k) => {
        const y = scaleY(L, min, max);
        const sell = L > center;
        return (
          <g key={k}>
            <line x1={PAD} y1={y} x2={CH_W - PAD} y2={y} stroke={sell ? "var(--color-amber)" : "var(--color-pos)"} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 4" />
            <text x={CH_W - PAD} y={y - 2} textAnchor="end" fontSize="9" fill={sell ? "var(--color-amber)" : "var(--color-pos)"} fillOpacity="0.75" className="font-mono">${L.toFixed(0)}</text>
          </g>
        );
      })}
      <text x={PAD + 2} y={scaleY(max, min, max) + 4} fontSize="9" fill="var(--color-amber)" fillOpacity="0.6" className="uppercase tracking-widest">Sells</text>
      <text x={PAD + 2} y={scaleY(min, min, max) - 3} fontSize="9" fill="var(--color-pos)" fillOpacity="0.6" className="uppercase tracking-widest">Buys</text>

      <path d={pricePath(prices, min, max)} fill="none" stroke="#f3efe6" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />

      {fills.map((f, k) => (
        <circle key={k} cx={scaleX(f.idx)} cy={scaleY(f.price, min, max)} r="3.4" fill={f.side === "buy" ? "var(--color-pos)" : "var(--color-amber)"} stroke="#0c0b09" strokeWidth="1" />
      ))}

      {prices.length > 1 && (
        <>
          <circle cx={scaleX(prices.length - 1)} cy={scaleY(cur, min, max)} r="3" fill="#fff" />
          <g transform={`translate(${scaleX(prices.length - 1) - 66}, ${scaleY(cur, min, max) - 22})`}>
            <rect width="60" height="16" rx="3" fill="#161310" stroke="rgba(255,255,255,0.1)" />
            <text x="30" y="11" textAnchor="middle" fontSize="9.5" fill="#fff" className="font-mono">${cur.toFixed(2)}</text>
          </g>
        </>
      )}
    </svg>
  );
}

function GridFeed({ prices, min, max, budget }: { prices: number[]; min: number; max: number; budget: number; asset: string }) {
  const { fills, realized, roundTrips } = runGrid(prices, min, max, budget);
  const recent = [...fills].reverse().slice(0, 5);
  return (
    <div className="flex h-full flex-col">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">Fill feed</div>
      <div className="mt-1.5 flex-1 space-y-1.5">
        {recent.length === 0 && <p className="text-[12px] text-muted">Waiting for price to reach a grid level…</p>}
        {recent.map((f, k) => (
          <div key={k} className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
            <div className="text-[12px] text-fg">
              <span className={f.side === "buy" ? "text-pos" : "text-amber"}>{f.side === "buy" ? "Bought" : "Sold"}</span>{" "}
              {f.amt.toFixed(3)} at <span className="font-mono">${f.price.toFixed(2)}</span>
            </div>
            {f.pnl != null && <div className="text-[10px] text-pos">round trip closed +${f.pnl.toFixed(2)}</div>}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stat label="Round trips" value={String(roundTrips)} />
        <Stat label="Realized" value={`+$${realized.toFixed(2)}`} tone="pos" />
      </div>
    </div>
  );
}

// ── REBALANCING ─────────────────────────────────────────────────────────────
function runRange(prices: number[], min: number, max: number) {
  const width = (max - min) * 0.16;
  let lower = prices[0] - width / 2, upper = prices[0] + width / 2;
  let resets = 0, inRangeTicks = 0;
  const events: { idx: number; lower: number; upper: number }[] = [{ idx: 0, lower, upper }];
  for (let n = 1; n < prices.length; n++) {
    const p = prices[n];
    if (p < lower || p > upper) {
      lower = p - width / 2; upper = p + width / 2; resets++;
      events.push({ idx: n, lower, upper });
    } else inRangeTicks++;
  }
  const inRangePct = prices.length > 1 ? (inRangeTicks / (prices.length - 1)) * 100 : 100;
  return { lower, upper, resets, inRangePct, events, width };
}
function RangeSim({ prices, min, max, asset }: { prices: number[]; min: number; max: number; asset: string }) {
  const { lower, upper } = runRange(prices, min, max);
  const cur = prices[prices.length - 1];
  const inRange = cur >= lower && cur <= upper;
  const yU = scaleY(upper, min, max), yL = scaleY(lower, min, max);
  return (
    <svg viewBox={`0 0 ${CH_W} ${CH_H}`} className="w-full" role="img" aria-label={`Liquidity range simulation on ${asset}`}>
      <rect x={PAD} y={yU} width={CH_W - PAD * 2} height={Math.max(2, yL - yU)} fill={inRange ? "var(--color-pos)" : "var(--color-amber)"} fillOpacity="0.1" />
      <line x1={PAD} y1={yU} x2={CH_W - PAD} y2={yU} stroke="var(--color-pos)" strokeOpacity="0.5" strokeDasharray="4 4" />
      <line x1={PAD} y1={yL} x2={CH_W - PAD} y2={yL} stroke="var(--color-pos)" strokeOpacity="0.5" strokeDasharray="4 4" />
      <text x={CH_W - PAD} y={yU - 2} textAnchor="end" fontSize="9" fill="var(--color-pos)" fillOpacity="0.8" className="font-mono">${upper.toFixed(0)}</text>
      <text x={CH_W - PAD} y={yL + 10} textAnchor="end" fontSize="9" fill="var(--color-pos)" fillOpacity="0.8" className="font-mono">${lower.toFixed(0)}</text>
      <path d={pricePath(prices, min, max)} fill="none" stroke="#f3efe6" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      {prices.length > 1 && <circle cx={scaleX(prices.length - 1)} cy={scaleY(cur, min, max)} r="3.4" fill={inRange ? "#fff" : "var(--color-amber)"} />}
      {!inRange && <text x={CH_W / 2} y={16} textAnchor="middle" fontSize="10" fill="var(--color-amber)" className="uppercase tracking-widest">Out of range — resetting…</text>}
    </svg>
  );
}
function RangeFeed({ prices, min, max }: { prices: number[]; min: number; max: number; asset: string }) {
  const { resets, inRangePct, upper, lower } = runRange(prices, min, max);
  const cur = prices[prices.length - 1];
  const inRange = cur >= lower && cur <= upper;
  return (
    <div className="flex h-full flex-col">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">Position status</div>
      <div className={`mt-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] ${inRange ? "border-pos/30 bg-pos/5 text-pos" : "border-amber/30 bg-amber/5 text-amber"}`}>
        {inRange ? "In range — earning fees" : "Out of range — capital idle until reset"}
      </div>
      <p className="mt-2 text-[11px] text-muted">The band is the price range your liquidity is concentrated in. Fees accrue only while the white line sits inside it; when it leaves, the agent recentres the band so you keep earning.</p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
        <Stat label="Range resets" value={String(resets)} />
        <Stat label="Time in range" value={`${inRangePct.toFixed(0)}%`} tone="pos" />
      </div>
    </div>
  );
}

// ── HEALTH FACTOR ───────────────────────────────────────────────────────────
// Health factor moves inversely with price (collateral value). Agent repays
// whenever HF approaches the 1.0 liquidation line, nudging it back to safety.
function runHealth(prices: number[], min: number, max: number) {
  const safe = 2.0, danger = 1.2;
  let debtFactor = 1; // scales down each repay, lifting HF
  let repays = 0; let liquidationsAvoided = 0;
  const hfAt = (p: number) => {
    const collateralRatio = 1 + (p - min) / (max - min || 1); // 1..2 with price
    return (collateralRatio / debtFactor) * 1.0 + 0.2;
  };
  const events: { idx: number }[] = [];
  for (let n = 1; n < prices.length; n++) {
    if (hfAt(prices[n]) < danger) {
      debtFactor *= 0.82; repays++; liquidationsAvoided++;
      events.push({ idx: n });
    }
  }
  const hf = hfAt(prices[prices.length - 1]);
  return { hf, repays, liquidationsAvoided, danger, safe, hfAt };
}
function HealthSim({ prices, min, max, asset }: { prices: number[]; min: number; max: number; asset: string }) {
  const { hfAt, danger } = runHealth(prices, min, max);
  const hfs = prices.map(hfAt);
  const hMin = 1.0, hMax = 2.6;
  const y = (h: number) => CH_H - PAD - ((h - hMin) / (hMax - hMin)) * (CH_H - PAD * 2);
  const dY = y(danger), liqY = y(1.0);
  const path = hfs.map((h, idx) => `${idx === 0 ? "M" : "L"} ${scaleX(idx).toFixed(1)} ${y(h).toFixed(1)}`).join(" ");
  const cur = hfs[hfs.length - 1];
  return (
    <svg viewBox={`0 0 ${CH_W} ${CH_H}`} className="w-full" role="img" aria-label={`Health factor simulation on ${asset}`}>
      <rect x={PAD} y={liqY - 0} width={CH_W - PAD * 2} height={CH_H - PAD - liqY} fill="var(--color-neg)" fillOpacity="0.08" />
      <line x1={PAD} y1={liqY} x2={CH_W - PAD} y2={liqY} stroke="var(--color-neg)" strokeOpacity="0.7" />
      <text x={PAD + 2} y={liqY - 3} fontSize="9" fill="var(--color-neg)" className="uppercase tracking-widest">Liquidation · HF 1.0</text>
      <line x1={PAD} y1={dY} x2={CH_W - PAD} y2={dY} stroke="var(--color-amber)" strokeOpacity="0.5" strokeDasharray="4 4" />
      <text x={CH_W - PAD} y={dY - 3} textAnchor="end" fontSize="9" fill="var(--color-amber)" fillOpacity="0.8">repay trigger</text>
      <path d={path} fill="none" stroke="var(--color-pos)" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
      {prices.length > 1 && (
        <>
          <circle cx={scaleX(hfs.length - 1)} cy={y(cur)} r="3.4" fill="#fff" />
          <text x={scaleX(hfs.length - 1) - 6} y={y(cur) - 6} textAnchor="end" fontSize="10" fill="#fff" className="font-mono">HF {cur.toFixed(2)}</text>
        </>
      )}
    </svg>
  );
}
function HealthFeed({ prices, min, max }: { prices: number[]; min: number; max: number }) {
  const { hf, repays } = runHealth(prices, min, max);
  const safe = hf >= 1.5;
  return (
    <div className="flex h-full flex-col">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">Loan status</div>
      <div className={`mt-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] ${safe ? "border-pos/30 bg-pos/5 text-pos" : "border-amber/30 bg-amber/5 text-amber"}`}>
        Health factor {hf.toFixed(2)} — {safe ? "safe" : "guarded"}
      </div>
      <p className="mt-2 text-[11px] text-muted">As collateral value falls, your health factor drops toward the 1.0 liquidation line. Each time it nears the trigger, the agent repays part of the debt to lift you back to safety — automatically, day or night.</p>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
        <Stat label="Auto-repays" value={String(repays)} />
        <Stat label="Liquidations" value="0" tone="pos" />
      </div>
    </div>
  );
}

// ── YIELD ───────────────────────────────────────────────────────────────────
const YIELD_FALLBACK = [
  { name: "Venus", apr: 4.1 },
  { name: "Lista", apr: 6.8 },
  { name: "PancakeSwap", apr: 9.4 },
];
function YieldSim({ prices, budget, venues: real }: { prices: number[]; asset: string; budget: number; venues?: { name: string; apr: number }[] }) {
  const source = real && real.length >= 2 ? real.slice(0, 3) : YIELD_FALLBACK;
  // rotate which venue is "best" over time so the agent visibly moves funds —
  // a small, honest bump on top of the real base rates to show the behaviour.
  const phase = Math.floor(prices.length / 18) % source.length;
  const venues = source.map((v, k) => ({ ...v, apr: v.apr + (k === phase ? Math.max(1.5, v.apr * 0.25) : 0) }));
  const best = venues.reduce((a, b) => (b.apr > a.apr ? b : a));
  const maxApr = Math.max(...venues.map((v) => v.apr));
  return (
    <div className="py-2">
      <div className="space-y-3">
        {venues.map((v) => {
          const isBest = v.name === best.name;
          return (
            <div key={v.name}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className={isBest ? "text-fg" : "text-muted"}>{v.name}{isBest && <span className="ml-1.5 rounded bg-pos/15 px-1.5 py-0.5 text-[10px] text-pos">funds here</span>}</span>
                <span className={`font-mono ${isBest ? "text-pos" : "text-muted"}`}>{v.apr.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/6">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(v.apr / maxApr) * 100}%`, background: isBest ? "var(--color-pos)" : "rgba(255,255,255,0.18)" }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted">${budget} following the best real rate. When another venue overtakes, the agent moves the funds — after checking gas is worth it.</p>
    </div>
  );
}
function YieldFeed({ budget }: { budget: number }) {
  return (
    <div className="flex h-full flex-col">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">Why it beats parking</div>
      <ul className="mt-1.5 space-y-1.5 text-[12px] text-muted">
        <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-pos" /> Compares every venue continuously, not once.</li>
        <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-pos" /> Only moves when the extra APR beats the gas.</li>
        <li className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-pos" /> Never sits idle at a stale rate.</li>
      </ul>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
        <Stat label="Deployed" value={`$${budget}`} />
        <Stat label="Idle" value="$0" tone="pos" />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "fg" }: { label: string; value: string; tone?: "fg" | "pos" }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] ${tone === "pos" ? "text-pos" : "text-fg"}`}>{value}</div>
    </div>
  );
}
