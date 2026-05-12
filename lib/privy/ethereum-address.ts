import type { User } from "@privy-io/server-auth";
import { getEthereumAddressFromLinkedAccounts } from "@/lib/privy/linked-ethereum-address";

/**
 * Prefer smart wallet, then first linked Ethereum EOA.
 */
export function getEthereumWalletAddress(user: User): string | null {
  return getEthereumAddressFromLinkedAccounts(user.linkedAccounts);
}
