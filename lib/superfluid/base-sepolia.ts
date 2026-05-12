import { baseSepolia } from "viem/chains";

/** Chain used for Sprint 2 demo (Privy config already includes Base Sepolia). */
export const DEMO_CHAIN = baseSepolia;
export const DEMO_CHAIN_ID = baseSepolia.id;

/**
 * Superfluid protocol on Base Sepolia (from @superfluid-finance/sdk-core metadata / explorer).
 * Override via env if the network upgrades contracts.
 */
export const SUPERFLUID_BASE_SEPOLIA = {
  cfaV1: (process.env.NEXT_PUBLIC_SUPERFLUID_CFA_V1 ??
    "0x6836F23d6171D74Ef62FcF776655aBcD2bcd62Ef") as `0x${string}`,
  cfaV1Forwarder: (process.env.NEXT_PUBLIC_SUPERFLUID_CFA_FORWARDER ??
    "0xcfA132E353cB4E398080B9700609bb008eceB125") as `0x${string}`,
  /** Wrapped USDC Super Token on Base Sepolia (faucet / test USDCx). */
  usdcx: (process.env.NEXT_PUBLIC_USDCX_ADDRESS ??
    "0x1650581f573ead727b92073b5ef8b4f5b94d1648") as `0x${string}`,
} as const;

/** Tiny positive flow rate (wei/sec style magnitude for int96) — cheap for demos. */
export const DEFAULT_FLOW_RATE_PER_SECOND = 1_000n;
