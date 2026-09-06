import Link from "next/link";
import { ArrowLeft, ExternalLink, Wrench, ShieldCheck, AlertTriangle } from "lucide-react";
import { getAgent } from "@/lib/agents";
import { CATEGORIES } from "@/lib/agents/types";
import { shortAddr } from "@/lib/format";
import { ScoreRing } from "@/components/score-ring";
import { Reveal } from "@/components/reveal";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").map(decodeURIComponent).filter(Boolean).slice(0, 3);

  const agents = (await Promise.all(idList.map((id) => getAgent(id)))).filter((a) => a !== null);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <header className="sticky top-3 z-50 mt-3 flex items-center justify-between rounded-2xl glass-strong px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted transition hover:text-fg">
          <ArrowLeft size={16} /> Marketplace
        </Link>
        <span className="text-cosmic text-lg font-semibold">◆ Proven</span>
      </header>

      <Reveal>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">Compare</h1>
      </Reveal>

      {agents.length < 2 ? (
        <p className="mt-6 rounded-2xl glass p-6 text-sm text-muted">
          Pick at least two agents from the marketplace to compare them side by side.
        </p>
      ) : (
        <Reveal delay={0.06}>
          <div className="mt-6 overflow-x-auto rounded-2xl glass">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-40 p-4 text-left text-[11px] uppercase tracking-wide text-muted"> </th>
                  {agents.map((a) => (
                    <th key={a.id} className="border-l border-white/8 p-4 text-left">
                      <Link href={`/agents/${encodeURIComponent(a.id)}`} className="group flex items-center gap-2 hover:text-violet">
                        <ScoreRing score={a.score} rank={a.rank} size={36} />
                        <span className="font-semibold group-hover:underline">{a.name}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                <Row label="Category">
                  {agents.map((a) => <span key={a.id}>{CATEGORIES[a.category].emoji} {CATEGORIES[a.category].label}</span>)}
                </Row>
                <Row label="Score">
                  {agents.map((a) => <span key={a.id} className="font-mono">{a.score.toFixed(1)} {a.rank != null && <span className="text-muted">#{a.rank}</span>}</span>)}
                </Row>
                <Row label="Tools">
                  {agents.map((a) => {
                    const n = a.capabilities.flatMap((c) => c.tools).length;
                    return (
                      <span key={a.id} className="inline-flex items-center gap-1">
                        <Wrench size={12} className={n ? "text-violet" : "text-muted"} /> {n || "none"}
                      </span>
                    );
                  })}
                </Row>
                <Row label="Endpoint">
                  {agents.map((a) => (
                    <span key={a.id} className={`inline-flex items-center gap-1 ${a.health?.verified ? "text-pos" : "text-amber"}`}>
                      {a.health?.verified ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
                      {a.health?.verified ? "verified" : "unverified"}
                    </span>
                  ))}
                </Row>
                <Row label="x402">
                  {agents.map((a) => <span key={a.id}>{a.x402 ? "supported" : "—"}</span>)}
                </Row>
                <Row label="Protocols">
                  {agents.map((a) => <span key={a.id} className="text-[13px]">{a.protocols.join(", ") || "—"}</span>)}
                </Row>
                <Row label="Feedback">
                  {agents.map((a) => <span key={a.id}>{a.feedbackCount ? `${a.feedbackCount} · avg ${a.averageScore.toFixed(1)}` : "none"}</span>)}
                </Row>
                <Row label="Chains linked">
                  {agents.map((a) => <span key={a.id}>{a.crossChainCount || "single"}</span>)}
                </Row>
                <Row label="Owner">
                  {agents.map((a) => (
                    <a key={a.id} href={`https://bscscan.com/address/${a.ownerAddress}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-violet hover:underline">
                      {shortAddr(a.ownerAddress)} <ExternalLink size={10} />
                    </a>
                  ))}
                </Row>
              </tbody>
            </table>
          </div>
        </Reveal>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode[] }) {
  return (
    <tr>
      <td className="p-4 text-[13px] text-muted">{label}</td>
      {children.map((c, i) => (
        <td key={i} className="border-l border-white/8 p-4">{c}</td>
      ))}
    </tr>
  );
}
