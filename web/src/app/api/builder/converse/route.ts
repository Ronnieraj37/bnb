import { NextResponse } from "next/server";
import { buildSystemPrompt, GEMINI_TOOLS, sanitizePlan, backfillFromConversation } from "@/lib/builder/agent";

// Free-tier Gemini models occasionally return 503 "high demand" — retry once,
// then fall back to a lighter model that's seen less contention.
const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
const MAX_QUESTIONS = 3;

type GeminiPart = { text?: string; functionCall?: { name: string; args: Record<string, unknown> } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { contents?: GeminiContent[]; message?: string } | null;
  if (!body?.message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "The AI flow builder needs GEMINI_API_KEY configured on the server." }, { status: 500 });
  }

  const priorContents = Array.isArray(body.contents) ? body.contents : [];
  const contents: GeminiContent[] = [...priorContents, { role: "user", parts: [{ text: body.message }] }];

  const questionsAsked = priorContents.filter((c) =>
    c.role === "model" && c.parts.some((p) => p.functionCall?.name === "ask_clarifying_question"),
  ).length;
  const forcePlan = questionsAsked >= MAX_QUESTIONS;

  const requestBody = JSON.stringify({
    contents,
    systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
    tools: GEMINI_TOOLS,
    toolConfig: {
      functionCallingConfig: forcePlan
        ? { mode: "ANY", allowedFunctionNames: ["propose_plan"] }
        : { mode: "ANY" },
    },
  });

  let data: { candidates?: { content: GeminiContent }[]; error?: { message?: string } } | null = null;
  let lastErrorMessage = "Could not reach the AI agent.";
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: requestBody, signal: AbortSignal.timeout(15_000) },
      );
      const json = await res.json().catch(() => null);
      if (res.ok && json) {
        data = json;
        break;
      }
      lastErrorMessage = json?.error?.message ?? `Gemini API error ${res.status}`;
    } catch {
      lastErrorMessage = "Could not reach the AI agent.";
    }
  }
  if (!data) {
    return NextResponse.json({ error: `The AI agent failed: ${lastErrorMessage}` }, { status: 502 });
  }

  const modelContent = data.candidates?.[0]?.content as GeminiContent | undefined;
  const call = modelContent?.parts?.find((p) => p.functionCall)?.functionCall;
  if (!modelContent || !call) {
    return NextResponse.json({ error: "The agent didn't return a usable response — try rephrasing." }, { status: 502 });
  }

  const newContents = [...contents, modelContent];

  if (call.name === "ask_clarifying_question") {
    const question = typeof call.args.question === "string" ? call.args.question : "Could you say more about what you want this flow to do?";
    return NextResponse.json({ type: "question", question, contents: newContents });
  }

  let nodes = sanitizePlan(call.args.nodes);
  if (!nodes.length) {
    return NextResponse.json({ error: "The agent couldn't build a valid flow from that — try rephrasing or being more specific." }, { status: 502 });
  }
  const userText = contents.filter((c) => c.role === "user").flatMap((c) => c.parts.map((p) => p.text ?? "")).join(" ");
  nodes = backfillFromConversation(nodes, userText);
  const name = typeof call.args.name === "string" ? call.args.name : "Custom flow";
  const explain = typeof call.args.explain === "string" ? call.args.explain : "";
  return NextResponse.json({ type: "plan", name, explain, nodes, contents: newContents });
}
