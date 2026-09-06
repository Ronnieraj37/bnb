"use client";

import { useState } from "react";
import { RadioTower, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { McpTool } from "@/lib/mcp/client";

// One clear "is this agent online?" panel. Replaces the two overlapping,
// contradictory widgets (a sidebar "Liveness" from the registry cache + a
// separate "Live verification" probe) that showed a bare "heyanon.ai: HTTP 404"
// and the cryptic line "This disagrees with the registry's cached status."
//
// Here we state, in plain language: what the registry last cached, what a live
// call to the endpoint just found, and what the difference means for a user.

type Result =
  | { ok: true; latencyMs: number; tools: McpTool[]; endpoint?: string }
  | { ok: false; latencyMs: number; error: string; endpoint?: string };

function hostOf(url?: string): string | null {
  if (!url) return null;
  try { return new URL(url).host; } catch { return null; }
}

export function AgentStatus({
  agentId,
  registrySaysVerified,
  registryError,
  onTools,
}: {
  agentId: string;
  registrySaysVerified: boolean;
  registryError?: string;
  onTools?: (tools: McpTool[]) => void;
}) {
  const [state, setState] = useState<"idle" | "checking" | "done">("idle");
  const [result, setResult] = useState<Result | null>(null);

  const check = async () => {
    setState("checking");
    try {
      const res = await fetch(`/api/mcp/status?id=${encodeURIComponent(agentId)}`);
      const json = (await res.json()) as Partial<Result> & { error?: string };
      // /api/mcp/status returns 404 with {error} when no MCP endpoint is published.
      const normalized: Result =
        typeof json.ok === "boolean"
          ? (json as Result)
          : { ok: false, latencyMs: 0, error: json.error ?? "No callable endpoint" };
      setResult(normalized);
      if (normalized.ok) onTools?.(normalized.tools);
    } catch {
      setResult({ ok: false, latencyMs: 0, error: "Could not reach our own server" });
    } finally {
      setState("done");
    }
  };

  const host = hostOf(result?.endpoint);

  return (
    <section className="rounded-2xl glass p-5">
      <div className="flex items-center gap-2">
        <RadioTower size={15} className="text-violet" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Is it online?</h2>
      </div>

      <p className="mt-1 text-[12px] text-muted">
        Whether the agent&apos;s endpoint answers a real call right now. The registry keeps a cached
        check, but caches go stale — so we can call it live instead of trusting that.
      </p>

      {/* What the registry cached */}
      <div className="mt-3 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-[12px]">
        <span className="text-muted">Registry&apos;s cached check</span>
        <span className={registrySaysVerified ? "text-pos" : "text-amber"}>
          {registrySaysVerified ? "online" : "offline"}
          {!registrySaysVerified && registryError && (
            <span className="ml-1 font-mono text-[11px] text-muted">({registryError})</span>
          )}
        </span>
      </div>

      {state === "idle" && (
        <button
          onClick={check}
          className="mt-3 flex items-center gap-1.5 rounded-lg bg-linear-to-r from-violet to-magenta px-3 py-1.5 text-[13px] font-medium text-white transition hover:brightness-110"
        >
          <RadioTower size={13} /> Call it live, now
        </button>
      )}

      {state === "checking" && (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <Loader2 size={14} className="animate-spin" /> Calling the agent&apos;s endpoint…
        </div>
      )}

      {state === "done" && result && (
        <div className={`mt-3 rounded-xl border px-3 py-2.5 ${result.ok ? "border-pos/30 bg-pos/5" : "border-neg/30 bg-neg/5"}`}>
          <div className={`flex items-center gap-2 text-[13px] font-medium ${result.ok ? "text-pos" : "text-neg"}`}>
            {result.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {result.ok ? "It answered" : "No answer"}
            <span className="ml-auto font-mono text-[11px] text-muted">{result.latencyMs}ms</span>
          </div>

          {result.ok ? (
            <p className="mt-1 text-[12px] text-muted">
              We just called its endpoint and it responded with {result.tools.length} live tools.
            </p>
          ) : (
            <p className="mt-1 break-words text-[12px] text-muted">
              {host ? <>The published endpoint (<span className="font-mono text-fg">{host}</span>) didn&apos;t respond: {result.error}. It&apos;s down or has moved.</>
                    : <>{result.error}</>}
            </p>
          )}

          {/* Plain-language reconciliation, not a cryptic "disagrees" line. */}
          {result.ok && !registrySaysVerified && (
            <p className="mt-2 rounded-lg bg-pos/10 px-2 py-1.5 text-[11px] text-pos">
              Good sign: the registry had it marked offline, but it&apos;s actually responding right now.
            </p>
          )}
          {!result.ok && registrySaysVerified && (
            <p className="mt-2 rounded-lg bg-amber/10 px-2 py-1.5 text-[11px] text-amber">
              Heads up: the registry says online, but it isn&apos;t answering us right now.
            </p>
          )}
          {result.ok === registrySaysVerified && (
            <p className="mt-2 rounded-lg bg-white/5 px-2 py-1.5 text-[11px] text-muted">
              This matches the registry&apos;s cached status.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
