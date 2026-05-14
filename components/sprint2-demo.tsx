"use client";

import { useCallback, useState } from "react";
import { useActiveWallet, usePrivy } from "@privy-io/react-auth";
import {
  estimateSuperfluidTxGas,
  SUPERFLUID_FORWARDER_TX_GAS_FALLBACK,
} from "@/lib/ethereum/estimate-superfluid-tx-gas";
import { IconCopyButton } from "@/components/icon-copy-button";
import { shortenUuid } from "@/lib/format/shorten";
import { postConfirmEnd } from "@/lib/api/sessions-client";
import { useSessionHeartbeat } from "@/lib/hooks/use-session-heartbeat";
import { useSuperfluidSend } from "@/lib/hooks/use-superfluid-send";

type ApiErr = { error?: string };

export function Sprint2Demo() {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallet: activeWallet } = useActiveWallet();
  const send = useSuperfluidSend();
  const [streamId, setStreamId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [log, setLog] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const authHeaders = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) throw new Error("Not signed in");
    return { Authorization: `Bearer ${token}` };
  }, [getAccessToken]);

  const appendLog = (line: string) => {
    setLog((prev) => `${prev}\n${line}`.trim());
  };

  const gasLimitForSuperfluidTx = useCallback(
    async (tx: { to: `0x${string}`; data: `0x${string}` }) => {
      const from =
        activeWallet?.type === "ethereum"
          ? (activeWallet.address as `0x${string}`)
          : undefined;
      if (!from) return SUPERFLUID_FORWARDER_TX_GAS_FALLBACK;
      return estimateSuperfluidTxGas({ from, to: tx.to, data: tx.data });
    },
    [activeWallet],
  );

  const fetchMeetingEmbed = async (sid: string) => {
    const headers = await authHeaders();
    const res = await fetch(`/api/streams/${sid}/meeting-token`, { method: "POST", headers });
    const body = (await res.json()) as { embedUrl?: string; error?: string };
    if (!res.ok) throw new Error(body.error ?? res.statusText);
    if (!body.embedUrl) throw new Error("No embedUrl in meeting-token response");
    return body.embedUrl;
  };

  const createStream = async () => {
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/streams", { method: "POST", headers });
      const body = (await res.json()) as { stream?: { id: string; daily_room_url: string }; error?: string };
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      if (!body.stream) throw new Error("No stream in response");
      setStreamId(body.stream.id);
      const url = await fetchMeetingEmbed(body.stream.id);
      setEmbedUrl(url);
      appendLog(`Stream ${body.stream.id} created (fulfiller / Daily host uses this tab).`);
    } catch (e) {
      appendLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const startSession = async () => {
    if (!streamId.trim()) {
      appendLog("Paste a stream id from the fulfiller browser.");
      return;
    }
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ streamId: streamId.trim() }),
      });
      const body = (await res.json()) as ApiErr & {
        session?: { id: string };
        transaction?: { to: `0x${string}`; data: `0x${string}` };
        flowRateWeiPerSecond?: string;
      };
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      if (!body.session?.id || !body.transaction) throw new Error("Invalid session response");
      setSessionId(body.session.id);
      appendLog(`Session ${body.session.id} — sign createFlow (${body.flowRateWeiPerSecond}/s min).`);

      const gasLimit = await gasLimitForSuperfluidTx(body.transaction);
      const { hash, via } = await send({
        to: body.transaction.to,
        data: body.transaction.data,
        gasLimit,
      });
      appendLog(`createFlow tx (${via}): ${hash}`);
    } catch (e) {
      appendLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const verifySession = async () => {
    if (!sessionId.trim()) {
      appendLog("Start a session first.");
      return;
    }
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/sessions/${sessionId.trim()}/verify`, {
        method: "POST",
        headers,
      });
      const body = (await res.json()) as ApiErr & {
        streamId?: string;
        dailyRoomUrl?: string;
        onChainFlowRate?: string;
      };
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      const sid = body.streamId ?? streamId.trim();
      if (!sid) throw new Error("Missing stream id — paste stream id or restart session.");
      const url = await fetchMeetingEmbed(sid);
      setEmbedUrl(url);
      appendLog(`Verified. on-chain flowRate=${body.onChainFlowRate}. Daily embed unlocked below.`);
    } catch (e) {
      appendLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const endSession = async () => {
    if (!sessionId.trim()) return;
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/sessions/${sessionId.trim()}/end`, {
        method: "POST",
        headers,
      });
      const body = (await res.json()) as ApiErr & {
        role?: "fulfiller" | "requester";
        onChainFlowRate?: string;
        cleanupOnly?: boolean;
        deleteFlowTransaction?: { to: `0x${string}`; data: `0x${string}` } | null;
      };
      if (!res.ok) throw new Error(body.error ?? res.statusText);

      const role = body.role ?? "caller";
      if (body.deleteFlowTransaction) {
        const gasLimit = await gasLimitForSuperfluidTx(body.deleteFlowTransaction);
        const { hash, via } = await send({
          to: body.deleteFlowTransaction.to,
          data: body.deleteFlowTransaction.data,
          gasLimit,
        });
        const prefix = body.cleanupOnly ? "cleanup deleteFlow" : "deleteFlow";
        appendLog(`${prefix} tx (${role} via ${via}): ${hash}`);
        appendLog(await postConfirmEnd({ sessionId: sessionId.trim(), txHash: hash, authHeaders }));
      } else if ((body.onChainFlowRate ?? "0") === "0") {
        appendLog(`Session ended (${role}). No on-chain flow was active.`);
      } else {
        appendLog(
          `Session ended in DB (${role}). On-chain flow=${body.onChainFlowRate}; click End again to sign cleanup deleteFlow.`,
        );
      }
      setEmbedUrl(null);
    } catch (e) {
      appendLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useSessionHeartbeat({
    sessionId: sessionId.trim() || null,
    enabled: Boolean(embedUrl),
    getAuthHeaders: authHeaders,
  });

  if (!authenticated) return null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Sprint 2 — Daily + Superfluid</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Use <strong>two browsers</strong> (two Privy accounts): <strong>A</strong> creates the stream; <strong>B</strong> pastes
        the stream id, pays via Superfluid, then verifies to unlock the same Daily room.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void createStream()}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          Create stream (fulfiller)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void startSession()}
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-900 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900"
        >
          Start session + createFlow (requester)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void verifySession()}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-zinc-600"
        >
          Verify flow & unlock
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void endSession()}
          className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 disabled:opacity-50 dark:border-red-800 dark:text-red-200"
        >
          End session
        </button>
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        Either party can End: when a Superfluid stream is live, the API returns <code>deleteFlow</code> calldata
        for whoever clicked (requester <em>or</em> fulfiller). The route is idempotent — clicking End again
        signs cleanup if an on-chain flow is still detected.
      </p>

      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        Stream id (requester pastes from fulfiller)
        <div className="mt-1 flex gap-1.5">
          <input
            value={streamId}
            onChange={(e) => setStreamId(e.target.value)}
            placeholder="uuid"
            title={streamId || undefined}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
          />
          <IconCopyButton
            textToCopy={streamId.trim()}
            label="Copy stream id"
            disabled={!streamId.trim()}
          />
        </div>
      </label>

      <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-zinc-500">
        <span className="shrink-0 font-medium uppercase tracking-wide">session</span>
        <span
          className="min-w-0 flex-1 truncate font-mono text-zinc-600 dark:text-zinc-400"
          title={sessionId || undefined}
        >
          {sessionId ? shortenUuid(sessionId) : "—"}
        </span>
        {sessionId.trim() ? (
          <IconCopyButton textToCopy={sessionId.trim()} label="Copy session id" />
        ) : null}
      </div>

      {embedUrl ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Daily room</p>
          <iframe
            title="Daily"
            src={embedUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="h-72 w-full rounded-xl border border-zinc-200 dark:border-zinc-700"
          />
        </div>
      ) : null}

      <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {log || "Logs…"}
      </pre>
    </section>
  );
}
