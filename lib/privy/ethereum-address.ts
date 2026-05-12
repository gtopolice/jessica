import type { User } from "@privy-io/server-auth";

/**
 * Prefer smart wallet, then first linked Ethereum EOA.
 */
export function getEthereumWalletAddress(user: User): string | null {
  const smart = user.linkedAccounts.find((a) => a.type === "smart_wallet");
  if (smart && "address" in smart && typeof smart.address === "string") {
    return smart.address;
  }
  const ethWallet = user.linkedAccounts.find(
    (a) =>
      a.type === "wallet" &&
      "chainType" in a &&
      a.chainType === "ethereum" &&
      "address" in a &&
      typeof a.address === "string",
  );
  if (ethWallet && "address" in ethWallet) {
    return ethWallet.address as string;
  }
  return null;
}
