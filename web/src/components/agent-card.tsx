import Link from "next/link";
import { AlertTriangle, MessageSquare, Play, ArrowUpRight, Star } from "lucide-react";
import type { Agent } from "@/lib/agents/types";
import { CATEGORIES } from "@/lib/agents/types";
import { ScoreRing } from "./score-ring";
import { CompareCheckbox } from "./compare-checkbox";
import { looksReadOnly } from "@/lib/mcp/client";

export function AgentCard({
  agent,
  index = 0,
  featured = false,
}: {
  agent: Agent;
  index?: number;
  featured?: boolean;
}) {
  const cat = CATEGORIES[agent.category];
  const tools = agent.capabilities.flatMap((c) => c.tools);
  const runnable = tools.filter(looksReadOnly).length;
  const live = agent.health?.verified;
  const down = !live && Boolean(agent.health?.error);

  return (
    <div className="reveal group relative h-full" style={{ animationDelay: `${Math.min(index * 0.03, 0.24)}s` }}>
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className="card card-hover flex h-full flex-col overflow-hidden"
      >
        {/* accent top edge, per category */}
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${cat.accent}, transparent 70%)` }} />

        <div className="flex flex-col gap-3 p-4">
          {/* header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span
                className="pill mb-2"
                style={{ background: `${cat.accent}1f`, color: cat.accent }}
              >
                <span>{cat.emoji}</span> {cat.label}
              </span>
              <h3 className="truncate text-[15px] font-semibold leading-tight text-fg">{agent.name}</h3>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                <span className="font-mono">#{agent.tokenId}</span>
                {agent.x402 && <span className="rounded bg-violet/15 px-1.5 py-0.5 text-[10px] font-medium text-violet">x402</span>}
                {featured && <span className="rounded bg-violet/15 px-1.5 py-0.5 text-[10px] font-medium text-violet">Top ranked</span>}
              </div>
            </div>
            <ScoreRing score={agent.score} rank={agent.rank} />
          </div>

          {/* what it does — always present, data-independent */}
          <p className="line-clamp-2 min-h-[2.4rem] text-[13px] leading-relaxed text-muted">
            {agent.description || cat.blurb}
          </p>
        </div>

        {/* stat footer */}
        <div className="mt-auto flex items-center gap-3 border-t border-white/[0.06] bg-white/[0.015] px-4 py-2.5 text-[11px]">
          {live ? (
            <span className="inline-flex items-center gap-1 text-pos"><span className="h-1.5 w-1.5 rounded-full bg-pos" /> Live</span>
          ) : down ? (
            <span className="inline-flex items-center gap-1 text-neg"><AlertTriangle size={11} /> Offline</span>
          ) : (
            <span className="inline-flex items-center gap-1 text-muted"><span className="h-1.5 w-1.5 rounded-full bg-muted/50" /> Unverified</span>
          )}

          {tools.length > 0 ? (
            runnable > 0 ? (
              <span className="inline-flex items-center gap-1 text-violet"><Play size={11} /> {runnable} runnable</span>
            ) : (
              <span className="text-muted">{tools.length} tools</span>
            )
          ) : null}

          <span className="inline-flex items-center gap-1 text-muted">
            {agent.feedbackCount ? <><Star size={11} className="text-violet" /> {agent.averageScore.toFixed(1)}</> : <><MessageSquare size={11} /> new</>}
          </span>

          <span className="ml-auto inline-flex items-center gap-1 font-medium text-muted transition group-hover:text-violet">
            View <ArrowUpRight size={12} />
          </span>
        </div>
      </Link>

      {/* compare toggle floats top-right, out of the link */}
      <div className="absolute right-3 top-[3.35rem] z-10">
        <CompareCheckbox entry={{ id: agent.id, name: agent.name, category: agent.category }} />
      </div>
    </div>
  );
}
