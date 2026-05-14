"use client";

import { useCallback, useState } from "react";
import { parseAbi, parseUnits } from "viem";
import { BASE_SEPOLIA_FUSDC, SUPERFLUID_BASE_SEPOLIA } from "@/lib/superfluid/base-sepolia";
import { getBaseSepoliaPublicClient } from "@/lib/ethereum/base-sepolia-public-client";
import {
  encodeDowngradeFusdcx,
  encodeFusdcApprove,
  encodeUpgradeFusdcx,
} from "@/lib/superfluid/super-token";
import { useSuperfluidSend } from "@/lib/hooks/use-superfluid-send";

const allowanceAbi = parseAbi([
  "function allowance(address owner, address spender) external view returns (uint256)",
]);

type Props = {
  owner: `0x${string}`;
  onUpdated: () => void;
};

/**
 * Sprint 2 §4.1 UX-abstraction: users see fUSDC. This widget wraps it into the
 * Superfluid Super Token (fUSDCx) so they can stream payments, and unwraps back.
 *
 * Approve+upgrade is two txs on the embedded-wallet path; the smart-wallet path
 * via `useSuperfluidSend` can batch them into a single UserOp once that hook
 * gains multi-call support — for now we keep one tx per step for clarity.
 */
export function WalletActionsWrap({ owner, onUpdated }: Props) {
  const send = useSuperfluidSend();
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const wrap = useCallback(async () => {
    setBusy(true);
    setStatus("Preparing wrap…");
    try {
      const wei = parseUnits(amount || "0", 18);
      if (wei <= 0n) throw new Error("Enter a positive amount");

      const client = getBaseSepoliaPublicClient();
      const allowance = (await client.readContract({
        address: BASE_SEPOLIA_FUSDC as `0x${string}`,
        abi: allowanceAbi,
        functionName: "allowance",
        args: [owner, SUPERFLUID_BASE_SEPOLIA.fusdcx],
      })) as bigint;

      if (allowance < wei) {
        setStatus("Signing approve…");
        const approveTx = encodeFusdcApprove({
          spender: SUPERFLUID_BASE_SEPOLIA.fusdcx,
          amount: wei,
        });
        const a = await send(approveTx);
        setStatus(`approve (${a.via}): ${a.hash}`);
      }

      setStatus("Signing upgrade…");
      const u = await send(encodeUpgradeFusdcx(wei));
      setStatus(`upgrade (${u.via}): ${u.hash}`);
      onUpdated();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Wrap failed");
    } finally {
      setBusy(false);
    }
  }, [amount, onUpdated, owner, send]);

  const unwrap = useCallback(async () => {
    setBusy(true);
    setStatus("Signing downgrade…");
    try {
      const wei = parseUnits(amount || "0", 18);
      if (wei <= 0n) throw new Error("Enter a positive amount");
      const d = await send(encodeDowngradeFusdcx(wei));
      setStatus(`downgrade (${d.via}): ${d.hash}`);
      onUpdated();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Unwrap failed");
    } finally {
      setBusy(false);
    }
  }, [amount, onUpdated, send]);

  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Wrap fUSDC ↔ fUSDCx
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          aria-label="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void wrap()}
          className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          Wrap →
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void unwrap()}
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          ← Unwrap
        </button>
      </div>
      {status ? (
        <p className="mt-2 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
          {status}
        </p>
      ) : null}
    </div>
  );
}
