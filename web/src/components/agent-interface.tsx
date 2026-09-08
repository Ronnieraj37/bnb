import { Wrench } from "lucide-react";
import { CapabilityList } from "./capability-list";

// What the agent does, in plain English. (The old on-demand "Is it online?"
// live-probe card was removed — it was unreliable across agents and the hero
// already shows the registry's endpoint status.) This is now a clean, static
// server-rendered breakdown — no flaky client probe.
export function AgentInterface({
  category,
  registryToolNames,
}: {
  category: string;
  registryToolNames: string[];
}) {
  return (
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
    </section>
  );
}
