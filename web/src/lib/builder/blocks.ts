// The block palette. Every "skill" block is backed by real logic — real
// contract reads (Venus, PancakeSwap v3 on bsc-testnet), real market data
// (DeFiLlama, Binance), and a real gas price — see lib/builder/run.ts and
// lib/chain/*. Users pick tokens by SYMBOL from a small, verified list
// (lib/chain/testnet-tokens.ts) — never a raw contract address. A block
// that would move funds (`writes: true`) is signed by the user's own
// connected wallet in the browser; the server never touches it.

import { TOKEN_SYMBOLS } from "@/lib/chain/testnet-tokens";

export type BlockKind = "trigger" | "skill" | "logic" | "io";
export type FieldType = "text" | "number" | "select";
export type ConfigValue = string | number;

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  options?: { label: string; value: string }[];
  placeholder?: string;
  help?: string;
  def?: ConfigValue;
};

export type Requirement = "a wallet address to check" | "a Telegram chat ID" | "a destination URL" | "a connected wallet";

export type BlockDef = {
  type: string;
  kind: BlockKind;
  label: string;
  desc: string;
  requires?: Requirement[];
  writes?: boolean;
  fields: Field[];
};

export const KIND_META: Record<BlockKind, { label: string; color: string }> = {
  trigger: { label: "Triggers", color: "#5b9dff" },
  skill: { label: "Real on-chain / market reads", color: "#f0b90b" },
  logic: { label: "Logic", color: "#ffb454" },
  io: { label: "Alerts", color: "#ff9900" },
};

const opts = (...v: string[]) => v.map((x) => ({ label: x, value: x }));
const tokenOpts = () => TOKEN_SYMBOLS.map((s) => ({ label: s, value: s }));
const FEE_TIERS = { label: "Fee tier", key: "feeTier", type: "select" as const, options: opts("100", "500", "2500", "10000"), def: "2500" };

