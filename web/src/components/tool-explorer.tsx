"use client";

import { useState } from "react";
import { Play, Loader2, Lock, ChevronDown, Check, X } from "lucide-react";
import type { McpTool, JsonSchema } from "@/lib/mcp/client";
import { isReadOnly } from "@/lib/mcp/client";

// Renders an agent's REAL declared interface — one card per MCP tool, built
// from its actual JSON-Schema. Read-only tools get a form generated from that
// schema and a Run button that calls the agent live; write tools are shown
// as locked, because they move funds and need a wallet, not a click.

function fieldsOf(schema: JsonSchema): [string, JsonSchema][] {
  return Object.entries(schema.properties ?? {});
}

function defaultFor(schema: JsonSchema): unknown {
  if (schema.enum?.length) return schema.enum[0];
  if (schema.type === "number" || schema.type === "integer") return 0;
  if (schema.type === "boolean") return false;
  if (schema.type === "array") return [];
  if (schema.type === "object") return {};
  return "";
}

function isSimple(schema: JsonSchema): boolean {
  // Flat scalar/enum fields render as real inputs; anything nested (arrays of
  // objects, sub-objects) falls back to a JSON editor rather than a fragile
  // auto-generated nested form.
  return fieldsOf(schema).every(
    ([, f]) => !f.enum && (f.type === "string" || f.type === "number" || f.type === "integer" || f.type === "boolean") ,
  ) || fieldsOf(schema).every(([, f]) => Boolean(f.enum) || ["string", "number", "integer", "boolean"].includes(f.type ?? ""));
}

function ToolCard({ agentId, tool }: { agentId: string; tool: McpTool }) {
  const [open, setOpen] = useState(false);
  const fields = fieldsOf(tool.inputSchema);
  const readOnly = isReadOnly(tool);
  const simple = fields.length === 0 || isSimple(tool.inputSchema);

  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map(([k, f]) => [k, defaultFor(f)])),
  );
  const [raw, setRaw] = useState("{}");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; data: unknown } | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const args = simple ? values : JSON.parse(raw || "{}");
      const res = await fetch("/api/mcp/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId, tool: tool.name, args }),
      });
      const json = await res.json();
      setResult({ ok: res.ok && json.ok !== false, data: json.error ?? json.result });
    } catch (e) {
      setResult({ ok: false, data: e instanceof Error ? e.message : "Invalid input" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={`rounded-xl border transition ${open ? "border-violet/40 bg-violet/[0.03]" : "border-white/8 bg-white/[0.02]"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-[13px] text-fg">{tool.name}</span>
          {readOnly ? (
            <span className="shrink-0 rounded bg-pos/15 px-1.5 py-0.5 text-[10px] text-pos">read-only</span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 rounded bg-amber/15 px-1.5 py-0.5 text-[10px] text-amber">
              <Lock size={9} /> needs wallet
            </span>
          )}
        </div>
        <ChevronDown size={15} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/8 px-3 py-3">
          {tool.description && <p className="mb-3 text-[12px] text-muted">{tool.description}</p>}

          {!readOnly ? (
            <p className="rounded-lg border border-amber/25 bg-amber/5 px-3 py-2 text-[12px] text-amber">
              This tool signs and moves funds, so it can&apos;t run from a click here — it needs a
              wallet and your explicit approval.
            </p>
          ) : (
            <>
              {fields.length > 0 && (
                <div className="mb-3 space-y-2">
                  {simple ? (
                    fields.map(([key, f]) => (
                      <label key={key} className="flex flex-col gap-1">
                        <span className="text-[11px] text-muted">
                          {key}
                          {tool.inputSchema.required?.includes(key) && <span className="text-neg"> *</span>}
                        </span>
                        {f.enum ? (
                          <select
                            value={String(values[key] ?? "")}
                            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                            className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-violet/50"
                          >
                            {f.enum.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            type={f.type === "number" || f.type === "integer" ? "number" : "text"}
                            value={String(values[key] ?? "")}
                            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                            placeholder={f.description}
                            className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-violet/50"
                          />
                        )}
                      </label>
                    ))
                  ) : (
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted">
                        Arguments (JSON) — this tool&apos;s shape is nested, so edit it directly
                      </span>
                      <textarea
                        value={raw}
                        onChange={(e) => setRaw(e.target.value)}
                        rows={4}
                        placeholder={JSON.stringify(Object.fromEntries(fields.map(([k]) => [k, "…"])), null, 1)}
                        className="rounded-lg bg-white/5 px-2.5 py-1.5 font-mono text-[12px] outline-none focus:ring-1 focus:ring-violet/50"
                      />
                    </label>
                  )}
                </div>
              )}
              <button
                onClick={run}
                disabled={running}
                className="flex items-center gap-1.5 rounded-lg bg-linear-to-r from-violet to-magenta px-3 py-1.5 text-[13px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                Run live
              </button>

              {result && (
                <div className={`mt-2 rounded-lg border px-3 py-2 text-[12px] ${result.ok ? "border-pos/25 bg-pos/5" : "border-neg/25 bg-neg/5"}`}>
                  <div className={`mb-1 flex items-center gap-1.5 font-medium ${result.ok ? "text-pos" : "text-neg"}`}>
                    {result.ok ? <Check size={12} /> : <X size={12} />}
                    {result.ok ? "Live response" : "Error"}
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-fg">
                    {typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 1)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolExplorer({ agentId, tools }: { agentId: string; tools: McpTool[] }) {
  if (!tools.length) return null;
  const readCount = tools.filter(isReadOnly).length;

  return (
    <div>
      <p className="mb-3 text-[13px] text-muted">
        {tools.length} tools it publishes · {readCount} you can run right now, live, with no wallet.
      </p>
      <div className="space-y-2">
        {tools.map((t) => (
          <ToolCard key={t.name} agentId={agentId} tool={t} />
        ))}
      </div>
    </div>
  );
}
