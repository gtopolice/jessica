"use client";

import { useActiveWallet } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";
import { formatUnits, getAddress, parseAbi } from "viem";
import { baseSepolia } from "viem/chains";
import { BASE_SEPOLIA_FUSDC, SUPERFLUID_BASE_SEPOLIA } from "@/lib/superfluid/base-sepolia";
import { getBaseSepoliaPublicClient } from "@/lib/ethereum/base-sepolia-public-client";
import { WalletActionsWrap } from "@/components/wallet-actions-wrap";

const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

function caip2ToChainId(caip: string | undefined): number | null {
  if (!caip) return null;
  const m = /^eip155:(\d+)$/i.exec(caip.trim());
  return m ? parseInt(m[1], 10) : null;
}

function trimTrailingZeros(formatted: string): string {
  if (!formatted.includes(".")) return formatted;
  return formatted.replace(/\.?0+$/, "") || "0";
}

async function readErc20Balance(
  token: `0x${string}`,
  owner: `0x${string}`,
): Promise<{ raw: bigint; decimals: number }> {
  const client = getBaseSepoliaPublicClient();
  const [raw, decimals] = await Promise.all([
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [owner],
    }),
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ]);
  return { raw, decimals: Number(decimals) };
}

export type WalletBalancesPanelProps = {
  /** Fallback when active wallet is not ready yet (linked-account preview). */
  addressFallback: string | null;
};

export function WalletBalancesPanel({ addressFallback }: WalletBalancesPanelProps) {
  const { wallet } = useActiveWallet();
  const ethWallet = wallet?.type === "ethereum" ? wallet : null;
  const addressRaw =
    ethWallet?.address ?? (addressFallback ? getAddress(addressFallback) : null);
  const address = addressRaw ? (getAddress(addressRaw) as `0x${string}`) : null;

  const activeChainId = caip2ToChainId(ethWallet?.chainId);
  const isCorrectChain = !ethWallet || activeChainId === baseSepolia.id;

  const [eth, setEth] = useState<string>("—");
  const [fusdc, setFusdc] = useState<string>("—");
  const [fusdcx, setFusdcx] = useState<string>("—");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const client = getBaseSepoliaPublicClient();
      if (ethWallet && !isCorrectChain) {
        setEth("—");
        setFusdc("—");
        setFusdcx("—");
        setLoading(false);
        return;
      }

      const [weiEth, f, x] = await Promise.all([
        client.getBalance({ address }),
        readErc20Balance(BASE_SEPOLIA_FUSDC as `0x${string}`, address),
        readErc20Balance(SUPERFLUID_BASE_SEPOLIA.fusdcx, address),
      ]);

      setEth(`${trimTrailingZeros(formatUnits(weiEth, 18))} ETH`);
      setFusdc(`${trimTrailingZeros(formatUnits(f.raw, f.decimals))} fUSDC`);
      setFusdcx(`${trimTrailingZeros(formatUnits(x.raw, x.decimals))} fUSDCx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Balance fetch failed");
      setEth("—");
      setFusdc("—");
      setFusdcx("—");
    } finally {
      setLoading(false);
    }
  }, [address, ethWallet, isCorrectChain]);

  useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 14_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const onNetworkChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (!ethWallet || v !== String(baseSepolia.id)) return;
    try {
      await ethWallet.switchChain(baseSepolia.id);
    } catch {
      /* already on target chain */
    }
  };

  if (!address) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <label
          htmlFor="jessica-network-select"
          className="text-xs font-medium uppercase tracking-wide text-zinc-500"
        >
          Network
        </label>
        <select
          id="jessica-network-select"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm sm:max-w-xs dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          value={String(baseSepolia.id)}
          onChange={(e) => void onNetworkChange(e)}
        >
          <option value={String(baseSepolia.id)}>
            Base Sepolia · chain {baseSepolia.id}
          </option>
          <option disabled value="__soon1">
            Base (mainnet) — not enabled in this build
          </option>
          <option disabled value="__soon2">
            Ethereum — not enabled in this build
          </option>
        </select>
      </div>
      <p className="text-xs text-zinc-500">
        J.E.S.S.I.C.A. Sprint 2 is wired to Base Sepolia only; the menu matches common wallet UX and will gain
        more chains later.
      </p>

      {ethWallet && !isCorrectChain ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Wallet reports chain ID {activeChainId ?? "unknown"}. Switch to Base Sepolia to use streams and see
          balances here.
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => void ethWallet.switchChain(baseSepolia.id)}
          >
            Switch to Base Sepolia
          </button>
        </p>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Balances</p>
        <ul className="mt-2 space-y-1.5 font-mono text-sm text-zinc-800 dark:text-zinc-200">
          <li className="flex justify-between gap-4">
            <span className="text-zinc-500">ETH</span>
            <span className="text-right">{loading ? "…" : eth}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-zinc-500">fUSDC</span>
            <span className="text-right">{loading ? "…" : fusdc}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-zinc-500">fUSDCx</span>
            <span className="text-right">{loading ? "…" : fusdcx}</span>
          </li>
        </ul>
        {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      {isCorrectChain && address ? (
        <WalletActionsWrap owner={address} onUpdated={refresh} />
      ) : null}
    </div>
  );
}
