// Real, free on-chain wallet activity — no indexer, no API key. Just the
// public BSC RPC: balance, real transaction count, and real holdings of the
// major BEP-20s. Verified by hand against real bytecode (symbol()/decimals()
// calls) before use, same discipline as the testnet token registry.

import { createPublicClient, http, parseAbi } from "viem";
import { bsc } from "viem/chains";
import { getCandles } from "@/lib/market/data";

const client = createPublicClient({ chain: bsc, transport: http() });

const MAINNET_TOKENS = {
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  CAKE: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82",
  BUSD: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
  USDT: "0x55d398326f99059fF775485246999027B3197955",
} as const;

const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export type WalletSnapshot = {
  address: string;
  isContract: boolean;
  bnbBalance: number;
  bnbUsd: number;
  txCount: number;
  tokens: { symbol: string; balance: number; usd: number }[];
  totalUsd: number;
};

/** A real, live snapshot of a wallet's BNB + major-token holdings and activity. */
export async function walletSnapshot(address: string): Promise<WalletSnapshot> {
  const addr = address.toLowerCase() as `0x${string}`;

  const [balanceWei, txCount, code, bnbCandles, cakeCandles, tokenBalances] = await Promise.all([
    client.getBalance({ address: addr }),
    client.getTransactionCount({ address: addr }),
    client.getCode({ address: addr }),
    getCandles("BNB", 1).catch(() => []),
    getCandles("CAKE", 1).catch(() => []),
    Promise.all(
      (Object.entries(MAINNET_TOKENS) as [string, `0x${string}`][]).map(async ([symbol, tokenAddr]) => {
        const raw = await client
          .readContract({ address: tokenAddr, abi: ERC20_ABI, functionName: "balanceOf", args: [addr] })
          .catch(() => BigInt(0));
        return { symbol, raw };
      }),
    ),
  ]);

  const bnbUsdPrice = bnbCandles[bnbCandles.length - 1]?.c ?? 0;
  const cakeUsdPrice = cakeCandles[cakeCandles.length - 1]?.c ?? 0;
  const priceFor = (symbol: string) => (symbol === "WBNB" ? bnbUsdPrice : symbol === "CAKE" ? cakeUsdPrice : 1); // BUSD/USDT pegged ~$1

  const tokens = tokenBalances
    .map(({ symbol, raw }) => {
      const balance = Number(raw) / 1e18;
      return { symbol, balance, usd: balance * priceFor(symbol) };
    })
    .filter((t) => t.balance > 0.0001);

  const bnbBalance = Number(balanceWei) / 1e18;
  const bnbUsd = bnbBalance * bnbUsdPrice;

  return {
    address,
    isContract: Boolean(code) && code !== "0x",
    bnbBalance,
    bnbUsd,
    txCount,
    tokens,
    totalUsd: bnbUsd + tokens.reduce((s, t) => s + t.usd, 0),
  };
}
