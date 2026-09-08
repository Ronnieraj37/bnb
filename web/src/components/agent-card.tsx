import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import type { Agent } from "@/lib/agents/types";
import { CATEGORIES } from "@/lib/agents/types";
import { ScoreRing } from "./score-ring";
import { CompareCheckbox } from "./compare-checkbox";
import { looksReadOnly } from "@/lib/mcp/describe";

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
  // Fund-moving calls are the decision-relevant signal: what it can do with your money.
  const actions = tools.filter((t) => !looksReadOnly(t)).length;
  const live = agent.health?.verified;
  const down = !live && Boolean(agent.health?.error);

  return (
    <div className="reveal group relative h-full" style={{ animationDelay: `${Math.min(index * 0.03, 0.24)}s` }}>
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className={`card card-hover flex h-full flex-col overflow-hidden ${featured ? "border-violet/30" : ""}`}
      >
        <div className="flex flex-1 flex-col p-5">
          {/* header: category + score, well separated */}
          <div className="flex items-start justify-between gap-4">
            <span className="pill" style={{ background: `${cat.accent}1f`, color: cat.accent }}>
              <span>{cat.emoji}</span> {cat.label}
            </span>
            <ScoreRing score={agent.score} rank={agent.rank} />
          </div>

          <h3 className="mt-3.5 truncate text-base font-semibold leading-snug text-fg">{agent.name}</h3>

          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted">
            {agent.description || cat.blurb}
          </p>

          {/* one quiet meta line, not a row of competing chips */}
          <div className="mt-4 flex items-center gap-2 text-[11px] text-muted">
            {live ? (
              <span className="inline-flex items-center gap-1.5 text-pos"><span className="h-1.5 w-1.5 rounded-full bg-pos" /> Live</span>
            ) : down ? (
              <span className="inline-flex items-center gap-1.5 text-neg"><AlertTriangle size={11} /> Offline</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-muted/40" /> Unverified</span>
            )}
            {actions > 0 && <><span className="text-muted/30">·</span><span>{actions} action{actions > 1 ? "s" : ""}</span></>}
            {agent.feedbackCount > 0 && <><span className="text-muted/30">·</span><span>{agent.averageScore.toFixed(1)}★</span></>}
            <span className="ml-auto inline-flex items-center gap-1 text-muted transition group-hover:text-violet">
              View <ArrowUpRight size={12} />
            </span>
          </div>
        </div>
      </Link>

      {/* compare toggle floats top-right, out of the link */}
      <div className="absolute right-3 top-[3.35rem] z-10">
        <CompareCheckbox entry={{ id: agent.id, name: agent.name, category: agent.category }} />
      </div>
    </div>
  );
}
