// Executes a graph of blocks server-side, in order, for REAL — every skill
// block calls a live contract read or a live market-data fetch. No block
// fabricates a result: a block that cannot run (missing config, or the
// network call fails) reports that honestly and the run stops there.
//
// `writes: true` blocks (currently only skill.swap) are NEVER executed here —
// moving funds requires the user's own wallet signature, which only exists in
// the browser. The server refuses and tells the caller to run it client-side.

import { venusHealthFactor, pancakePoolVsMarket, estimateSwapGasCostUsd } from "@/lib/chain/read";
import { getCandles, getBscPools, bestApy } from "@/lib/market/data";
import { sendTelegramMessage } from "@/lib/alerts/telegram";
import { findBlock, missingRequirements, type ConfigValue } from "./blocks";
import type { TokenSymbol } from "@/lib/chain/testnet-tokens";

export type BlockInput = { type: string; config: Record<string, ConfigValue> };

export type StepResult = {
  type: string;
  label: string;
  ok: boolean;
  output?: unknown;
  error?: string;
};

export type RunResult = { steps: StepResult[]; stoppedEarly: boolean };

/** Very small, safe expression evaluator: `field OP number`, nothing else. */
function evalCondition(expr: string, ctx: Record<string, unknown>): boolean | null {
  const m = expr.match(/^\s*([a-zA-Z_][\w.]*)\s*(>=|<=|==|!=|>|<)\s*(-?\d+(\.\d+)?)\s*$/);
  if (!m) return null;
  const [, path, op, numStr] = m;
  const val = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ctx);
  if (typeof val !== "number" && typeof val !== "boolean") return null;
  const a = Number(val);
  const b = Number(numStr);
  switch (op) {
    case ">": return a > b;
    case "<": return a < b;
    case ">=": return a >= b;
    case "<=": return a <= b;
    case "==": return a === b;
    case "!=": return a !== b;
    default: return null;
  }
}

export async function runBlocks(blocks: BlockInput[]): Promise<RunResult> {
  const steps: StepResult[] = [];
  // Named context: earlier real results, keyed by block type, so a later
  // block (e.g. compareNetOfGas) can reference a SPECIFIC earlier read
  // rather than only "whatever ran right before it".
  const ctx: Record<string, unknown> = {};
  let lastOutput: unknown = null;
  let stoppedEarly = false;

  for (const b of blocks) {
    const def = findBlock(b.type);
    if (!def) {
      steps.push({ type: b.type, label: b.type, ok: false, error: "unknown block type" });
      stoppedEarly = true;
      break;
    }

    if (def.writes) {
      steps.push({
        type: b.type, label: def.label, ok: false,
        error: "this block moves funds and must be signed by your own wallet — run it from the canvas, not the server",
      });
      stoppedEarly = true;
      break;
    }

    const missing = missingRequirements(def, b.config);
    if (missing.length) {
      steps.push({ type: b.type, label: def.label, ok: false, error: `needs ${missing.join(", ")}` });
      stoppedEarly = true;
      break;
    }

    try {
      const output = await execOne(b, lastOutput, ctx);
      steps.push({ type: b.type, label: def.label, ok: true, output });
      ctx[b.type] = output;
      if (def.kind === "logic" && output && typeof output === "object" && "continue" in output) {
        if (!(output as { continue: boolean }).continue) {
          stoppedEarly = true;
          break;
        }
      }
      lastOutput = output;
    } catch (e) {
      steps.push({ type: b.type, label: def.label, ok: false, error: e instanceof Error ? e.message : "failed" });
      stoppedEarly = true;
      break;
    }
  }

  return { steps, stoppedEarly };
}

