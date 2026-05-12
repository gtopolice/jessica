"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";
import { RealtimeConnectionLabel } from "@/components/realtime-connection-label";
import { Sprint2Demo } from "@/components/sprint2-demo";

type SyncState = "idle" | "syncing" | "ok" | "error";

export function HomeClient() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          J.E.S.S.I.C.A.
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Copy{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            .env.example
          </code>{" "}
          to{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            .env.local
          </code>{" "}
          and set at least{" "}
          <code className="rounded bg-zinc-200 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
            NEXT_PUBLIC_PRIVY_APP_ID
          </code>
          .
        </p>
      </div>
    );
  }

  return <HomeWithPrivy />;
}

function HomeWithPrivy() {
  const { ready, authenticated, login, logout, user, getAccessToken } = usePrivy();
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncDetail, setSyncDetail] = useState<string>("");

  const syncProfile = useCallback(async () => {
    setSyncState("syncing");
    setSyncDetail("");
    const token = await getAccessToken();
    if (!token) {
      setSyncState("error");
      setSyncDetail("No access token");
      return;
    }

    const attempt = async () => {
      const res = await fetch("/api/profile/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        profile?: { wallet_address: string; reputation_score: number };
      };
      return { res, body };
    };

    for (let i = 0; i < 5; i++) {
      const { res, body } = await attempt();
      if (res.ok && body.profile) {
        setSyncState("ok");
        setSyncDetail(body.profile.wallet_address);
        return;
      }
      if (res.status === 400 && body.error?.includes("No Ethereum wallet")) {
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }
      setSyncState("error");
      setSyncDetail(body.error ?? res.statusText);
      return;
    }

    setSyncState("error");
    setSyncDetail("Wallet not ready yet; try again.");
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    const handle = window.setTimeout(() => {
      void syncProfile();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [ready, authenticated, syncProfile]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Sprint 1–2
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          J.E.S.S.I.C.A.
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Privy login, Supabase profile, Realtime check, Daily rooms, and Superfluid-gated sessions.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        {!ready ? (
          <p className="text-zinc-500">Loading Privy…</p>
        ) : !authenticated ? (
          <div className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">Sign in to create or link a wallet.</p>
            <button
              type="button"
              onClick={() => void login()}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Log in
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">Signed in</p>
            <p className="font-mono text-sm break-all text-zinc-800 dark:text-zinc-200">
              {user?.id ?? "—"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void syncProfile()}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Sync profile
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Log out
              </button>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Supabase:{" "}
              <span className="font-medium">
                {syncState === "idle" && "—"}
                {syncState === "syncing" && "Syncing…"}
                {syncState === "ok" && `OK · ${syncDetail}`}
                {syncState === "error" && `Error · ${syncDetail}`}
              </span>
            </p>
          </div>
        )}
      </section>

      {authenticated && syncState === "ok" ? <Sprint2Demo /> : null}

      <RealtimeConnectionLabel />

      <p className="text-xs text-zinc-400">
        Gasless transactions: configure a CDP paymaster / bundler in the Privy dashboard for Base (see{" "}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">README.md</code>).
      </p>
    </div>
  );
}
