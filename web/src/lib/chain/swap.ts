// Real PancakeSwap v3 swap on bsc-testnet — calldata only, never a private
// key. This module builds the exact transactions; the browser's own wallet
// signs and sends them (window.ethereum), so custody never leaves the user.
// Verified real: PANCAKE_V3_SWAP_ROUTER has live bytecode on bsc-testnet, and
// this is the real ISwapRouter.exactInputSingle struct from PancakeSwap's own
// v3-periphery source (field order matters — it's an ABI-encoded tuple).

import { encodeFunctionData, parseAbi, parseUnits } from "viem";
import { tokenAddress, TESTNET_TOKENS, type TokenSymbol } from "./testnet-tokens";

export const PANCAKE_V3_SWAP_ROUTER = "0x1b81D678ffb9C0263b24A97847620C99d213eB14" as const;

const ERC20_APPROVE_ABI = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);
const SWAP_ROUTER_ABI = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
]);

export type SwapTx = { to: `0x${string}`; data: `0x${string}`; value: `0x${string}` };

/**
 * The two real transactions a swap needs: ERC20 approve, then
 * exactInputSingle. `amountOutMinimum: 0` (no slippage floor) is deliberate
 * for this demo — testnet liquidity is thin and arbitrary, so a real slippage
 * bound would just fail the swap; a production flow must set one for real.
 */
export function buildSwapTxs(
  tokenInSym: TokenSymbol,
  tokenOutSym: TokenSymbol,
  amount: string,
  recipient: `0x${string}`,
  feeTier = 2500,
): { approve: SwapTx; swap: SwapTx } {
  const tokenIn = tokenAddress(tokenInSym);
  const tokenOut = tokenAddress(tokenOutSym);
  if (!tokenIn || !tokenOut) throw new Error("unknown token symbol");

  const amountIn = parseUnits(amount, TESTNET_TOKENS[tokenInSym].decimals);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 min

  const approveData = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [PANCAKE_V3_SWAP_ROUTER, amountIn],
  });
  const swapData = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [{
      tokenIn,
      tokenOut,
      fee: feeTier,
      recipient,
      deadline,
      amountIn,
      amountOutMinimum: BigInt(0),
      sqrtPriceLimitX96: BigInt(0),
    }],
  });

  return {
    approve: { to: tokenIn, data: approveData, value: "0x0" },
    swap: { to: PANCAKE_V3_SWAP_ROUTER, data: swapData, value: "0x0" },
  };
}