export const BLOCKS: BlockDef[] = [
  // ── Triggers ──
  {
    type: "trigger.schedule",
    kind: "trigger",
    label: "Schedule",
    desc: "Run on a fixed interval.",
    fields: [
      {
        key: "cron", label: "Run every", type: "select",
        options: [
          { label: "15 minutes", value: "*/15 * * * *" },
          { label: "1 hour", value: "0 * * * *" },
          { label: "4 hours", value: "0 */4 * * *" },
          { label: "1 day", value: "0 0 * * *" },
        ],
        def: "0 */4 * * *",
      },
    ],
  },

  // ── Real reads ──
  {
    type: "skill.venusHealth",
    kind: "skill",
    label: "Venus Health Factor",
    desc: "Reads a real wallet's live Venus Comptroller.getAccountLiquidity on BSC mainnet.",
    requires: ["a wallet address to check"],
    fields: [
      { key: "wallet", label: "Wallet address", type: "text", placeholder: "0x…", help: "The wallet to check on Venus." },
    ],
  },
  {
    type: "skill.bscYields",
    kind: "skill",
    label: "Compare BSC Yields",
    desc: "Reads real, current APYs across BSC lending/LP pools from DeFiLlama (mainnet reference data).",
    fields: [
      { key: "protocol", label: "Protocol", type: "select", options: opts("all", "venus", "lista", "aave", "pancakeswap"), def: "all" },
    ],
  },
  {
    type: "skill.priceVolatility",
    kind: "skill",
    label: "Price & Volatility",
    desc: "Reads real recent Binance candles and computes realised volatility.",
    fields: [
      { key: "asset", label: "Asset", type: "select", options: opts("BNB", "CAKE", "BTCB", "ETH"), def: "BNB" },
    ],
  },
  {
    type: "skill.pancakePool",
    kind: "skill",
    label: "PancakeSwap v3 Pool (testnet)",
    desc: "Reads a real PancakeSwap v3 pool's live price on BSC testnet, and the real Binance reference price for the same pair.",
    fields: [
      { key: "tokenIn", label: "Token", type: "select", options: tokenOpts(), def: "WBNB" },
      { key: "tokenOut", label: "Against", type: "select", options: tokenOpts(), def: "CAKE" },
      FEE_TIERS,
    ],
  },
  {
    type: "skill.gasEstimate",
    kind: "skill",
    label: "Real Swap Gas Cost",
    desc: "Reads the real current BSC testnet gas price and converts it to USD using the real live BNB price.",
    fields: [],
  },

  // ── Logic ──
  {
    type: "logic.condition",
    kind: "logic",
    label: "Condition",
    desc: "Only continue when the expression is true (evaluated against the previous block's real output).",
    fields: [
      { key: "expr", label: "Continue when", type: "text", placeholder: "shortfallUsd > 0", def: "shortfallUsd > 0" },
    ],
  },
  {
    type: "logic.compareNetOfGas",
    kind: "logic",
    label: "Worth Switching? (net of gas)",
    desc: "Compares the real best-yield gain on your amount against the real gas cost of switching, and says whether it's worth it right now. Reads the yield from an earlier 'Compare BSC Yields' block and the cost from an earlier 'Real Swap Gas Cost' block.",
    fields: [
      { key: "amountUsd", label: "Amount you'd move (USD)", type: "number", def: 100 },
    ],
  },

  // ── Write action — real, client-signed ──
  {
    type: "skill.swap",
    kind: "skill",
    label: "Swap (testnet)",
    desc: "Executes a real PancakeSwap v3 swap on BSC testnet through YOUR connected wallet — two real signed transactions (approve, then swap). No server ever holds your key.",
    requires: ["a connected wallet"],
    writes: true,
    fields: [
      { key: "tokenIn", label: "From", type: "select", options: tokenOpts(), def: "WBNB" },
      { key: "tokenOut", label: "To", type: "select", options: tokenOpts(), def: "CAKE" },
      { key: "amount", label: "Amount", type: "text", placeholder: "0.01", def: "0.01" },
      FEE_TIERS,
    ],
  },

  // ── Alerts ──
  {
    type: "io.telegram",
    kind: "io",
    label: "Telegram alert",
    desc: "Sends the result to a real Telegram chat via the platform's bot.",
    requires: ["a Telegram chat ID"],
    fields: [
      { key: "chatId", label: "Telegram chat ID", type: "text", placeholder: "e.g. 123456789", help: "Message @userinfobot on Telegram to get your chat ID." },
      { key: "message", label: "Message", type: "text", placeholder: "Flow finished", def: "Your Proven flow just ran." },
    ],
  },
  {
    type: "io.webhook",
    kind: "io",
    label: "HTTP webhook",
    desc: "POSTs the result to a URL you control.",
    requires: ["a destination URL"],
    fields: [
      { key: "url", label: "URL", type: "text", placeholder: "https://…" },
    ],
  },
];

export const findBlock = (type: string) => BLOCKS.find((b) => b.type === type);

export function defaultConfig(def: BlockDef): Record<string, ConfigValue> {
  const c: Record<string, ConfigValue> = {};
  for (const f of def.fields) if (f.def !== undefined) c[f.key] = f.def;
  return c;
}

/** Requirements this block still lacks, given its current config. */
export function missingRequirements(def: BlockDef, config: Record<string, ConfigValue>): Requirement[] {
  if (!def.requires?.length) return [];
  const filled = (key: string) => String(config[key] ?? "").trim().length > 0;
  const missing: Requirement[] = [];
  if (def.requires.includes("a wallet address to check") && !filled("wallet")) missing.push("a wallet address to check");
  if (def.requires.includes("a Telegram chat ID") && !filled("chatId")) missing.push("a Telegram chat ID");
  if (def.requires.includes("a destination URL") && !filled("url")) missing.push("a destination URL");
  // "a connected wallet" is a runtime (browser) requirement, not a config
  // field — the UI checks the live wallet-connect state for that one.
  return missing;
}
