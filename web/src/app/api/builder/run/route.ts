import { NextResponse } from "next/server";
import { runBlocks, type BlockInput } from "@/lib/builder/run";

// Executes a user-built graph for real: each block is a live contract read
// or live market-data fetch, run server-side in order. No step here ever
// invents an output — see lib/builder/run.ts.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { blocks?: BlockInput[] } | null;
  if (!body?.blocks?.length) {
    return NextResponse.json({ error: "blocks required" }, { status: 400 });
  }
  if (body.blocks.length > 12) {
    return NextResponse.json({ error: "too many blocks (max 12)" }, { status: 400 });
  }
  try {
    const result = await runBlocks(body.blocks);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "run failed" }, { status: 500 });
  }
}
