// The real flow-building agent — a live LLM (Gemini, free tier) that knows
// every real block this product can execute, and either asks one short
// clarifying question or emits a complete graph. No keyword matching.

import { BLOCKS, findBlock, defaultConfig, type ConfigValue } from "./blocks";

export type PlanNode = { type: string; config: Record<string, ConfigValue> };

/**
 * The real fields each block's execution actually returns (see run.ts). A
 * `logic.condition` right after a block can only meaningfully test fields
 * from THIS list — anything else evaluates against nothing and silently
 * always passes. Exported so sanitizePlan can enforce it server-side too.
 */
export const OUTPUT_FIELDS: Record<string, string[]> = {
  "trigger.schedule": ["fires"],
  "skill.venusHealth": ["excessLiquidityUsd", "shortfallUsd", "atRiskOfLiquidation", "errorCode"],
  "skill.bscYields": ["bestApyPct", "bestProject", "top"],
  "skill.priceVolatility": ["lastPriceUsd", "realisedVolatilityPct30d"],
  "skill.pancakePool": ["found", "poolAddress", "poolRatio", "marketRatio", "deviationPct"],
  "skill.gasEstimate": ["gasPriceGwei", "gasCostBnb", "gasCostUsd", "bnbUsd"],
  "logic.condition": ["continue"],
  "logic.compareNetOfGas": ["dailyGainUsd", "gasCostUsd", "daysToBreakeven", "worthSwitching", "continue"],
  "io.telegram": ["sent", "reason"],
  "io.webhook": ["sent", "error"],
};

