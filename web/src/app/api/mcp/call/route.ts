import { NextResponse } from "next/server";
import { getAgent } from "@/lib/agents";
import { callTool, isReadOnly, type McpTool } from "@/lib/mcp/client";

// Invoke one read-only tool on a real agent, live.
//
// The client sends only { agentId, tool, args } — never a URL. The endpoint
// is always looked up server-side from the agent's own registry record, and
// the tool is re-validated as read-only server-side too (never trust the
// client's own judgement of what's safe). This is what keeps this route from
// being a generic SSRF proxy.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { agentId?: string; tool?: string; args?: Record<string, unknown> }
    | null;
  if (!body?.agentId || !body.tool) {
    return NextResponse.json({ error: "agentId and tool required" }, { status: 400 });
  }

  const agent = await getAgent(body.agentId);
  if (!agent) return NextResponse.json({ error: "agent not found" }, { status: 404 });

  const mcp = agent.capabilities.find((c) => c.kind === "mcp");
  if (!mcp) return NextResponse.json({ error: "no MCP endpoint" }, { status: 404 });

  // Re-fetch the live tool list rather than trusting the cached registry copy
  // or anything the client asserts — the whole point is not to trust stale data.
  const { probeTools } = await import("@/lib/mcp/client");
  const probe = await probeTools(mcp.endpoint);
  if (!probe.ok) {
    return NextResponse.json({ error: `Agent endpoint unreachable: ${probe.error}` }, { status: 502 });
  }

  const tool = probe.tools.find((t: McpTool) => t.name === body.tool);
  if (!tool) return NextResponse.json({ error: "tool not found on this agent" }, { status: 404 });
  if (!isReadOnly(tool)) {
    return NextResponse.json({ error: "this tool can move funds and requires a wallet — not runnable here" }, { status: 403 });
  }

  const result = await callTool(mcp.endpoint, body.tool, body.args ?? {});
  return NextResponse.json(result);
}
