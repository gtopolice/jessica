import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export function getBaseSepoliaRpcUrl(): string | undefined {
  return typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL
    : undefined;
}

export function getBaseSepoliaPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(getBaseSepoliaRpcUrl()),
  });
}
