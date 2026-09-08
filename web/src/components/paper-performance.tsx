import { FlaskConical, Info } from "lucide-react";
import { paperTrade, WINDOW_LABEL, type WindowKey } from "@/lib/paper/engine";
import type { Category } from "@/lib/agents/types";
import { walletSnapshot } from "@/lib/chain/wallet";

// Performance the registry cannot give you: this agent's strategy replayed over
// real hourly BNB price and real live venue rates, reported over 1D / 7D / 30D.
// Labelled a paper trade, because that is what it is.

const ORDER: WindowKey[] = ["d1", "d7", "d30"];

export async function PaperPerformance({
  category,
  protocols,
  wallet,
}: {
  category: Category;
  protocols: string[];
  wallet?: string;
}) {
  const snap = wallet ? await walletSnapshot(wallet).catch(() => null) : null;
  const result = await paperTrade({
    category,
    protocols,
    capitalUsd: snap?.totalUsd ?? 0,
  }).catch(() => null);

  if (!result) {
    return (
      <section className="card p-5">
        <Header />
        <p className="mt-3 text-[13px] text-muted">
          Price history was unavailable just now, so we can&apos;t show a paper-traded result for this
          agent. We don&apos;t substitute an estimate.
        </p>
      </section>
    );
  }

  const isGuard = category === "health-factor";
  // Annualising a one-off avoided liquidation penalty produces a nonsense
  // number (a single 10% save became "+121% a year"). For the guard we report
  // the actual 30-day outcome instead.
  const headlineValue = isGuard ? result.windows.d30.returnPct : result.aprPct;

  return (
    <section className="card p-5">
      <Header />
      <p className="mb-4 mt-1.5 text-[13px] text-muted">{result.headline}</p>

      {/* the three windows + annualised */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ORDER.map((k) => {
          const w = result.windows[k];
          // A guard that never had to act didn't "return 0%" — nothing
          // threatened the position. Say that instead of a hollow number.
          const idleGuard = category === "health-factor" && w.actions === 0;
          return (
            <div key={k} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
              <div className="eyebrow">{WINDOW_LABEL[k]} {category === "health-factor" ? "outcome" : "return"}</div>
              {idleGuard ? (
                <>
                  <div className="stat-value mt-2 text-xl font-semibold text-pos">Safe</div>
                  <div className="mt-1 text-[11px] text-muted">no top-up needed</div>
                </>
              ) : (
                <>
                  <div className={`stat-value mt-2 text-xl font-semibold ${tone(w.returnPct)}`}>
                    {sign(w.returnPct)}{Math.abs(w.returnPct).toFixed(2)}%
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    {w.actions} {category === "health-factor" ? (w.actions === 1 ? "top-up" : "top-ups") : `action${w.actions === 1 ? "" : "s"}`}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <div className="rounded-xl border border-violet/25 bg-violet/[0.07] px-3.5 py-3">
          <div className="eyebrow text-violet/80">{isGuard ? "Loss avoided" : "Annualised"}</div>
          <div className={`stat-value mt-2 text-xl font-semibold ${tone(headlineValue)}`}>
            {sign(headlineValue)}{Math.abs(headlineValue).toFixed(isGuard ? 2 : 1)}%
          </div>
          <div className="mt-1 text-[11px] text-muted">{isGuard ? "over 30D" : "from 30D"}</div>
        </div>
      </div>

      {/* what it was measured against — the per-agent inputs */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/[0.06] pt-3 text-[12px] text-muted">
        <span>Capital <span className="font-mono text-fg">${result.capitalUsd.toLocaleString()}</span></span>
        {result.baseAprPct != null && (
          <span>Venue rate <span className="font-mono text-pos">{result.baseAprPct.toFixed(2)}%</span></span>
        )}
        {result.venues.length > 0 && (
          <span>Venues <span className="text-fg">{result.venues.join(", ")}</span></span>
        )}
        <span><span className="font-mono text-fg">{result.candles}</span>h of real price</span>
      </div>

      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] text-muted transition hover:text-fg">
          <Info size={11} /> How this was measured
        </summary>
        <div className="mt-2 rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-muted">
          <p className="text-fg/80">{result.method}</p>
          <ul className="mt-1.5 space-y-1">
            {result.caveats.map((c) => <li key={c}>· {c}</li>)}
          </ul>
        </div>
      </details>
    </section>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <FlaskConical size={15} className="text-violet" />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Paper-traded performance</h2>
      <span className="rounded bg-violet/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet">
        by Proven
      </span>
    </div>
  );
}

const tone = (n: number) => (n > 0.005 ? "text-pos" : n < -0.005 ? "text-neg" : "text-fg");
const sign = (n: number) => (n > 0.005 ? "+" : n < -0.005 ? "−" : "");
