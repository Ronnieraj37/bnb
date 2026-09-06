import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, ShieldCheck, ExternalLink, Star,
  MessageSquare, Boxes, Activity, Globe,
} from "lucide-react";
import { getAgent } from "@/lib/agents";
import { CATEGORIES } from "@/lib/agents/types";
import { marketContext } from "@/lib/market/context";
import { timeAgo, shortAddr } from "@/lib/format";
import { looksReadOnly } from "@/lib/mcp/client";
import { ScoreRing } from "@/components/score-ring";
import { Reveal } from "@/components/reveal";
import { AgentInterface } from "@/components/agent-interface";
import { TrackRecord } from "@/components/track-record";
import { HireButton } from "@/components/hire-button";
import { CompareCheckbox } from "@/components/compare-checkbox";

const BSCSCAN = "https://bscscan.com";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getAgent(decodeURIComponent(id));
  if (!agent) notFound();

  const cat = CATEGORIES[agent.category];
  const context = await marketContext(agent.category);
  const tools = agent.capabilities.flatMap((c) => c.tools);
  const writeTools = tools.filter((t) => !looksReadOnly(t));
  const b = agent.breakdown;

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <header className="sticky top-3 z-50 mt-3 flex items-center justify-between rounded-2xl glass-strong px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted transition hover:text-fg">
          <ArrowLeft size={16} /> Marketplace
        </Link>
        <Link href="/" className="text-cosmic text-lg font-semibold">◆ Proven</Link>
      </header>

      {/* Identity */}
      <Reveal>
        <section className="mt-6 flex flex-col gap-4 rounded-2xl glass-strong p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <ScoreRing score={agent.score} rank={agent.rank} size={68} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span>{cat.emoji}</span>
                <h1 className="text-2xl font-semibold tracking-tight">{agent.name}</h1>
                {agent.x402 && (
                  <span className="rounded bg-violet/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet">
                    x402
                  </span>
                )}
                <CompareCheckbox entry={{ id: agent.id, name: agent.name, category: agent.category }} />
              </div>
              <p className="mt-1.5 text-sm text-muted">
                {cat.label} · token #{agent.tokenId} ·{" "}
                <span className="text-[12px]">matched on “{agent.categoryEvidence}”</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
                <a
                  href={`${BSCSCAN}/token/${agent.contract}?a=${agent.tokenId}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-violet hover:underline"
                >
                  Registry NFT <ExternalLink size={11} />
                </a>
                {agent.provenance.txHash && (
                  <a
                    href={`${BSCSCAN}/tx/${agent.provenance.txHash}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-violet hover:underline"
                  >
                    Registration tx <ExternalLink size={11} />
                  </a>
                )}
                {agent.agentWallet && (
                  <a
                    href={`${BSCSCAN}/address/${agent.agentWallet}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-violet hover:underline"
                  >
                    Agent wallet {shortAddr(agent.agentWallet)} <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>
          <HireButton agentName={agent.name} writeTools={writeTools} />
        </section>
      </Reveal>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Reveal>
            <section className="rounded-2xl glass p-5">
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

          {/* The real proof — reconstructed on-chain track record: money in/out,
              what it trades through, and profit where honestly derivable. */}
          {agent.agentWallet && (
            <Reveal delay={0.05}>
              <TrackRecord wallet={agent.agentWallet} />
            </Reveal>
          )}

          {/* What it does (plain English) + is-it-online + live tool runner */}
          <Reveal delay={0.08}>
            <div className="flex flex-col gap-5">
              <AgentInterface
                agentId={agent.id}
                category={agent.category}
                registryToolNames={tools}
                registrySaysVerified={Boolean(agent.health?.verified)}
                registryError={agent.health?.error}
              />
              <p className="-mt-2 rounded-xl bg-white/[0.03] px-3 py-2 text-[12px] text-muted">
                <span className="text-fg">For {cat.label.toLowerCase()}:</span> {cat.judgeOn}
              </p>
            </div>
          </Reveal>

          {/* Category-relevant live market */}
          {context && (
            <Reveal delay={0.1}>
              <section className="rounded-2xl glass p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {context.heading}
                </h2>
                <p className="mb-3 mt-1 text-[13px] text-muted">{context.note}</p>
                <div className="divide-y divide-white/5">
                  {context.pools.map((p) => (
                    <div key={`${p.project}-${p.symbol}`} className="flex items-center justify-between py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate text-fg">{p.symbol}</div>
                        <div className="text-[11px] text-muted">{p.project}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-pos">{p.apy.toFixed(2)}%</div>
                        <div className="text-[11px] text-muted">
                          ${(p.tvlUsd / 1e6).toFixed(1)}M TVL
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">Live from DeFiLlama.</p>
              </section>
            </Reveal>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {/* Score breakdown */}
          {b && (
            <Reveal delay={0.1}>
              <section className="rounded-2xl glass p-5">
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
            <section className="rounded-2xl glass p-5">
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
