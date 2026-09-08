import { TrendingUp, ArrowDownLeft, ArrowUpRight, Activity, Fuel, Store, Clock, Coins } from "lucide-react";
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

  // ── No reconstructed history (no key needed): show the real, live on-chain
  // holdings & activity read straight from the public BSC RPC. No nag, no
  // invented numbers — just what the chain proves right now. ──
  if (!record || (record.totalTx === 0 && record.equity.length === 0)) {
    const snap = await walletSnapshot(wallet).catch(() => null);
    return (
      <Section title="On-chain holdings & activity" note="Read live from BNB Smart Chain — this agent's real wallet right now.">
        {snap ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<TrendingUp size={13} />} label="Portfolio value" value={usd(snap.totalUsd)} accent />
              <Stat icon={<Activity size={13} />} label="Transactions" value={snap.txCount.toLocaleString()} />
              <Stat icon={<Coins size={13} />} label="BNB balance" value={snap.bnbBalance.toFixed(3)} />
              <Stat label="Wallet type" value={snap.isContract ? "Contract" : "Wallet"} />
            </div>
            {snap.tokens.length > 0 ? (
              <div className="mt-4">
                <div className="eyebrow mb-2">Token holdings</div>
                <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  {snap.tokens.map((t) => (
                    <div key={t.symbol} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                      <span className="font-medium text-fg">{t.symbol}</span>
                      <span className="font-mono text-muted">{t.balance.toFixed(3)} <span className="ml-1 text-fg">{usd(t.usd)}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-muted">Holds only BNB right now — no major BEP-20 balances.</p>
            )}
            <p className="mt-3 text-[11px] text-muted">
              {snap.txCount > 0 ? <>This wallet has made <span className="text-fg">{snap.txCount.toLocaleString()}</span> real transactions on BSC. </> : "This wallet has no transactions yet. "}
              Live from the public BSC RPC.
            </p>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-muted">This agent&apos;s wallet couldn&apos;t be read right now — the public RPC didn&apos;t respond.</p>
        )}
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

function Section({ title = "Track record", note, children }: { title?: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex items-center gap-2">
        <TrendingUp size={15} className="text-violet" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      </div>
      {note && <p className="mb-3 mt-1.5 text-[13px] text-muted">{note}</p>}
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
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
      <div className="eyebrow flex items-center gap-1">{icon}{label}</div>
      <div className={`stat-value mt-2 text-xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
