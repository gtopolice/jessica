import { createPublicClient, http, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { SUPERFLUID_BASE_SEPOLIA } from "@/lib/superfluid/base-sepolia";

const cfaAbi = parseAbi([
  "function getFlow(address token, address sender, address receiver) view returns (uint256 timestamp, int96 flowRate, uint256 deposit, uint256 owedDeposit)",
]);

function getRpcUrl(): string {
  const url = process.env.BASE_SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL;
  if (url) return url;
  return "https://sepolia.base.org";
}

export async function readCfaFlowRate(params: {
  superToken: `0x${string}`;
  sender: `0x${string}`;
  receiver: `0x${string}`;
}): Promise<bigint> {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(getRpcUrl()),
  });

  const result = await client.readContract({
    address: SUPERFLUID_BASE_SEPOLIA.cfaV1,
    abi: cfaAbi,
    functionName: "getFlow",
    args: [params.superToken, params.sender, params.receiver],
  });

  const flowRate = result[1];
  return typeof flowRate === "bigint" ? flowRate : BigInt(flowRate as number);
}
