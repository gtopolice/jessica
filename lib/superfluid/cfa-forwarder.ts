import { encodeFunctionData, parseAbi } from "viem";
import { SUPERFLUID_BASE_SEPOLIA } from "@/lib/superfluid/base-sepolia";

const forwarderAbi = parseAbi([
  "function createFlow(address token, address receiver, int96 flowRate, bytes userData) external returns (bool)",
  "function deleteFlow(address token, address receiver, bytes userData) external returns (bool)",
]);

export function encodeCfaCreateFlow(params: {
  superToken: `0x${string}`;
  receiver: `0x${string}`;
  flowRatePerSecond: bigint;
}): { to: `0x${string}`; data: `0x${string}` } {
  const data = encodeFunctionData({
    abi: forwarderAbi,
    functionName: "createFlow",
    args: [params.superToken, params.receiver, params.flowRatePerSecond, "0x"],
  });
  return { to: SUPERFLUID_BASE_SEPOLIA.cfaV1Forwarder, data };
}

export function encodeCfaDeleteFlow(params: {
  superToken: `0x${string}`;
  receiver: `0x${string}`;
}): { to: `0x${string}`; data: `0x${string}` } {
  const data = encodeFunctionData({
    abi: forwarderAbi,
    functionName: "deleteFlow",
    args: [params.superToken, params.receiver, "0x"],
  });
  return { to: SUPERFLUID_BASE_SEPOLIA.cfaV1Forwarder, data };
}
