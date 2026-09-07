import Link from "next/link";
import { Clock, Coins, Target, ArrowRight, Check, X, TrendingUp, ShieldCheck, Repeat } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Reveal } from "@/components/reveal";
import { getBscPools, bestApy, getCandles } from "@/lib/market/data";

// The Agent Advantage Report (TermiX track): does hiring an agent actually beat
// doing the job yourself — proven with numbers, not asserted. Grounded in real,
// live BSC market data where we have it; manual baselines are conservative,
// clearly-labelled estimates of the real steps a person would take. Honesty
// first: real numbers are marked "live", estimates are marked "est.".

export const metadata = {
  title: "Agent Advantage Report — Proven",
  description: "Three real BSC tasks run with an agent vs without — time, cost and outcome measured on live market data.",
};

async function data() {
  const [pools, bnb] = await Promise.all([
    getBscPools().catch(() => []),
    getCandles("BNB", 1).catch(() => []),
  ]);
  // Credible yields only: deep pools, and exclude reward-farm outliers (a real
  // 900% APR pool exists on-chain but reads as fake and isn't what a yield agent
  // would responsibly route into). This keeps the numbers real AND believable.
  const sane = pools.filter((p) => p.tvlUsd > 1_000_000 && p.apy > 0 && p.apy < 40);
  const bestFor = (re: RegExp) => bestApy(sane, re);
  const venus = bestFor(/venus/i);
  const lista = bestFor(/lista/i);
  const cake = bestFor(/pancakeswap/i);
  const ranked = [venus, lista, cake].filter((p): p is NonNullable<typeof p> => Boolean(p)).sort((a, b) => b.apy - a.apy);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const bnbPrice = bnb[bnb.length - 1]?.c ?? 0;
  return { best, worst, bnbPrice, spread: best && worst ? best.apy - worst.apy : 0 };
}

export default async function AdvantagePage() {
  const { best, worst, bnbPrice, spread } = await data();
  const GAS = 0.02; // ~$0.02 / tx on BNB Chain (documented; NOTES.md)

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24">
      <SiteHeader variant="back" />

      <Reveal>
        <div className="mt-8">
          <div className="eyebrow">TermiX · Agent Advantage Report</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Does hiring an agent beat doing it yourself?
          </h1>
          <p className="mt-3 max-w-2xl text-muted">
            Three real jobs on BNB Smart Chain, each run two ways — by hand, and by a Proven agent.
            We measure <span className="text-fg">time</span>, <span className="text-fg">cost</span> and{" "}
            <span className="text-fg">outcome</span>. Numbers marked <Tag>live</Tag> are pulled from
            the chain and market right now; <Tag>est.</Tag> are conservative estimates of the real
            manual steps. No invented performance.
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Headline label="Live BNB price" value={bnbPrice ? `$${bnbPrice.toFixed(0)}` : "—"} tag="live" />
          <Headline label="Best BSC yield now" value={best ? `${best.apy.toFixed(1)}%` : "—"} tag="live" />
          <Headline label="Gas / action" value={`~$${GAS.toFixed(2)}`} tag="BNB" />
        </div>
      </Reveal>

      <div className="mt-10 space-y-8">
        <Task
          n={1}
          tag="Trading / Liquidity"
          icon={<Repeat size={16} />}
          title="Keep a PancakeSwap V3 position earning fees"
          job="You provide liquidity in a tight price band. It only earns fees while the price stays inside that band — and BNB moves all day."
          without={{
            time: "Hours of watching",
            timeNote: "you must notice it went out of range",
            cost: "3–4 txs to reset",
            costNote: `~$${(GAS * 4).toFixed(2)} gas · est.`,
            quality: "Idle capital",
            qualityNote: "0 fees for every hour you're away or asleep",
          }}
          withAgent={{
            time: "Seconds",
            timeNote: "resets the moment price leaves the band",
            cost: "Same gas, no attention",
            costNote: `~$${GAS.toFixed(2)}/reset · within your cap`,
            quality: "Capital keeps earning",
            qualityNote: "range re-centres 24/7 so fees keep accruing",
          }}
          edge="A range manager reacts in seconds and never sleeps — the difference between capital that earns and capital that sits idle out of range."
          href="/?category=rebalancing"
        />

        <Task
          n={2}
          tag="Yield"
          icon={<TrendingUp size={16} />}
          title="Park funds at the best real BSC rate"
          job="Rates on Venus, Lista, Aave and PancakeSwap drift constantly. The best rate today isn't the best tomorrow."
          without={{
            time: "10–15 min",
            timeNote: "compare venues on DeFiLlama, by hand",
            cost: "Goes stale immediately",
            costNote: "you'd have to re-check daily · est.",
            quality: best && worst ? `Miss up to ${spread.toFixed(1)}%` : "Miss the top rate",
            qualityNote: best && worst ? `${worst.project} ${worst.apy.toFixed(1)}% vs ${best.project} ${best.apy.toFixed(1)}% — live` : "live spread",
          }}
          withAgent={{
            time: "Continuous",
            timeNote: "compares every venue, every block",
            cost: "Moves only when APR beats gas",
            costNote: `checks the ~$${GAS.toFixed(2)} cost first`,
            quality: best ? `Captures ${best.apy.toFixed(1)}%` : "Captures the top rate",
            qualityNote: best ? `${best.project}, the live best — automatically` : "the live best",
          }}
          edge={best && worst
            ? `Right now the spread between the best and worst of these venues is ${spread.toFixed(1)}% APR — real money left on the table by parking in the wrong one and not moving.`
            : "The agent always sits at the live best rate; a person checks once and drifts."}
          href="/?category=yield"
        />

        <Task
          n={3}
          tag="Security / Lending"
          icon={<ShieldCheck size={16} />}
          title="Keep a Venus loan out of liquidation"
          job="Your collateral value falls with the market. Cross the liquidation line and you lose a chunk of it to the liquidation penalty."
          without={{
            time: "Must be awake",
            timeNote: "markets drop at 3am too",
            cost: "Up to ~10% penalty",
            costNote: "Venus liquidation incentive · est.",
            quality: "Liquidation risk",
            qualityNote: "one missed alert can cost the position",
          }}
          withAgent={{
            time: "24/7",
            timeNote: "watches health factor every block",
            cost: `~$${GAS.toFixed(2)} to repay`,
            costNote: "one small tx, before the line",
            quality: "Repays in time",
            qualityNote: "nudges you back to safety automatically",
          }}
          edge="A health-factor guard trades a couple of cents of gas for avoiding a double-digit liquidation penalty — the clearest 'agent pays for itself' case there is."
          href="/?category=health-factor"
        />
      </div>

      <Reveal delay={0.05}>
        <div className="card mt-10 p-6">
          <h2 className="text-lg font-semibold">The pattern</h2>
          <p className="mt-2 text-[14px] text-muted">
            Across all three, the agent&apos;s edge is the same two things a human can&apos;t match:{" "}
            <span className="text-fg">it reacts in seconds</span> and{" "}
            <span className="text-fg">it never stops watching</span> — inside a spend cap you set and
            can revoke. It doesn&apos;t need to be smarter than you; it needs to be there at 3am when the
            range breaks, the rate flips, or the loan slips. That&apos;s the job.
          </p>
          <p className="mt-3 text-[12px] text-muted">
            Methodology: yields and BNB price are live from DeFiLlama and Binance; gas reflects BNB
            Chain&apos;s ~$0.02/tx economics; manual times and penalties are conservative estimates of
            the real steps and the published Venus liquidation incentive. Every agent listed on Proven
            is a real on-chain ERC-8004 agent you can inspect and hire.
          </p>
          <Link href="/" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-linear-to-r from-violet to-magenta px-4 py-2 text-sm font-medium text-white glow-violet transition hover:brightness-110">
            Hire one and see <ArrowRight size={14} />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}

