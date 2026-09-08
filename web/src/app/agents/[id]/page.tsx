import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  ShieldCheck, ExternalLink, Star, AlertTriangle,
  MessageSquare, Boxes, Activity, Globe,
} from "lucide-react";
import { getAgent } from "@/lib/agents";
import { CATEGORIES } from "@/lib/agents/types";
import { timeAgo, shortAddr } from "@/lib/format";
import { looksReadOnly } from "@/lib/mcp/describe";
import { ScoreRing } from "@/components/score-ring";
import { Reveal } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";
import { AgentInterface } from "@/components/agent-interface";
import { StrategyDemoSection } from "@/components/strategy-demo-section";
import { PaperPerformance } from "@/components/paper-performance";
import { TrackRecord } from "@/components/track-record";
import { HireButton } from "@/components/hire-button";
import { CompareCheckbox } from "@/components/compare-checkbox";

const BSCSCAN = "https://bscscan.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(decodeURIComponent(id)).catch(() => null);
  if (!agent) return { title: "Agent not found — Proven" };
  const cat = CATEGORIES[agent.category];
  const desc = agent.description?.slice(0, 155) || `A ${cat.label} agent on BNB Smart Chain. See how it trades, its on-chain track record, and hire it with a scoped, revocable session.`;
  const title = `${agent.name} — ${cat.label} agent on BSC | Proven`;
  return {
    title,
    description: desc,
    openGraph: { title, description: desc, type: "website" as const },
    twitter: { card: "summary" as const, title, description: desc },
  };
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(decodeURIComponent(id));
  if (!agent) notFound();

  const cat = CATEGORIES[agent.category];
  const tools = agent.capabilities.flatMap((c) => c.tools);
  const writeTools = tools.filter((t) => !looksReadOnly(t));
  const b = agent.breakdown;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <SiteHeader variant="back" />

      {/* Identity hero */}
      <Reveal>
        <section className="card mt-6 p-6 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-5">
              <ScoreRing score={agent.score} rank={agent.rank} size={88} />
              <div className="min-w-0">
                <span className="pill" style={{ background: `${cat.accent}1f`, color: cat.accent }}>
                  <span>{cat.emoji}</span> {cat.label}
                </span>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{agent.name}</h1>
                <p className="mt-1.5 text-sm text-muted">
                  Token <span className="font-mono text-fg/80">#{agent.tokenId}</span>
                  <span className="mx-1.5">·</span>
                  matched on “{agent.categoryEvidence}”
                </p>

                {/* quick-signal badges */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {agent.health?.verified ? (
                    <Badge tone="pos"><span className="h-1.5 w-1.5 rounded-full bg-pos" /> Endpoint live</Badge>
                  ) : agent.health?.error ? (
                    <Badge tone="neg"><AlertTriangle size={11} /> Endpoint offline</Badge>
                  ) : null}
                  {agent.x402 && <Badge tone="violet">x402 payments</Badge>}
                  {agent.feedbackCount > 0 && <Badge tone="muted"><Star size={11} /> {agent.averageScore.toFixed(1)} · {agent.feedbackCount}</Badge>}
                  <CompareCheckbox entry={{ id: agent.id, name: agent.name, category: agent.category }} />
                </div>

                {/* provenance links */}
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
                  <ProvLink href={`${BSCSCAN}/token/${agent.contract}?a=${agent.tokenId}`}>Registry NFT</ProvLink>
                  {agent.provenance.txHash && <ProvLink href={`${BSCSCAN}/tx/${agent.provenance.txHash}`}>Registration tx</ProvLink>}
                  {agent.agentWallet && <ProvLink href={`${BSCSCAN}/address/${agent.agentWallet}`}>Wallet {shortAddr(agent.agentWallet)}</ProvLink>}
                </div>
              </div>
            </div>
            <HireButton agentId={agent.id} agentName={agent.name} category={agent.category} writeTools={writeTools} />
          </div>
        </section>
      </Reveal>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Reveal>
            <section className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Overview</h2>
              <p className="mt-2 whitespace-pre-line text-fg/90">
                {agent.description || "This agent published no description to the registry."}
              </p>
              {agent.protocols.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {agent.protocols.map((p) => (
                    <span key={p} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[12px] text-muted">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </Reveal>

          {/* See it work — a live, self-running demo of the strategy on real
              BNB/USDT price, grounded in the agent's real wallet size and live
              venue rates. This is the "understand what it does" moment. */}
          <Reveal delay={0.04}>
            <Suspense fallback={<CardSkeleton title="See it work" lines={4} />}>
              <StrategyDemoSection
                category={agent.category}
                wallet={agent.agentWallet}
                venue={agent.protocols[0]}
              />
            </Suspense>
          </Reveal>

          {/* The real proof — reconstructed on-chain track record: money in/out,
              what it trades through, and profit where honestly derivable. */}
          {agent.agentWallet && (
            <Reveal delay={0.05}>
              <Suspense fallback={<CardSkeleton title="Track record" lines={3} />}>
                <TrackRecord wallet={agent.agentWallet} />
              </Suspense>
            </Reveal>
          )}

          {/* What it does, in plain English */}
          <Reveal delay={0.08}>
            <AgentInterface category={agent.category} registryToolNames={tools} />
          </Reveal>

          {/* Paper-traded performance — real strategy logic over real price
              history. Replaces the old category-level APR panel, which showed
              every agent in a category the same number. */}
          <Reveal delay={0.1}>
            <Suspense fallback={<CardSkeleton title="Paper-traded performance" lines={4} />}>
              <PaperPerformance
                category={agent.category}
                protocols={agent.protocols}
                wallet={agent.agentWallet}
              />
            </Suspense>
          </Reveal>
        </div>

        <div className="flex flex-col gap-5">
          {/* Score breakdown */}
          {b && (
            <Reveal delay={0.1}>
              <section className="card p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Score breakdown
                </h2>
                <p className="mb-3 mt-1 text-[12px] text-muted">
                  The registry&apos;s own six factors behind the {agent.score} headline.
                </p>
                <div className="space-y-2.5">
                  <Bar label="Metadata" value={b.metadataCompleteness} />
                  <Bar label="Health" value={b.health} />
                  <Bar label="Freshness" value={b.freshness} />
                  <Bar label="Wallet" value={b.wallet} />
                  <Bar label="Popularity" value={b.popularity} />
                  <Bar label="Activity" value={b.activity} />
                  <Bar label="Quality" value={b.quality} />
                </div>
              </section>
            </Reveal>
          )}

          {/* Reputation */}
          <Reveal delay={0.14}>
            <section className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Reputation
              </h2>
              <div className="mt-3 space-y-2 text-sm">
                <Row icon={<MessageSquare size={14} />} label="Feedback">
                  {agent.feedbackCount === 0
                    ? "none on-chain yet"
                    : `${agent.feedbackCount} · avg ${agent.averageScore.toFixed(1)}`}
                </Row>
                <Row icon={<ShieldCheck size={14} />} label="Validations">
                  {agent.validations.total === 0
                    ? "none"
                    : `${agent.validations.successful}/${agent.validations.total} passed`}
                </Row>
                <Row icon={<Star size={14} />} label="Stars">{String(agent.stars)}</Row>
                <Row icon={<Boxes size={14} />} label="Cross-chain">
                  {agent.crossChainCount ? `${agent.crossChainCount} linked` : "single chain"}
                </Row>
                <Row icon={<Activity size={14} />} label="Trust model">
                  {agent.trustModels.join(", ") || "not declared"}
                </Row>
                <Row icon={<Globe size={14} />} label="Owner">
                  <a
                    href={`${BSCSCAN}/address/${agent.ownerAddress}`}
                    target="_blank" rel="noopener noreferrer"
                    className="font-mono text-violet hover:underline"
                  >
                    {shortAddr(agent.ownerAddress)}
                  </a>
                </Row>
              </div>
              {agent.provenance.createdAt && (
                <p className="mt-3 border-t border-white/8 pt-3 text-[12px] text-muted">
                  Registered {timeAgo(agent.provenance.createdAt)}
                  {agent.provenance.updatedAt && ` · updated ${timeAgo(agent.provenance.updatedAt)}`}
                </p>
              )}
            </section>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "pos" | "neg" | "violet" | "muted" }) {
  const c =
    tone === "pos" ? "border-pos/30 bg-pos/10 text-pos"
    : tone === "neg" ? "border-neg/30 bg-neg/10 text-neg"
    : tone === "violet" ? "border-violet/30 bg-violet/10 text-violet"
    : "border-white/10 bg-white/[0.03] text-muted";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${c}`}>{children}</span>;
}

function ProvLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted transition hover:text-violet">
      {children} <ExternalLink size={11} />
    </a>
  );
}

function CardSkeleton({ title, lines = 3 }: { title: string; lines?: number }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 rounded bg-white/5 animate-[pulse-soft_1.6s_ease-in-out_infinite]" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    </section>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const tone = value >= 60 ? "bg-pos" : value >= 25 ? "bg-violet" : "bg-white/25";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-fg">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/6">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-muted">{icon}{label}</span>
      <span className="text-right text-fg">{children}</span>
    </div>
  );
}
