import { TrendingUp, ArrowDownLeft, ArrowUpRight, Activity, Fuel, Store, Clock, AlertTriangle } from "lucide-react";
import { trackRecord } from "@/lib/chain/history";
import { walletSnapshot } from "@/lib/chain/wallet";
import { usd, timeAgo } from "@/lib/format";
import { Spark } from "./spark";

// The headline of the page: a REAL track record reconstructed from the agent
// wallet's own on-chain history — money in, money out, what it trades through,
// how active it is, and (when honestly derivable) realized profit. If we can't
// reconstruct it (no BscScan key, upstream down), we fall back to the live RPC
// snapshot and say exactly that, rather than inventing a record.

const iso = (unix: number) => new Date(unix * 1000).toISOString();

export async function TrackRecord({ wallet }: { wallet: string }) {
  const record = await trackRecord(wallet).catch(() => null);

  // ── Fallback: no reconstructed history. Show real snapshot facts + why. ──
  if (!record || (record.totalTx === 0 && record.equity.length === 0)) {
    const snap = await walletSnapshot(wallet).catch(() => null);
    return (
      <Section>
        {snap ? (
          <>
            <p className="mb-3 mt-1 text-[13px] text-muted">
              Live snapshot of this agent&apos;s wallet, read straight from BSC mainnet right now.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<TrendingUp size={13} />} label="Portfolio now" value={usd(snap.totalUsd)} accent />
              <Stat icon={<Activity size={13} />} label="Transactions" value={snap.txCount.toLocaleString()} />
              <Stat label="BNB balance" value={snap.bnbBalance.toFixed(3)} />
              <Stat label="Wallet type" value={snap.isContract ? "Contract" : "EOA"} />
            </div>
            {snap.tokens.length > 0 && (
              <div className="mt-3 divide-y divide-white/5 border-t border-white/8 pt-1">
                {snap.tokens.map((t) => (
                  <div key={t.symbol} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-fg">{t.symbol}</span>
                    <span className="font-mono text-muted">{t.balance.toFixed(3)} <span className="text-fg">{usd(t.usd)}</span></span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-2 text-[13px] text-muted">This agent&apos;s wallet couldn&apos;t be read right now.</p>
        )}
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-white/[0.03] px-3 py-2 text-[11px] text-muted">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
          Full trade-by-trade history (realized profit, money in/out, an equity curve) needs a
          BscScan API key. Add <code className="mx-1 rounded bg-white/10 px-1">ETHERSCAN_API_KEY</code> to
          enable it — until then we show only what the free public RPC can prove, never an invented number.
        </p>
      </Section>
    );
  }

  const pnl = record.realizedPnlUsd;

  return (
    <Section>
      <p className="mb-3 mt-1 text-[13px] text-muted">
        Reconstructed from every transfer this wallet actually made on BSC mainnet — not the
        registry&apos;s numbers, the chain&apos;s. Values are marked at today&apos;s prices.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<TrendingUp size={13} />}
          label="Realized profit"
          value={pnl == null ? "N/A" : (pnl >= 0 ? "+" : "") + usd(pnl)}
          tone={pnl == null ? "muted" : pnl >= 0 ? "pos" : "neg"}
          accent
        />
        <Stat icon={<ArrowDownLeft size={13} className="text-pos" />} label="Money in" value={usd(record.moneyInUsd)} />
        <Stat icon={<ArrowUpRight size={13} className="text-neg" />} label="Money out" value={usd(record.moneyOutUsd)} />
        <Stat
          icon={<Activity size={13} />}
          label="Net deployed"
          value={(record.netFlowUsd >= 0 ? "" : "-") + usd(Math.abs(record.netFlowUsd))}
        />
      </div>

      {record.equity.length >= 2 && (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
            <span>Capital deployed over time</span>
            <span className="font-mono">{record.equity.length} moves</span>
          </div>
          <div className="text-muted">
            <Spark points={record.equity} />
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<Activity size={13} />} label="Total transactions" value={record.totalTx.toLocaleString()} />
        <Stat icon={<Clock size={13} />} label="Last 7 days" value={`${record.txLast7d} tx`} />
        <Stat icon={<Fuel size={13} />} label="Gas spent" value={usd(record.gasSpentUsd)} />
        <Stat
          label="Active since"
          value={record.firstActivity ? new Date(record.firstActivity * 1000).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "—"}
        />
      </div>

      {record.venues.length > 0 && (
        <div className="mt-4 border-t border-white/8 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] text-muted">
            <Store size={13} /> Trades through
          </div>
          <div className="flex flex-wrap gap-1.5">
            {record.venues.map((v) => (
              <span key={v} className="rounded-full border border-violet/25 bg-violet/10 px-2.5 py-0.5 text-[12px] text-violet">
                {v}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted">
        {record.lastActivity && <>Last active {timeAgo(iso(record.lastActivity))}. </>}
        {record.failedTx > 0 && <>{record.failedTx} failed tx. </>}
        {record.sampled && <>History is large — showing the most complete window we can pull. </>}
        Live from BscScan (BSC mainnet).
      </p>
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl glass p-5">
      <div className="flex items-center gap-2">
        <TrendingUp size={15} className="text-violet" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Track record</h2>
      </div>
      {children}
    </section>
  );
}

function Stat({
  icon, label, value, accent, tone = "fg",
}: {
  icon?: React.ReactNode; label: string; value: string; accent?: boolean; tone?: "fg" | "pos" | "neg" | "muted";
}) {
  const toneClass = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "muted" ? "text-muted" : accent ? "text-cosmic" : "text-fg";
  return (
    <div className="rounded-xl bg-white/[0.03] px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted">{icon}{label}</div>
      <div className={`mt-0.5 font-mono text-sm ${toneClass}`}>{value}</div>
    </div>
  );
}