export function buildSystemPrompt(): string {
  const catalogue = BLOCKS.map((b) => {
    const fields = b.fields.length
      ? b.fields
          .map((f) => {
            const opts = f.options ? ` [choices: ${f.options.map((o) => o.value).join(", ")}]` : "";
            const def = f.def !== undefined ? `, default ${JSON.stringify(f.def)}` : "";
            return `    - ${f.key} (${f.type}${opts}${def}): ${f.label}${f.help ? " — " + f.help : ""}`;
          })
          .join("\n")
      : "    (no fields)";
    const outputs = OUTPUT_FIELDS[b.type];
    return [
      `• ${b.type} — "${b.label}" [${b.kind}]`,
      `  ${b.desc}`,
      b.requires?.length ? `  requires: ${b.requires.join(", ")}` : "",
      b.writes ? "  MOVES FUNDS — only ever run client-side, signed by the user's own wallet. Never claim you executed it." : "",
      fields,
      outputs?.length ? `  real output fields (usable in a logic.condition right after this block): ${outputs.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n\n");

  return `You are the flow-building agent for Proven, a real BNB Smart Chain agent marketplace. Users describe an automation in plain English; you turn it into a graph built ONLY from the real blocks below — every one is a genuine live read (DeFiLlama, Binance, Venus, PancakeSwap testnet) or a real wallet-signed transaction. Nothing is simulated, so never invent a block, field, token, or chain that isn't listed.

THE ONLY BLOCKS THAT EXIST:

${catalogue}

HARD RULES:
- Never ask for or accept a raw token contract address. The only tokens that exist here are the curated symbols shown above, on BSC TESTNET — always fill token fields with one of those exact symbols.
- The only chain is BNB Smart Chain; the only DEX with a live pool/swap integration is PancakeSwap v3 (testnet). skill.bscYields compares real APYs across several BSC protocols (Venus, Lista, Aave, PancakeSwap) for yield-shopping — it is not itself a swap venue.
- If the user names something unsupported (a different chain, "Uniswap" by name, an arbitrary token or address), do NOT silently substitute — call ask_clarifying_question naming the closest real equivalent we do support and let them confirm.
- Ask at most one short, specific question per turn, and only when a required field truly has no sensible default. Prefer the defaults shown above (protocol "all", fee tier 2500, a 4-hour schedule, WBNB/CAKE) so most requests resolve in one or two turns — this product deliberately keeps the sample space small so it stays easy to use.
- Order nodes sensibly: trigger, then real reads/skills, then logic, then an optional write action, then an optional alert.
- A logic.condition's "expr" is evaluated against the REAL OUTPUT of the block immediately before it in the list — it can ONLY reference one of that block's "real output fields" shown above (e.g. "shortfallUsd > 0" only makes sense directly after skill.venusHealth). Never reuse an example field name after a different block; if no earlier block produces a useful field to gate on, leave logic.condition out entirely rather than writing a condition that can't evaluate.
- Call propose_plan exactly once you have enough information, with the full ordered node list and a short, honest 1-2 sentence explanation — say plainly if you substituted anything.
- Otherwise call ask_clarifying_question. Always call exactly one of these two functions — never reply with plain text.
- When the user answers a question you asked, that value MUST end up in the matching field's config in the final propose_plan call (e.g. a chat ID they give you goes into that block's "chatId" field) — never drop an answer the user already gave you.`;
}

const FUNCTION_DECLARATIONS = [
  {
    name: "ask_clarifying_question",
    description: "Ask the user one short, specific question because a required detail is missing and has no sensible default.",
    parameters: {
      type: "object",
      properties: { question: { type: "string", description: "A single, short question for the user." } },
      required: ["question"],
    },
  },
  {
    name: "propose_plan",
    description: "Emit the final flow graph once you have enough information to build it.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "A short name for the flow." },
        explain: { type: "string", description: "1-2 plain-English sentences describing what the flow does, honest about any substitutions." },
        nodes: {
          type: "array",
          description: "The ordered blocks that make up the flow.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: BLOCKS.map((b) => b.type), description: "One of the real block types listed above." },
              config: { type: "object", description: "Field values for this block, keyed by field key, e.g. {\"tokenIn\": \"WBNB\", \"tokenOut\": \"CAKE\"}." },
            },
            required: ["type", "config"],
          },
        },
      },
      required: ["name", "explain", "nodes"],
    },
  },
];

export const GEMINI_TOOLS = [{ functionDeclarations: FUNCTION_DECLARATIONS }];

/** Validates and coerces the model's proposed nodes against the real block registry — never trust LLM output directly. */
export function sanitizePlan(rawNodes: unknown): PlanNode[] {
  if (!Array.isArray(rawNodes)) return [];
  const out: PlanNode[] = [];
  for (const raw of rawNodes) {
    if (!raw || typeof raw !== "object") continue;
    const type = (raw as { type?: unknown }).type;
    if (typeof type !== "string") continue;
    const def = findBlock(type);
    if (!def) continue;
    const given = (raw as { config?: unknown }).config;
    const givenConfig = given && typeof given === "object" ? (given as Record<string, unknown>) : {};
    const config = defaultConfig(def);
    for (const f of def.fields) {
      const v = givenConfig[f.key];
      if (v === undefined) continue;
      if (f.type === "select") {
        if (typeof v === "string" && f.options?.some((o) => o.value === v)) config[f.key] = v;
      } else if (f.type === "number") {
        const n = Number(v);
        if (Number.isFinite(n)) config[f.key] = n;
      } else if (typeof v === "string" || typeof v === "number") {
        config[f.key] = v;
      }
    }

    // A logic.condition only ever evaluates against the block immediately
    // before it (see run.ts) — if the model wired its expr to a field that
    // block doesn't actually output, the condition can never evaluate and is
    // worse than useless. Drop it rather than ship a broken gate.
    if (type === "logic.condition") {
      const prevType = out[out.length - 1]?.type;
      const field = String(config.expr ?? "").match(/^([a-zA-Z_][\w.]*)/)?.[1];
      const validFields = prevType ? OUTPUT_FIELDS[prevType] : undefined;
      if (!field || !validFields?.includes(field)) continue;
    }

    out.push({ type, config });
  }
  return out;
}

/**
 * Small LLMs sometimes ask the right clarifying question but then forget to
 * carry the user's answer into the final plan. As a deterministic safety net,
 * fill any still-empty wallet/chatId/url field by pattern-matching the raw
 * conversation text — never overwrites a value the model did set.
 */
export function backfillFromConversation(nodes: PlanNode[], userText: string): PlanNode[] {
  const wallet = userText.match(/0x[a-fA-F0-9]{40}/)?.[0];
  const chatId = userText.match(/\b\d{6,12}\b/)?.[0];
  const url = userText.match(/https?:\/\/\S+/)?.[0];
  return nodes.map((n) => {
    const def = findBlock(n.type);
    if (!def?.requires?.length) return n;
    const config = { ...n.config };
    if (def.requires.includes("a wallet address to check") && !String(config.wallet ?? "").trim() && wallet) {
      config.wallet = wallet;
    }
    if (def.requires.includes("a Telegram chat ID") && !String(config.chatId ?? "").trim() && chatId) {
      config.chatId = chatId;
    }
    if (def.requires.includes("a destination URL") && !String(config.url ?? "").trim() && url) {
      config.url = url;
    }
    return { ...n, config };
  });
}
