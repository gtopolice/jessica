"use client";

import { useCallback, useState } from "react";
import { usePrivy, useSendTransaction } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";

type ApiErr = { error?: string };

export function Sprint2Demo() {
  const { authenticated, getAccessToken } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const [streamId, setStreamId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
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

  const createStream = async () => {
    setBusy(true);
    try {
      const headers = await authHeaders();
      const res = await fetch("/api/streams", { method: "POST", headers });
      const body = (await res.json()) as { stream?: { id: string; daily_room_url: string }; error?: string };
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      if (!body.stream) throw new Error("No stream in response");
      setStreamId(body.stream.id);
      setRoomUrl(body.stream.daily_room_url);
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

      const { hash } = await sendTransaction({
        to: body.transaction.to,
        data: body.transaction.data,
        chainId: baseSepolia.id,
        value: 0,
      });
      appendLog(`createFlow tx: ${hash}`);
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
        dailyRoomUrl?: string;
        onChainFlowRate?: string;
      };
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setRoomUrl(body.dailyRoomUrl ?? null);
      appendLog(`Verified. on-chain flowRate=${body.onChainFlowRate}. Daily URL unlocked below.`);
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
        deleteFlowTransaction?: { to: `0x${string}`; data: `0x${string}` } | null;
      };
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      if (body.deleteFlowTransaction) {
        const { hash } = await sendTransaction({
          to: body.deleteFlowTransaction.to,
          data: body.deleteFlowTransaction.data,
          chainId: baseSepolia.id,
          value: 0,
        });
        appendLog(`deleteFlow tx: ${hash}`);
      } else {
        appendLog("Session ended (no deleteFlow tx — was still pending_payment or not requester).");
      }
      setRoomUrl(null);
    } catch (e) {
      appendLog(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

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
        Ending as the <strong>requester</strong> after the session is <strong>active</strong> prompts a <code>deleteFlow</code> tx. If the fulfiller ends first, stop the stream from the requester wallet in a block explorer or run End again as the requester.
      </p>

      <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-zinc-500">
        Stream id (requester pastes from fulfiller)
        <input
          value={streamId}
          onChange={(e) => setStreamId(e.target.value)}
          placeholder="uuid"
          className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-600 dark:bg-zinc-900"
        />
      </label>

      <p className="mt-2 font-mono text-xs text-zinc-500">
        session: {sessionId || "—"}
      </p>

      {roomUrl ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Daily room</p>
          <iframe
            title="Daily"
            src={roomUrl}
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