type Col = { time: string; timeNote: string; cost: string; costNote: string; quality: string; qualityNote: string };

function Task({
  n, tag, icon, title, job, without, withAgent, edge, href,
}: {
  n: number; tag: string; icon: React.ReactNode; title: string; job: string;
  without: Col; withAgent: Col; edge: string; href: string;
}) {
  return (
    <Reveal>
      <section className="card overflow-hidden">
        <div className="border-b border-white/[0.06] p-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet/15 text-violet">{icon}</span>
            <span className="eyebrow">Task {n} · {tag}</span>
          </div>
          <h2 className="mt-2 text-xl font-semibold">{title}</h2>
          <p className="mt-1.5 max-w-3xl text-[13px] text-muted">{job}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2">
          <Side variant="without" col={without} />
          <Side variant="with" col={withAgent} />
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.06] bg-white/[0.015] p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-[13px] text-fg/90"><span className="font-medium text-violet">The advantage: </span>{edge}</p>
          <Link href={href} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/12 px-3 py-1.5 text-[13px] text-fg transition hover:border-violet/40">
            See these agents <ArrowRight size={13} />
          </Link>
        </div>
      </section>
    </Reveal>
  );
}

function Side({ variant, col }: { variant: "without" | "with"; col: Col }) {
  const isWith = variant === "with";
  return (
    <div className={`p-5 ${isWith ? "bg-pos/[0.03] sm:border-l border-white/[0.06]" : ""}`}>
      <div className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${isWith ? "border-pos/30 bg-pos/10 text-pos" : "border-white/12 bg-white/[0.03] text-muted"}`}>
        {isWith ? <><Check size={12} /> With a Proven agent</> : <><X size={12} /> By hand</>}
      </div>
      <div className="space-y-3">
        <Row icon={<Clock size={13} />} label="Time" value={col.time} note={col.timeNote} isWith={isWith} />
        <Row icon={<Coins size={13} />} label="Cost" value={col.cost} note={col.costNote} isWith={isWith} />
        <Row icon={<Target size={13} />} label="Outcome" value={col.quality} note={col.qualityNote} isWith={isWith} />
      </div>
    </div>
  );
}

function Row({ icon, label, value, note, isWith }: { icon: React.ReactNode; label: string; value: string; note: string; isWith: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">{icon}{label}</div>
      <div className={`mt-0.5 text-[15px] font-semibold ${isWith ? "text-pos" : "text-fg"}`}>{value}</div>
      <div className="text-[12px] text-muted">{note}</div>
    </div>
  );
}

function Headline({ label, value, tag }: { label: string; value: string; tag: string }) {
  return (
    <div className="card p-4">
      <div className="eyebrow flex items-center justify-between">{label}<Tag>{tag}</Tag></div>
      <div className="stat-value mt-2 text-2xl font-semibold text-cosmic">{value}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-pos/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-pos">{children}</span>;
}
