// A minimal, safe JSON-RPC client for calling an agent's live MCP endpoint.
//
// This is the core of "live verification": 8004scan caches an endpoint health
// check that can be stale or simply wrong (we confirmed this directly — it
// reports 404 for an endpoint that responds correctly to a real call). We
// probe the agent ourselves, on demand, and show what actually happened.
//
// Safety: this client is only ever called with an endpoint URL that WE looked
// up server-side from an agent's own registry record — never with a URL
// supplied directly by a client request. That is what keeps /api/mcp/* from
// being an open proxy.

const TIMEOUT_MS = 8000;

export type McpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
};

export type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: string[];
  items?: JsonSchema;
  description?: string;
};

export type McpProbe =
  | { ok: true; latencyMs: number; tools: McpTool[] }
  | { ok: false; latencyMs: number; error: string };

async function rpc(endpoint: string, method: string, params: unknown) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "MCP error");
  return json.result;
}

/** Live-list an agent's tools. This is the truth; the registry's copy may be stale. */
export async function probeTools(endpoint: string): Promise<McpProbe> {
  const t0 = Date.now();
  try {
    const result = await rpc(endpoint, "tools/list", {});
    return { ok: true, latencyMs: Date.now() - t0, tools: result?.tools ?? [] };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - t0, error: describeError(e) };
  }
}

/** Call one tool live. Only ever invoked server-side against a read-only tool. */
export async function callTool(
  endpoint: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  try {
    const result = await rpc(endpoint, "tools/call", { name, arguments: args });
    // MCP wraps results in a content array; unwrap the common text/json case.
    const text = result?.content?.[0]?.text;
    if (typeof text === "string") {
      try {
        return { ok: true, result: JSON.parse(text) };
      } catch {
        return { ok: true, result: text };
      }
    }
    return { ok: true, result: result?.structuredContent ?? result };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

function describeError(e: unknown): string {
  if (e instanceof DOMException && e.name === "TimeoutError") {
    return `No response within ${TIMEOUT_MS}ms`;
  }
  return e instanceof Error ? e.message : "Request failed";
}

/**
 * Whether a tool is safe to invoke straight from the browser: no wallet,
 * no funds, nothing to sign. Judged by name convention (get/list/fetch/…)
 * AND by absence of sensitive-looking required fields — both must agree.
 */
const READ_PREFIX = /^(get|list|fetch|read|estimate|query|check|view|describe)/i;
const SENSITIVE_FIELD = /address|wallet|amount|value|private|secret|signature|key$/i;

/**
 * Cheap, name-only heuristic — usable anywhere we only have a tool's name
 * (e.g. the registry's cached tool list on a marketplace card, with no
 * schema attached). This is optimistic and MUST NOT gate an actual call.
 */
export function looksReadOnly(name: string): boolean {
  return READ_PREFIX.test(name);
}

/**
 * The real check, used to decide whether a live call is actually safe. Needs
 * the tool's full schema, which only a live tools/list probe provides.
 */
export function isReadOnly(tool: McpTool): boolean {
  if (!READ_PREFIX.test(tool.name)) return false;
  const required = tool.inputSchema?.required ?? [];
  return !required.some((f) => SENSITIVE_FIELD.test(f));
}
