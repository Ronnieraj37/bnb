import { NextResponse } from "next/server";
import { getAgent } from "@/lib/agents";
import { probeTools } from "@/lib/mcp/client";

// Live-probe one agent's MCP endpoint, right now. This exists specifically
// because the registry's own cached health check can be wrong — verified by
// hand against a real agent that 8004scan reports as 404 but which answers
// correctly when called directly.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const agent = await getAgent(id);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });

  const mcp = agent.capabilities.find((c) => c.kind === "mcp");
  if (!mcp) return NextResponse.json({ error: "no MCP endpoint published" }, { status: 404 });

  const probe = await probeTools(mcp.endpoint);
  return NextResponse.json({ endpoint: mcp.endpoint, ...probe });
}
