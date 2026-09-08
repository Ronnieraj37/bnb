import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import type { Agent } from "@/lib/agents/types";
import { CATEGORIES } from "@/lib/agents/types";
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
  const score = Math.max(0, Math.min(100, agent.score));
  const scoreTone = score >= 60 ? "var(--color-pos)" : score >= 30 ? "var(--color-violet)" : "var(--color-muted)";

  return (
    <div className="reveal group relative h-full" style={{ animationDelay: `${Math.min(index * 0.035, 0.28)}s` }}>
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className={`card card-hover sheen relative flex h-full flex-col p-5 ${featured ? "border-violet/30" : ""}`}
      >
        {/* category — a quiet accent label, not a heavy chip */}
        <span
          className="inline-flex items-center gap-2 text-[11px] font-medium tracking-wide"
          style={{ color: cat.accent }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.accent }} />
          {cat.label}
        </span>

        {/* the focal point */}
        <h3 className="mt-3.5 line-clamp-1 text-[17px] font-semibold leading-snug tracking-tight text-fg">
          {agent.name}
        </h3>

        <p className="mt-2 line-clamp-2 min-h-[2.6rem] text-[13px] leading-relaxed text-muted">
          {agent.description || cat.blurb}
        </p>

        {/* score as a calm meter rather than a dial */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">Registry score</span>
            <span className="stat-value text-[13px] font-semibold" style={{ color: scoreTone }}>
              {agent.score.toFixed(0)}
              <span className="ml-0.5 text-[10px] font-normal text-muted">/100</span>
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreTone }} />
          </div>
        </div>

        {/* one quiet meta line */}
        <div className="mt-4 flex items-center gap-2 border-t border-white/[0.06] pt-3 text-[11px] text-muted">
          {live ? (
            <span className="inline-flex items-center gap-1.5 text-pos"><span className="h-1.5 w-1.5 rounded-full bg-pos" /> Live</span>
          ) : down ? (
            <span className="inline-flex items-center gap-1.5 text-neg"><AlertTriangle size={11} /> Offline</span>
          ) : (
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-muted/40" /> Unverified</span>
          )}
          {actions > 0 && <><span className="text-muted/30">·</span><span>{actions} action{actions > 1 ? "s" : ""}</span></>}
          {agent.feedbackCount > 0 && <><span className="text-muted/30">·</span><span>{agent.averageScore.toFixed(1)}★</span></>}

          <span className="ml-auto inline-flex items-center gap-1 font-medium transition-colors group-hover:text-violet">
            View <ArrowUpRight size={12} className="arrow-slide" />
          </span>
        </div>
      </Link>

      {/* compare toggle sits outside the link so it stays clickable */}
      <div className="absolute right-4 top-4 z-10">
        <CompareCheckbox entry={{ id: agent.id, name: agent.name, category: agent.category }} />
      </div>
    </div>
  );
}
