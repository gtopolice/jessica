import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const BUFFER_PCT = 30n;
const BUFFER_BASE = 100n;

/** When `estimateGas` fails (RPC, stale nonce), use a value above typical CFA forwarder usage. */
export const SUPERFLUID_FORWARDER_TX_GAS_FALLBACK = 450_000n;

const MAX_GAS = 1_500_000n;

/**
 * Estimates gas for a Superfluid CFA forwarder call so Privy embeds a non-zero `gasLimit`
 * (otherwise the signed tx can hit "intrinsic gas too low").
 */
export async function estimateSuperfluidTxGas(params: {
  from: `0x${string}`;
  to: `0x${string}`;
  data: `0x${string}`;
}): Promise<bigint> {
  const url =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL
      ? process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL
      : undefined;

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(url),
  });

  try {
    const gas = await client.estimateGas({
      account: params.from,
      to: params.to,
      data: params.data,
      value: 0n,
    });
    const buffered = (gas * (BUFFER_BASE + BUFFER_PCT)) / BUFFER_BASE;
    return buffered > MAX_GAS ? MAX_GAS : buffered;
  } catch {
    return SUPERFLUID_FORWARDER_TX_GAS_FALLBACK;
  }
}