async function execOne(b: BlockInput, prev: unknown, ctx: Record<string, unknown>): Promise<unknown> {
  switch (b.type) {
    case "trigger.schedule":
      return { fires: String(b.config.cron ?? "0 */4 * * *") };

    case "skill.venusHealth":
      return venusHealthFactor(String(b.config.wallet));

    case "skill.bscYields": {
      const pools = await getBscPools();
      const protocol = String(b.config.protocol ?? "all");
      const filtered = protocol === "all" ? pools : pools.filter((p) => p.project.toLowerCase().includes(protocol));
      const top = filtered.slice(0, 5).map((p) => ({ project: p.project, symbol: p.symbol, apyPct: p.apy, tvlUsd: p.tvlUsd }));
      const best = bestApy(filtered, /./);
      return { source: "DeFiLlama (live, mainnet reference)", top, bestApyPct: best?.apy ?? 0, bestProject: best?.project ?? null };
    }

    case "skill.priceVolatility": {
      const asset = String(b.config.asset ?? "BNB");
      const candles = await getCandles(asset, 30);
      const closes = candles.map((c) => c.c);
      const last = closes[closes.length - 1];
      const returns = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
      const mean = returns.reduce((a, c) => a + c, 0) / returns.length;
      const variance = returns.reduce((a, c) => a + (c - mean) ** 2, 0) / returns.length;
      const volatilityPct = Math.round(Math.sqrt(variance) * Math.sqrt(6 * 30) * 1000) / 10;
      return { source: "Binance (live)", asset, lastPriceUsd: last, realisedVolatilityPct30d: volatilityPct };
    }

    case "skill.pancakePool":
      return pancakePoolVsMarket(
        String(b.config.tokenIn ?? "WBNB") as TokenSymbol,
        String(b.config.tokenOut ?? "CAKE") as TokenSymbol,
        Number(b.config.feeTier ?? 2500),
      );

    case "skill.gasEstimate":
      return estimateSwapGasCostUsd();

    case "logic.condition": {
      const expr = String(b.config.expr ?? "");
      const context = (prev ?? {}) as Record<string, unknown>;
      const result = evalCondition(expr, context);
      if (result === null) {
        return { continue: true, note: `could not evaluate "${expr}" against the previous step's real output — continuing anyway` };
      }
      return { continue: result, expr, evaluatedAgainst: context };
    }

    case "logic.compareNetOfGas": {
      const yields = ctx["skill.bscYields"] as { bestApyPct?: number } | undefined;
      const gas = ctx["skill.gasEstimate"] as { gasCostUsd?: number } | undefined;
      if (!yields?.bestApyPct || gas?.gasCostUsd === undefined) {
        return {
          worthSwitching: null,
          note: "needs an earlier 'Compare BSC Yields' block and an earlier 'Real Swap Gas Cost' block to compare against",
        };
      }
      const amountUsd = Number(b.config.amountUsd ?? 100);
      const dailyGainUsd = (amountUsd * (yields.bestApyPct / 100)) / 365;
      const daysToBreakeven = dailyGainUsd > 0 ? gas.gasCostUsd / dailyGainUsd : Infinity;
      return {
        source: "computed from the real yield and real gas reads above",
        amountUsd,
        bestApyPct: yields.bestApyPct,
        dailyGainUsd: Math.round(dailyGainUsd * 10000) / 10000,
        gasCostUsd: gas.gasCostUsd,
        daysToBreakeven: Number.isFinite(daysToBreakeven) ? Math.round(daysToBreakeven * 10) / 10 : null,
        worthSwitching: daysToBreakeven < 1,
        continue: daysToBreakeven < 1,
      };
    }

    case "io.telegram": {
      const result = await sendTelegramMessage(String(b.config.chatId ?? ""), String(b.config.message ?? "Your Proven flow just ran."));
      return result;
    }

    case "io.webhook": {
      const url = String(b.config.url ?? "");
      try {
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ result: prev }),
          signal: AbortSignal.timeout(5000),
        });
        return { sent: true, url };
      } catch (e) {
        return { sent: false, url, error: e instanceof Error ? e.message : "failed" };
      }
    }

    default:
      throw new Error(`no executor for ${b.type}`);
  }
}
