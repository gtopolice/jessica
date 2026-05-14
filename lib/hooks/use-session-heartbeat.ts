"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 30_000;

type AuthHeadersFn = () => Promise<Record<string, string>>;

/**
 * Pings `/api/sessions/[id]/heartbeat` while a session is active so the reconcile
 * cron does not auto-end it. Also fires a `keepalive` request on tab close /
 * `pagehide` so abandoned tabs surface to the server within one reconcile cycle.
 */
export function useSessionHeartbeat(args: {
  sessionId: string | null;
  enabled: boolean;
  getAuthHeaders: AuthHeadersFn;
}): void {
  const { sessionId, enabled, getAuthHeaders } = args;

  useEffect(() => {
    if (!enabled || !sessionId) return;
    let cancelled = false;

    const send = async (opts?: { keepalive?: boolean }) => {
      try {
        const headers = await getAuthHeaders();
        await fetch(`/api/sessions/${sessionId}/heartbeat`, {
          method: "POST",
          headers,
          keepalive: opts?.keepalive,
        });
      } catch {
        /* best-effort */
      }
    };

    void send();
    const intervalId = window.setInterval(() => {
      if (!cancelled) void send();
    }, HEARTBEAT_INTERVAL_MS);

    const onUnload = () => {
      void send({ keepalive: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void send();
    };

    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, sessionId, getAuthHeaders]);
}
