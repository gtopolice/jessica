import { encodeFunctionData, parseAbi } from "viem";
import { BASE_SEPOLIA_FUSDC, SUPERFLUID_BASE_SEPOLIA } from "@/lib/superfluid/base-sepolia";

const erc20ApproveAbi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

/**
 * Super Token `upgrade` / `downgrade` wrap the underlying ERC-20 (e.g. **fUSDC**)
 * into the Superfluid Super Token (**fUSDCx**) and vice versa. Both are 18-decimal
 * on Base Sepolia.
 */
const superTokenAbi = parseAbi([
  "function upgrade(uint256 amount) external",
  "function downgrade(uint256 amount) external",
]);

export function encodeFusdcApprove(params: {
  spender: `0x${string}`;
  amount: bigint;
}): { to: `0x${string}`; data: `0x${string}` } {
  return {
    to: BASE_SEPOLIA_FUSDC as `0x${string}`,
    data: encodeFunctionData({
      abi: erc20ApproveAbi,
      functionName: "approve",
      args: [params.spender, params.amount],
    }),
  };
}

export function encodeUpgradeFusdcx(amount: bigint): {
  to: `0x${string}`;
  data: `0x${string}`;
} {
  return {
    to: SUPERFLUID_BASE_SEPOLIA.fusdcx,
    data: encodeFunctionData({
      abi: superTokenAbi,
      functionName: "upgrade",
      args: [amount],
    }),
  };
}

export function encodeDowngradeFusdcx(amount: bigint): {
  to: `0x${string}`;
  data: `0x${string}`;
} {
  return {
    to: SUPERFLUID_BASE_SEPOLIA.fusdcx,
    data: encodeFunctionData({
      abi: superTokenAbi,
      functionName: "downgrade",
      args: [amount],
    }),
  };
}
