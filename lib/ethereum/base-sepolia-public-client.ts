import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export function getBaseSepoliaRpcUrl(): string | undefined {
  if (typeof process === "undefined") return undefined;
  return (
    process.env.BASE_SEPOLIA_RPC_URL ??
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL
  );
}

export function getBaseSepoliaPublicClient() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(getBaseSepoliaRpcUrl()),
  });
}
