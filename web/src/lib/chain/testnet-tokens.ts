// Curated BSC testnet tokens. Every address here was verified by hand:
// on-chain bytecode exists, and `symbol()`/`decimals()` were read back and
// matched the claimed token — see NOTES.md. Users pick a SYMBOL from this
// list; they never type a contract address. This is deliberately small
// (4 tokens) so every pair in the builder is one we've confirmed works —
// WBNB/CAKE in particular has real, non-zero liquidity across four fee tiers.

export type TokenSymbol = "WBNB" | "CAKE" | "BUSD" | "USDT";

export const TESTNET_TOKENS: Record<TokenSymbol, { address: `0x${string}`; decimals: number }> = {
  WBNB: { address: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", decimals: 18 },
  CAKE: { address: "0xFa60D973F7642B748046464e165A65B7323b0DEE", decimals: 18 },
  BUSD: { address: "0x8301F2213c0eeD49a7E28Ae4c3e91722919B8B47", decimals: 18 },
  USDT: { address: "0x66E972502A34A625828C544a1914E8D8cc2A9dE5", decimals: 18 },
};

export const TOKEN_SYMBOLS = Object.keys(TESTNET_TOKENS) as TokenSymbol[];

export function tokenAddress(symbol: string): `0x${string}` | null {
  return TESTNET_TOKENS[symbol as TokenSymbol]?.address ?? null;
}

/** Binance symbol equivalent, for a real reference market price. */
export const BINANCE_SYMBOL_FOR: Partial<Record<TokenSymbol, string>> = {
  WBNB: "BNB",
  CAKE: "CAKE",
};
