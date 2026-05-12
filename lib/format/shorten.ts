import { getAddress } from "viem";

/** Base Sepolia account page on BaseScan. */
export function baseSepoliaAddressExplorerUrl(address: string): string {
  try {
    return `https://sepolia.basescan.org/address/${getAddress(address as `0x${string}`)}`;
  } catch {
    return `https://sepolia.basescan.org/address/${address.trim().toLowerCase()}`;
  }
}

/** Middle ellipsis for EVM addresses (mobile-friendly). */
export function shortenHexAddress(address: string, headChars = 4, tailChars = 4): string {
  const a = address.trim().toLowerCase();
  if (!a.startsWith("0x") || a.length <= 2 + headChars + tailChars) return address.trim();
  return `${a.slice(0, 2 + headChars)}…${a.slice(-tailChars)}`;
}

/** Middle ellipsis for UUID stream / session ids. */
export function shortenUuid(id: string): string {
  const s = id.trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}
