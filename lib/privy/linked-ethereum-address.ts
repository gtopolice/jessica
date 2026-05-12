/**
 * Same rules as the server: prefer smart wallet, then first linked Ethereum EOA.
 * Safe to import from client components (no server-only deps).
 */
export function getEthereumAddressFromLinkedAccounts(
  linkedAccounts:
    | readonly { type: string; chainType?: string; address?: string }[]
    | undefined,
): string | null {
  if (!linkedAccounts?.length) return null;
  const smart = linkedAccounts.find((a) => a.type === "smart_wallet" && typeof a.address === "string");
  if (smart?.address) return smart.address;
  const ethWallet = linkedAccounts.find(
    (a) =>
      a.type === "wallet" &&
      a.chainType === "ethereum" &&
      typeof a.address === "string",
  );
  return ethWallet?.address ?? null;
}
