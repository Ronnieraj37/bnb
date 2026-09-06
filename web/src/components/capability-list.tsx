"use client";

import { Eye, Coins } from "lucide-react";
import { describeTools, strategySummary, type PlainTool } from "@/lib/mcp/describe";

// What the agent actually does, in plain English — the fix for the raw
// "createWallet / swapExactTokensForTokens" jargon dump. Two clear groups:
// reads (safe, no funds) and actions that move your money. The live "run a
// read-only call" surface is kept separately (ToolExplorer), below this.

export function CapabilityList({
  category,
  toolNames,
}: {
  category: string;
  toolNames: string[];
}) {
  const { reads, actions } = describeTools(toolNames);

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg/90">{strategySummary(category, toolNames)}</p>

      {actions.length > 0 && (
        <Group
          icon={<Coins size={14} className="text-amber" />}
          title="Actions that move your money"
          note="These sign transactions. When you hire this agent, you choose which of these it may use and cap what it can spend."
          tools={actions}
          tone="amber"
        />
      )}

      {reads.length > 0 && (
        <Group
          icon={<Eye size={14} className="text-pos" />}
          title="Reads — safe, no funds touched"
          note="Information only. You can try these live below without connecting a wallet."
          tools={reads}
          tone="pos"
        />
      )}

      {reads.length === 0 && actions.length === 0 && (
        <p className="text-[13px] text-muted">
          This agent hasn&apos;t published a callable interface, so there&apos;s nothing to break down here.
          Judge it on its on-chain track record above.
        </p>
      )}
    </div>
  );
}

function Group({
  icon, title, note, tools, tone,
}: {
  icon: React.ReactNode; title: string; note: string; tools: PlainTool[]; tone: "amber" | "pos";
}) {
  const dot = tone === "amber" ? "bg-amber" : "bg-pos";
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-fg">{icon}{title}</div>
      <p className="mb-2 mt-0.5 text-[11px] text-muted">{note}</p>
      <ul className="space-y-1.5">
        {tools.map((t) => (
          <li key={t.name} className="flex items-start gap-2 rounded-lg bg-white/[0.02] px-3 py-1.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
            <span className="min-w-0">
              <span className="text-[13px] text-fg">{t.plain}</span>
              <span className="ml-2 font-mono text-[10px] text-muted">{t.name}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
