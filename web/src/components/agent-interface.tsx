"use client";

import { useState } from "react";
import { Wrench, Play } from "lucide-react";
import type { McpTool } from "@/lib/mcp/client";
import { AgentStatus } from "./agent-status";
import { CapabilityList } from "./capability-list";
import { ToolExplorer } from "./tool-explorer";

// Ties the live status probe to the capability view. We always show the plain-
// English breakdown from the registry's cached tool names; once a user calls
// the endpoint live (AgentStatus), we additionally load the real schemas and
// let them run a read-only tool for themselves.
export function AgentInterface({
  agentId,
  category,
  registryToolNames,
  registrySaysVerified,
  registryError,
}: {
  agentId: string;
  category: string;
  registryToolNames: string[];
  registrySaysVerified: boolean;
  registryError?: string;
}) {
  const [liveTools, setLiveTools] = useState<McpTool[] | null>(null);

  return (
    <>
      <AgentStatus
        agentId={agentId}
        registrySaysVerified={registrySaysVerified}
        registryError={registryError}
        onTools={setLiveTools}
      />

      <section className="card p-5">
        <div className="flex items-center gap-2">
          <Wrench size={15} className="text-violet" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            What this agent does
          </h2>
        </div>

        <div className="mt-3">
          <CapabilityList category={category} toolNames={registryToolNames} />
        </div>

        {/* Live "try it yourself" surface — appears after a live check loads the
            real schemas. Read-only tools become runnable forms. */}
        {liveTools && liveTools.length > 0 && (
          <div className="mt-4 border-t border-white/8 pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-fg">
              <Play size={13} className="text-violet" /> Try a read-only call, live
            </div>
            <ToolExplorer agentId={agentId} tools={liveTools} />
          </div>
        )}
        {!liveTools && registryToolNames.length > 0 && (
          <p className="mt-3 text-[11px] text-muted">
            Want to run one yourself? Use “Call it live” above to load the real parameters and try a
            read-only tool with no wallet.
          </p>
        )}
      </section>
    </>
  );
}
