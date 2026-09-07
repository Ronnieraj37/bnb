import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { browse, countByCategory, categoryTotals } from "@/lib/agents";
import type { Category, SortKey } from "@/lib/agents";
import { CATEGORIES } from "@/lib/agents/types";
import { AgentCard } from "@/components/agent-card";
import { SiteHeader } from "@/components/site-header";
import { CategoryNav } from "@/components/category-nav";
import { MarketToolbar } from "@/components/market-toolbar";
import { SearchBox } from "@/components/search-box";
import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";
import { LivePulse, LivePulseSkeleton } from "@/components/live-pulse";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: Category; q?: string; sort?: string; x402?: string; reviews?: string }>;
}) {
  const { category, q, sort, x402: x402Param, reviews: reviewsParam } = await searchParams;
  const valid = category && category in CATEGORIES ? category : undefined;
  const sortKey = (sort === "feedback" || sort === "newest" ? sort : "score") as SortKey;
  const filters = { x402: x402Param === "1", reviews: reviewsParam === "1" };

  const { agents, indexed, isMatchCount, featured, error } = await browse({ category: valid, search: q, sort: sortKey, filters });
  // Nav counts come from the full catalogue so they do not change as you filter,
  // except during a search where the counts describe the results.
  const counts = q ? countByCategory(agents) : await categoryTotals();
  // Tool/health data only exists on records we've fetched in detail (the
  // featured strip); the general list view never has it, so top-line stats
  // must come from fields the LIST endpoint actually returns for everyone.
  const withX402 = agents.filter((a) => a.x402).length;
  const withReviews = agents.filter((a) => a.feedbackCount > 0).length;
  const featuredList = featured ? Object.values(featured).filter((a): a is NonNullable<typeof a> => Boolean(a)) : [];
  const featuredIds = new Set(featuredList.map((a) => a.id));
  const showFeatured = !q && !valid && featuredList.length > 0;

  return (
    <div className="mx-auto max-w-7xl px-5 pb-24">
      <SiteHeader variant="home" />

      <section className="py-14 sm:py-20">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-pos animate-[pulse-soft_2s_ease-in-out_infinite]" />
            Live ERC-8004 registry · BNB Smart Chain mainnet
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Every agent on BSC, <span className="text-cosmic">legible</span>.
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            The registry lists hundreds of thousands of agents and tells you almost nothing about
            them. Proven shows what each one can actually do — its real published tools, whether
            its endpoint is actually alive right now, and lets you call it live before you trust it
            with anything.
          </p>
        </Reveal>

        <Reveal delay={0.24}>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label={isMatchCount ? "Matches" : "Agents on BSC"}
              num={isMatchCount ? indexed : indexed / 1000}
              suffix={isMatchCount ? "" : "K"}
              decimals={isMatchCount ? 0 : 1}
            />
            <Stat label="Shown here" num={agents.length} accent />
            <Stat label="Accept x402 payment" num={withX402} />
            <Stat label="Have on-chain feedback" num={withReviews} />
          </div>
        </Reveal>
      </section>

      <Suspense fallback={<LivePulseSkeleton />}>
        <LivePulse />
      </Suspense>

      {showFeatured && (
        <Reveal>
          <section className="mb-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
              Top ranked, one per category
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {featuredList.map((a, i) => (
                <AgentCard key={a.id} agent={a} index={i} featured />
              ))}
            </div>
          </section>
        </Reveal>
      )}

      <section id="browse" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            {q ? `Results for “${q}”` : valid ? CATEGORIES[valid].label : "Marketplace"}
          </h2>
          <Suspense fallback={<div className="h-10 w-96 rounded-xl glass" />}>
            <SearchBox initial={q} />
          </Suspense>
        </div>

        <CategoryNav
          counts={counts}
          active={valid}
          total={q ? agents.length : Object.values(counts).reduce((a, b) => a + b, 0)}
          query={q}
          preserve={{ sort, x402: x402Param, reviews: reviewsParam }}
        />

        <Suspense fallback={<div className="h-9" />}>
          <MarketToolbar />
        </Suspense>

        {valid && (
          <p className="rounded-xl glass px-4 py-2.5 text-[13px] text-muted">
            <span className="text-fg">{CATEGORIES[valid].label}:</span> {CATEGORIES[valid].blurb}{" "}
            <span className="text-violet">{CATEGORIES[valid].judgeOn}</span>
          </p>
        )}
      </section>

      {error ? (
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-neg/30 bg-neg/5 p-5 text-sm text-neg">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{error}</p>
            <p className="mt-1 text-muted">
              This page shows live registry data only — there is no local copy to fall back on.
            </p>
          </div>
        </div>
      ) : agents.length === 0 ? (
        <p className="mt-8 rounded-2xl glass p-6 text-sm text-muted">
          No agents matched{q ? ` “${q}”` : ""}. Try a broader term.
        </p>
      ) : (
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents
            .filter((a) => !showFeatured || !featuredIds.has(a.id))
            .map((a, i) => (
              <AgentCard key={a.id} agent={a} index={i} />
            ))}
        </section>
      )}

      <footer className="mt-24 border-t border-white/8 pt-6 text-sm text-muted">
        Proven · BNB Smart Money Era hackathon · Agent data from the 8004scan ERC-8004 index,
        protocol yields from DeFiLlama.
      </footer>
    </div>
  );
}

function Stat({
  label, num, accent, suffix, decimals,
}: {
  label: string; num: number; accent?: boolean; suffix?: string; decimals?: number;
}) {
  return (
    <div className="card card-hover px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className={`stat-value mt-2 text-3xl font-semibold ${accent ? "text-cosmic" : "text-fg"}`}>
        <CountUp value={num} suffix={suffix} decimals={decimals} />
      </div>
    </div>
  );
}
