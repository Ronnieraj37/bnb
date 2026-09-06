// Real trading track-record, reconstructed from an agent wallet's own on-chain
// history — the thing 8004scan does NOT provide (it gives identity + feedback
// only; measured performance is ours to add). This is the honest, verifiable
// answer to "how does money go in, how does it trade, does it make money?":
// every number here is derived from real transfers the agent wallet actually
// made on BSC mainnet.
//
// Source: Etherscan V2 multichain API (chainid=56 == BSC), the same data that
// powers BscScan. One free-tier key covers it (ETHERSCAN_API_KEY). When no key
// is present, or the call fails/rate-limits, callers fall back to the live RPC
// wallet snapshot and say so — we never fabricate a track record.

import { getCandles } from "@/lib/market/data";

const V2 = "https://api.etherscan.io/v2/api";
const CHAIN_ID = 56;
const KEY = process.env.ETHERSCAN_API_KEY;

export const historyEnabled = () => Boolean(KEY);

// ── Known BSC venues, hand-verified (BscScan) — same discipline as
// chain/read.ts and wallet.ts. Used to translate raw counterparty addresses
// into "who the agent actually traded with", the real money-flow story. Keys
// are lowercased addresses. Only add an address after checking it on BscScan.
const VENUES: Record<string, string> = {
  // PancakeSwap
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4": "PancakeSwap V3",
  "0x1b81d678ffb9c0263b24a97847620c99d213eb14": "PancakeSwap V3",
  "0x10ed43c718714eb63d5aa57b78b54704e256024e": "PancakeSwap V2",
  "0x46a15b0b27311cedf172ab29e4f4766fbe7f4364": "PancakeSwap V3",
  "0xc0788a3ad43d79aa53b09c2eacc313a787d1d607": "PancakeSwap (Smart Router)",
  // Venus lending
  "0xfd36e2c2a6789db23113685031d7f16329158384": "Venus",
  "0xa07c5b74c9b40447a954e1466938b865b6bbea36": "Venus (vBNB)",
  // Lista / Helio
  "0x1adb950d8bb3da4be104211d5ab038628e477fe6": "Lista DAO",
  // Tokens (as counterparties on ERC-20 transfers)
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": "WBNB",
  "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82": "CAKE",
  "0xe9e7cea3dedca5984780bafc599bd69add087d56": "BUSD",
  "0x55d398326f99059ff775485246999027b3197955": "USDT",
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "USDC",
};

// Symbols we can price. Stables peg to $1; BNB/CAKE come from Binance klines.
const STABLES = new Set(["USDT", "BUSD", "USDC", "DAI", "FDUSD"]);

type RawTx = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError?: string;
  gasUsed?: string;
  gasPrice?: string;
};

type RawTokenTx = RawTx & {
  contractAddress: string;
  tokenSymbol: string;
  tokenDecimal: string;
};

export type EquityPoint = { t: number; v: number };

export type TrackRecord = {
  address: string;
  // activity
  firstActivity: number | null; // unix seconds
  lastActivity: number | null;
  totalTx: number;
  txLast7d: number;
  txLast30d: number;
  failedTx: number;
  // money flow (USD, at today's price — stated plainly in the UI)
  moneyInUsd: number;
  moneyOutUsd: number;
  netFlowUsd: number;
  gasSpentUsd: number;
  // realized PnL from stablecoin flow, only when meaningful
  realizedPnlUsd: number | null;
  // where it trades
  venues: string[];
  // cumulative net-flow curve for a sparkline
  equity: EquityPoint[];
  // provenance / honesty
  sampled: boolean; // true when we hit the API page cap and didn't see all history
};

