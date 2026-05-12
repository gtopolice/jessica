import { encodeFunctionData, parseAbi } from "viem";
import { SUPERFLUID_BASE_SEPOLIA } from "@/lib/superfluid/base-sepolia";

/**
 * [CFAv1Forwarder](https://docs.superfluid.finance/docs/technical-reference/CFAv1Forwarder) —
 * `createFlow` / `deleteFlow` take an explicit **sender** (the stream payer); `msg.sender` must be
 * that sender (or an authorized flow operator).
 */
const forwarderAbi = parseAbi([
  "function createFlow(address token, address sender, address receiver, int96 flowRate, bytes userData) external returns (bool)",
  "function deleteFlow(address token, address sender, address receiver, bytes userData) external returns (bool)",
]);

export function encodeCfaCreateFlow(params: {
  superToken: `0x${string}`;
  /** Requester / flow sender (must match wallet signing the tx). */
  sender: `0x${string}`;
  /** Fulfiller receives the stream. */
  receiver: `0x${string}`;
  flowRatePerSecond: bigint;
}): { to: `0x${string}`; data: `0x${string}` } {
  const data = encodeFunctionData({
    abi: forwarderAbi,
    functionName: "createFlow",
    args: [params.superToken, params.sender, params.receiver, params.flowRatePerSecond, "0x"],
  });
  return { to: SUPERFLUID_BASE_SEPOLIA.cfaV1Forwarder, data };
}

export function encodeCfaDeleteFlow(params: {
  superToken: `0x${string}`;
  sender: `0x${string}`;
  receiver: `0x${string}`;
}): { to: `0x${string}`; data: `0x${string}` } {
  const data = encodeFunctionData({
    abi: forwarderAbi,
    functionName: "deleteFlow",
    args: [params.superToken, params.sender, params.receiver, "0x"],
  });
  return { to: SUPERFLUID_BASE_SEPOLIA.cfaV1Forwarder, data };
}
