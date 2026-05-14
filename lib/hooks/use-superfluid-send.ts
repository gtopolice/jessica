"use client";

import { useCallback } from "react";
import { useSendTransaction } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { baseSepolia } from "viem/chains";

export type SuperfluidTx = {
  to: `0x${string}`;
  data: `0x${string}`;
  /** Optional gas override for the embedded-wallet path (smart-wallet path uses the bundler). */
  gasLimit?: bigint;
};

export type SuperfluidSendResult = {
  hash: `0x${string}`;
  /** Which path actually submitted the tx — useful for logs. */
  via: "smart-wallet" | "embedded";
};

/**
 * Sends a Superfluid-bound transaction using the Privy **smart wallet** when one is
 * configured (gas-sponsored UserOp via CDP / dashboard-configured bundler+paymaster),
 * otherwise falls back to the embedded EOA via `useSendTransaction`.
 *
 * Behaviour is identical to the existing flow when smart wallets are not enabled in
 * the Privy dashboard, so this hook is safe to ship without configuration.
 */
export function useSuperfluidSend() {
  const { sendTransaction: embeddedSend } = useSendTransaction();
  const { client: smartClient } = useSmartWallets();

  return useCallback(
    async (tx: SuperfluidTx): Promise<SuperfluidSendResult> => {
      if (smartClient) {
        const hash = await smartClient.sendTransaction({
          to: tx.to,
          data: tx.data,
          value: 0n,
          chain: baseSepolia,
          account: smartClient.account,
        });
        return { hash, via: "smart-wallet" };
      }
      const { hash } = await embeddedSend({
        to: tx.to,
        data: tx.data,
        chainId: baseSepolia.id,
        value: 0,
        gasLimit: tx.gasLimit,
      });
      return { hash: hash as `0x${string}`, via: "embedded" };
    },
    [embeddedSend, smartClient],
  );
}