async function fetchV2<T>(params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams({
    chainid: String(CHAIN_ID),
    apikey: KEY ?? "",
    ...params,
  });
  const res = await fetch(`${V2}?${qs}`, {
    next: { revalidate: 120 },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`etherscan ${res.status}`);
  const json = (await res.json()) as { status: string; message: string; result: T[] | string };
  // status "0" with message "No transactions found" is a legitimate empty set.
  if (json.status !== "1") {
    if (typeof json.result === "string" && /no transactions found/i.test(json.result)) return [];
    if (/no transactions found/i.test(json.message)) return [];
    throw new Error(typeof json.result === "string" ? json.result : json.message);
  }
  return Array.isArray(json.result) ? json.result : [];
}

const PAGE = 5000; // Etherscan max rows per call; if we hit it, history is sampled.

/**
 * Reconstruct a real track record for one agent wallet. Returns null when we
 * genuinely can't (no key, upstream down) — the caller then shows the honest
 * RPC snapshot instead of an invented record.
 */
export async function trackRecord(address: string): Promise<TrackRecord | null> {
  if (!KEY) return null;
  const addr = address.toLowerCase();

  let normalTx: RawTx[];
  let tokenTx: RawTokenTx[];
  try {
    [normalTx, tokenTx] = await Promise.all([
      fetchV2<RawTx>({ module: "account", action: "txlist", address: addr, startblock: "0", endblock: "99999999", page: "1", offset: String(PAGE), sort: "asc" }),
      fetchV2<RawTokenTx>({ module: "account", action: "tokentx", address: addr, startblock: "0", endblock: "99999999", page: "1", offset: String(PAGE), sort: "asc" }),
    ]);
  } catch {
    return null;
  }

  // Prices for valuing BNB and the majors. One Binance call each; stables = $1.
  const [bnbUsd, cakeUsd] = await Promise.all([
    lastClose("BNB"),
    lastClose("CAKE"),
  ]);
  const priceForSymbol = (sym: string): number | null => {
    const s = sym.toUpperCase();
    if (STABLES.has(s)) return 1;
    if (s === "WBNB" || s === "BNB") return bnbUsd;
    if (s === "CAKE") return cakeUsd;
    return null; // unknown token — counted in activity, not in USD flow
  };

  const now = Math.floor(Date.now() / 1000);
  const DAY = 86400;

  let moneyInUsd = 0;
  let moneyOutUsd = 0;
  let gasSpentUsd = 0;
  let stableIn = 0;
  let stableOut = 0;
  let failedTx = 0;
  const venues = new Set<string>();
  const flow: EquityPoint[] = []; // signed USD deltas over time

  // Native BNB transfers + gas, from the normal-tx list.
  for (const tx of normalTx) {
    const ts = Number(tx.timeStamp);
    if (tx.isError === "1") failedTx++;
    // gas is always spent by the sender
    if (tx.from.toLowerCase() === addr && tx.gasUsed && tx.gasPrice && bnbUsd) {
      gasSpentUsd += (Number(tx.gasUsed) * Number(tx.gasPrice)) / 1e18 * bnbUsd;
    }
    const v = Number(tx.value) / 1e18;
    if (v > 0 && bnbUsd) {
      const usd = v * bnbUsd;
      if (tx.to.toLowerCase() === addr) { moneyInUsd += usd; flow.push({ t: ts, v: usd }); }
      else if (tx.from.toLowerCase() === addr) { moneyOutUsd += usd; flow.push({ t: ts, v: -usd }); }
    }
    const venue = VENUES[tx.to?.toLowerCase()] ?? VENUES[tx.from?.toLowerCase()];
    if (venue) venues.add(venue);
  }

  // ERC-20 transfers, from the token-tx list.
  for (const tx of tokenTx) {
    const ts = Number(tx.timeStamp);
    const price = priceForSymbol(tx.tokenSymbol);
    const decimals = Number(tx.tokenDecimal) || 18;
    const amount = Number(tx.value) / 10 ** decimals;
    const inbound = tx.to.toLowerCase() === addr;
    const outbound = tx.from.toLowerCase() === addr;
    if (price != null && amount > 0) {
      const usd = amount * price;
      if (inbound) { moneyInUsd += usd; flow.push({ t: ts, v: usd }); }
      else if (outbound) { moneyOutUsd += usd; flow.push({ t: ts, v: -usd }); }
      if (STABLES.has(tx.tokenSymbol.toUpperCase())) {
        if (inbound) stableIn += usd; else if (outbound) stableOut += usd;
      }
    }
    // The token contract itself, and the counterparty, can both name a venue.
    const venue = VENUES[tx.contractAddress?.toLowerCase()]
      ?? VENUES[tx.to?.toLowerCase()] ?? VENUES[tx.from?.toLowerCase()];
    if (venue) venues.add(venue);
  }

  const timestamps = [
    ...normalTx.map((t) => Number(t.timeStamp)),
    ...tokenTx.map((t) => Number(t.timeStamp)),
  ].filter((n) => n > 0);
  const firstActivity = timestamps.length ? Math.min(...timestamps) : null;
  const lastActivity = timestamps.length ? Math.max(...timestamps) : null;

  const inWindow = (arr: { timeStamp: string }[], days: number) =>
    arr.filter((t) => now - Number(t.timeStamp) <= days * DAY).length;
  const txLast7d = inWindow(normalTx, 7);
  const txLast30d = inWindow(normalTx, 30);

  // Realized PnL from stablecoin flow: only meaningful when the wallet has
  // cycled real stables both ways (deployed capital and taken some back). If it
  // never took stables back out, "profit" isn't realized yet — report null.
  const realizedPnlUsd = stableIn > 0 && stableOut > 0 ? stableIn - stableOut : null;

  // Build the cumulative equity curve (net capital deployed over time).
  flow.sort((a, b) => a.t - b.t);
  let running = 0;
  const equity: EquityPoint[] = flow.map((f) => {
    running += f.v;
    return { t: f.t, v: running };
  });

  return {
    address: addr,
    firstActivity,
    lastActivity,
    totalTx: normalTx.length,
    txLast7d,
    txLast30d,
    failedTx,
    moneyInUsd,
    moneyOutUsd,
    netFlowUsd: moneyInUsd - moneyOutUsd,
    gasSpentUsd,
    realizedPnlUsd,
    venues: [...venues],
    equity,
    sampled: normalTx.length >= PAGE || tokenTx.length >= PAGE,
  };
}

async function lastClose(asset: string): Promise<number> {
  try {
    const c = await getCandles(asset, 1);
    return c[c.length - 1]?.c ?? 0;
  } catch {
    return 0;
  }
}
