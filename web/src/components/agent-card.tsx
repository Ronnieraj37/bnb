"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Wrench, ShieldCheck, AlertTriangle, MessageSquare, Play } from "lucide-react";
import type { Agent } from "@/lib/agents/types";
import { CATEGORIES } from "@/lib/agents/types";
import { ScoreRing } from "./score-ring";
import { CompareCheckbox } from "./compare-checkbox";
import { looksReadOnly } from "@/lib/mcp/client";

function Stat({ icon, label, tone }: { icon: React.ReactNode; label: string; tone?: "pos" | "neg" | "muted" }) {
  const c = tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : "text-muted";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${c}`}>
      {icon}
      {label}
    </span>
  );
}

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="group relative h-full"
    >
      {featured && (
        <div className="pointer-events-none absolute -top-2.5 left-4 z-10 rounded-full bg-linear-to-r from-violet to-magenta px-2.5 py-0.5 text-[10px] font-semibold text-white shadow-lg">
          Top ranked
        </div>
      )}
      <Link
        href={`/agents/${encodeURIComponent(agent.id)}`}
        className={`glass glow-hover flex h-full flex-col gap-3 rounded-2xl p-4 hover:border-violet/40 ${featured ? "border-violet/25" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base">{cat.emoji}</span>
              <h3 className="truncate font-semibold">{agent.name}</h3>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
              <span>{cat.label}</span>
              <span>·</span>
              <span className="font-mono">#{agent.tokenId}</span>
              {agent.x402 && (
                <span className="rounded bg-violet/15 px-1.5 py-0.5 text-[10px] text-violet">x402</span>
              )}
            </div>
          </div>
          <ScoreRing score={agent.score} rank={agent.rank} />
        </div>

        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted">
          {agent.description || "No description published to the registry."}
        </p>

        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tools.slice(0, 3).map((t) => (
              <span key={t} className="rounded border border-violet/25 bg-violet/5 px-1.5 py-0.5 font-mono text-[10px] text-violet">
                {t}
              </span>
            ))}
            {tools.length > 3 && (
              <span className="px-1 text-[10px] text-muted">+{tools.length - 3} more</span>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/8 pt-3">
          {tools.length > 0 ? (
            runnable > 0 ? (
              <Stat icon={<Play size={11} />} label={`${runnable} runnable`} tone="pos" />
            ) : (
              <Stat icon={<Wrench size={11} />} label={`${tools.length} tools`} />
            )
          ) : agent.detailed ? (
            // Only claim "no interface" when we actually checked — a list
            // record with empty capabilities just means we haven't looked yet.
            <Stat icon={<Wrench size={11} />} label="no interface" tone="muted" />
          ) : (
            <Stat icon={<Wrench size={11} />} label="see tools →" />
          )}
          {live ? (
            <Stat icon={<ShieldCheck size={11} />} label="endpoint live" tone="pos" />
          ) : agent.health?.error ? (
            <Stat icon={<AlertTriangle size={11} />} label="endpoint down" tone="neg" />
          ) : null}
          <Stat
            icon={<MessageSquare size={11} />}
            label={agent.feedbackCount ? `${agent.feedbackCount} reviews` : "no reviews"}
            tone={agent.feedbackCount ? undefined : "muted"}
          />
          <div className="ml-auto">
            <CompareCheckbox entry={{ id: agent.id, name: agent.name, category: agent.category }} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
