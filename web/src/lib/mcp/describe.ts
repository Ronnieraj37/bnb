// Translate an agent's raw MCP tool names into plain English a non-technical
// user can actually judge. The registry hands us machine names like
// "createWallet", "swapExactTokensForTokens", "getHealthFactor" — showing those
// raw is exactly the "worst app for anyone hiring an agent" problem. Here we map
// the common ones to a human sentence, and fall back to a camelCase humaniser
// so even an unknown tool reads as words, not code.
//
// `movesFunds` is the honest read/write split — anything that can move money
// gets flagged so the UI can separate "safe to try" from "needs your approval".

/**
 * Whether a tool NAME reads rather than writes. Judged by verb prefix, which is
 * the reliable signal: "estimateAmountsForIncreasePosition" is a read despite
 * containing "increase", and "createPool" is a write despite containing "pool".
 * Anything without a read prefix is treated as fund-moving — the safe default.
 */
const READ_PREFIX = /^(get|list|fetch|read|estimate|query|check|view|describe)/i;

export function looksReadOnly(name: string): boolean {
  return READ_PREFIX.test(name);
}

export type PlainTool = {
  name: string;
  /** A short human sentence: what happens when this tool runs. */
  plain: string;
  /** True when running it can move funds / sign a transaction. */
  movesFunds: boolean;
};

// Ordered, most-specific first. Matched against the lowercased tool name as a
// substring so "swapExactTokensForTokens" still hits "swap".
//
// IMPORTANT: fund-moving rules that share a noun with a read (e.g. createPool
// vs getPool — both contain "pool") are listed BEFORE the read rules, so the
// write meaning wins. As a hard safety net, describeTool() below never lets a
// rule mark a non-read-prefixed name as safe.
const RULES: { re: RegExp; plain: string; movesFunds: boolean }[] = [
  // writes that collide with read nouns — must come first
  { re: /createwallet|newwallet/, plain: "Create a new wallet", movesFunds: true },
  { re: /create.*pool|addpool/, plain: "Create a liquidity pool", movesFunds: true },
  { re: /createsingleside/, plain: "Open a single-sided position", movesFunds: true },
  { re: /create.*position|open.*position|mintposition/, plain: "Open a liquidity position", movesFunds: true },
  { re: /increase.*(liquidity|position)/, plain: "Add to a liquidity position", movesFunds: true },
  { re: /decrease.*(liquidity|position)/, plain: "Reduce a liquidity position", movesFunds: true },
  { re: /collect.*fee|collectfees/, plain: "Collect earned fees", movesFunds: true },
  // other writes (move funds / sign)
  { re: /swap|trade|exchange/, plain: "Swap tokens on your behalf", movesFunds: true },
  { re: /rebalance|resetrange|adjustrange/, plain: "Reset your LP range when price drifts out", movesFunds: true },
  { re: /addliquidity|provide/, plain: "Add liquidity to a pool", movesFunds: true },
  { re: /removeliquidity|withdraw|redeem|burn/, plain: "Withdraw funds from a position", movesFunds: true },
  { re: /repay/, plain: "Repay a loan before liquidation", movesFunds: true },
  { re: /borrow/, plain: "Borrow against your collateral", movesFunds: true },
  { re: /supply|deposit|stake|lend/, plain: "Deposit funds to earn yield", movesFunds: true },
  { re: /unstake|unstak/, plain: "Unstake your funds", movesFunds: true },
  { re: /placeorder|createorder|limitorder|grid/, plain: "Place trading orders", movesFunds: true },
  { re: /cancel/, plain: "Cancel open orders", movesFunds: true },
  { re: /approve|allowance/, plain: "Approve a token for spending", movesFunds: true },
  { re: /transfer|send|pay/, plain: "Send funds to an address", movesFunds: true },
  { re: /claim|harvest|compound/, plain: "Claim and reinvest rewards", movesFunds: true },
  { re: /\bmint\b|^mint/, plain: "Mint a position", movesFunds: true },
  { re: /bridge/, plain: "Bridge funds to another chain", movesFunds: true },
  // reads
  { re: /gethealth|healthfactor/, plain: "Check your loan's health factor", movesFunds: false },
  { re: /getprice|price|quote|poolprice/, plain: "Read live token prices", movesFunds: false },
  { re: /getbalance|balance/, plain: "Read a wallet's balances", movesFunds: false },
  { re: /allpositions|positionids|lpposition|getposition|getpool|getlp/, plain: "Read your liquidity positions", movesFunds: false },
  { re: /getapr|getapy|apr|apy|yield/, plain: "Compare yields across venues", movesFunds: false },
  { re: /estimate|simulate|preview|dryrun|range/, plain: "Estimate an outcome before acting", movesFunds: false },
  { re: /supportedchain|getchain|dexinfo|getdex/, plain: "List supported chains and DEXes", movesFunds: false },
  { re: /list|search|find|discover/, plain: "List available options", movesFunds: false },
  { re: /status|ping/, plain: "Report its own status", movesFunds: false },
];

/** camelCase / snake_case / kebab -> "Title cased words". */
function humanise(name: string): string {
  const words = name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function describeTool(name: string): PlainTool {
  const key = name.toLowerCase();
  // The verb PREFIX is the reliable read/write signal — "estimate…Increase…"
  // is a read despite containing "increase", and "createPool" is a write
  // despite containing "pool". So the prefix picks the bucket, and we only take
  // a label from a rule in that same bucket.
  const movesFunds = !looksReadOnly(name);
  const rule = RULES.find((r) => r.movesFunds === movesFunds && r.re.test(key));
  const plain = rule ? rule.plain : humanise(name);
  return { name, plain, movesFunds };
}

export function describeTools(names: string[]): { reads: PlainTool[]; actions: PlainTool[] } {
  const reads: PlainTool[] = [];
  const actions: PlainTool[] = [];
  for (const n of names) {
    const t = describeTool(n);
    (t.movesFunds ? actions : reads).push(t);
  }
  return { reads, actions };
}

/** A one-line, human strategy summary from category + what the tools reveal. */
export function strategySummary(category: string, toolNames: string[]): string {
  const has = (re: RegExp) => toolNames.some((t) => re.test(t.toLowerCase()));
  switch (category) {
    case "rebalancing":
      return "A rebalancing agent: it watches your PancakeSwap liquidity position and resets the price range when the market drifts out of it, so your capital keeps earning fees instead of sitting idle.";
    case "grid":
      return "A grid-trading agent: it places a ladder of buy and sell orders around the current price and profits from the market moving up and down inside that band.";
    case "yield":
      return "A yield agent: it compares live APRs across BSC lending and LP venues and moves your funds to the best one, accounting for gas before it does.";
    case "health-factor":
      return "A health-factor agent: it watches your lending position and repays debt automatically before the market can liquidate you.";
    default:
      return has(/swap|trade/)
        ? "A trading agent that executes swaps on BSC on your behalf."
        : "An on-chain agent that acts on BSC within the limits you set.";
  }
}
