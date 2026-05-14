"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { baseSepolia } from "viem/chains";
import type { ReactNode } from "react";

/**
 * `SmartWalletsProvider` is a no-op until smart wallets are enabled in the Privy
 * dashboard (App → Wallet infrastructure → Smart wallets). When enabled with a CDP
 * bundler + paymaster URL for Base Sepolia, `useSuperfluidSend` automatically
 * routes Superfluid txs through the smart wallet (gas-sponsored UserOps).
 *
 * Without dashboard config, the embedded-wallet fallback remains the active path.
 */
export function Providers({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        defaultChain: baseSepolia,
        /** Sprint 2 token + Superfluid addresses are Base Sepolia–only for now. */
        supportedChains: [baseSepolia],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <SmartWalletsProvider>{children}</SmartWalletsProvider>
    </PrivyProvider>
  );
}
