"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const canConnectRealtime = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function RealtimeConnectionLabel() {
  const [status, setStatus] = useState<string>(() =>
    canConnectRealtime ? "connecting" : "not configured",
  );

  useEffect(() => {
    if (!canConnectRealtime) return;

    let client;
    try {
      client = createSupabaseBrowserClient();
    } catch {
      window.setTimeout(() => setStatus("client error"), 0);
      return;
    }

    const channel = client
      .channel("realtime:health")
      .subscribe((s) => setStatus(s === "SUBSCRIBED" ? "connected" : String(s).toLowerCase()));

    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  return (
    <p className="text-sm text-zinc-500 dark:text-zinc-400">
      Supabase Realtime: <span className="font-medium text-zinc-700 dark:text-zinc-300">{status}</span>
    </p>
  );
}
