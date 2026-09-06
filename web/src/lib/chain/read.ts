// Real, live BSC mainnet contract reads — no simulation, no fabricated
// numbers. Addresses and function shapes were verified by hand (BscScan +
// a live eth_call) while building the four seed agents; reused here so the
// web builder's "Run" button executes the exact same real logic.

import { createPublicClient, http, parseAbi } from "viem";
import { bsc, bscTestnet } from "viem/chains";
import { tokenAddress, BINANCE_SYMBOL_FOR, type TokenSymbol } from "./testnet-tokens";
import { getCandles } from "@/lib/market/data";

const client = createPublicClient({ chain: bsc, transport: http() });
// PancakeSwap v3 Factory/SwapRouter/NonfungiblePositionManager are deployed
// at the SAME address on bsc-testnet as on mainnet — verified directly: real
// bytecode exists at this address on testnet too (see NOTES.md).
const testnetClient = createPublicClient({ chain: bscTestnet, transport: http() });

export const VENUS_COMPTROLLER = "0xfD36E2c2a6789Db23113685031d7F16329158384" as const;
export const PANCAKE_V3_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865" as const;

const VENUS_ABI = parseAbi([
  "function getAccountLiquidity(address) view returns (uint256,uint256,uint256)",
]);
const FACTORY_ABI = parseAbi([
  "function getPool(address,address,uint24) view returns (address)",
]);
const POOL_ABI = parseAbi([
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint32,bool)",
]);

const norm = (a: string) => a.toLowerCase() as `0x${string}`;

/** Real Venus account liquidity/shortfall for a wallet, on bsc-mainnet. */
export async function venusHealthFactor(walletAddress: string) {
  const [errorCode, liquidityRaw, shortfallRaw] = await client.readContract({
    address: VENUS_COMPTROLLER,
    abi: VENUS_ABI,
    functionName: "getAccountLiquidity",
    args: [norm(walletAddress)],
  });
  const toUsd = (v: bigint) => Number(v) / 1e18;
  return {
    source: "Venus Comptroller (bsc-mainnet, live read)",
    contract: VENUS_COMPTROLLER,
    errorCode: Number(errorCode),
    excessLiquidityUsd: toUsd(liquidityRaw),
    shortfallUsd: toUsd(shortfallRaw),
    atRiskOfLiquidation: shortfallRaw > BigInt(0),
  };
}

/** Real PancakeSwap v3 pool lookup + current tick/price, on bsc-mainnet. */
export async function pancakeV3PoolPrice(tokenA: string, tokenB: string, feeTier = 2500) {
  const poolAddress = await client.readContract({
    address: PANCAKE_V3_FACTORY,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [norm(tokenA), norm(tokenB), feeTier],
  });
  if (!poolAddress || /^0x0+$/.test(poolAddress)) {
    return { source: "PancakeSwap v3 Factory (live)", found: false as const, reason: "no pool at that fee tier" };
  }
  const [sqrtPriceX96, tick] = await client.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "slot0",
  });
  const rawPriceRatio = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
  return {
    source: "PancakeSwap v3 Factory + Pool (live, bsc-mainnet)",
    found: true as const,
    poolAddress,
    currentTick: tick,
    rawPriceRatio,
  };
}

// ── Testnet: the executable half. Same real Factory/Pool contracts, on
// bsc-testnet, against the curated token set — this is what "Run for real"
// can actually swap against with a real (test) wallet. ─────────────────────

/**
 * Real PancakeSwap v3 pool price on bsc-testnet for two curated symbols, PLUS
 * the real Binance reference price for the same pair.
 *
 * IMPORTANT, verified by hand: testnet pool prices are NOT real-money
 * arbitraged — a real check of the live WBNB/CAKE testnet pool returned a
 * price ratio off by ~11 orders of magnitude from the real market rate
 * (seeded liquidity at an arbitrary ratio). The pool/price READ is 100% real;
 * the NUMBER it returns is not a trading signal on testnet, only proof the
 * mechanics work. `deviationPct` is reported so the UI can say this plainly
 * rather than implying a fake arbitrage opportunity.
 */
export async function pancakePoolVsMarket(tokenInSym: TokenSymbol, tokenOutSym: TokenSymbol, feeTier = 2500) {
  const tokenIn = tokenAddress(tokenInSym);
  const tokenOut = tokenAddress(tokenOutSym);
  if (!tokenIn || !tokenOut) throw new Error(`unknown token symbol`);

  const poolAddress = await testnetClient.readContract({
    address: PANCAKE_V3_FACTORY,
    abi: FACTORY_ABI,
    functionName: "getPool",
    args: [tokenIn, tokenOut, feeTier],
  });
  if (!poolAddress || /^0x0+$/.test(poolAddress)) {
    return { source: "PancakeSwap v3 Factory (bsc-testnet, live)", found: false as const, reason: `no ${tokenInSym}/${tokenOutSym} pool at fee ${feeTier}` };
  }
  const [, tick] = await testnetClient.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: "slot0",
  });
  // price = 1.0001^tick (both curated tokens are 18 decimals, so no decimal
  // rescaling is needed) — this avoids the precision loss of converting a
  // ~160-bit sqrtPriceX96 straight to a JS Number before squaring.
  const poolRatio = Math.pow(1.0001, Number(tick));

  const binSymA = BINANCE_SYMBOL_FOR[tokenInSym];
  const binSymB = BINANCE_SYMBOL_FOR[tokenOutSym];
  let marketRatio: number | null = null;
  if (binSymA && binSymB) {
    const [a, b] = await Promise.all([getCandles(binSymA, 1), getCandles(binSymB, 1)]);
    const priceA = a[a.length - 1]?.c;
    const priceB = b[b.length - 1]?.c;
    if (priceA && priceB) marketRatio = priceA / priceB;
  }

  const deviationPct = marketRatio ? ((poolRatio - marketRatio) / marketRatio) * 100 : null;

  return {
    source: "PancakeSwap v3 (bsc-testnet, live) vs Binance (live reference)",
    found: true as const,
    poolAddress,
    poolRatio,
    marketRatio,
    deviationPct,
    note: "Testnet liquidity is seeded arbitrarily and is not real-money arbitraged — a large deviation here proves the read is real, not that a real trading edge exists.",
  };
}

const GAS_ABI_PARAMS = { gasUnitsEstimate: 200_000 }; // typical exactInputSingle usage on v3

/** Real current testnet gas price × a stated gas estimate × real BNB/USD. */
export async function estimateSwapGasCostUsd() {
  const [gasPriceWei, bnbCandles] = await Promise.all([
    testnetClient.getGasPrice(),
    getCandles("BNB", 1),
  ]);
  const bnbUsd = bnbCandles[bnbCandles.length - 1]?.c ?? 0;
  const gasCostBnb = (Number(gasPriceWei) * GAS_ABI_PARAMS.gasUnitsEstimate) / 1e18;
  return {
    source: "bsc-testnet eth_gasPrice (live) x real BNB/USD (Binance)",
    gasPriceGwei: Number(gasPriceWei) / 1e9,
    gasUnitsEstimate: GAS_ABI_PARAMS.gasUnitsEstimate,
    gasCostBnb,
    gasCostUsd: gasCostBnb * bnbUsd,
    bnbUsd,
  };
}
