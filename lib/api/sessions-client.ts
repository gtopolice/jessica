/**
 * Client-side wrappers for `/api/sessions/*` routes. Kept out of the demo component so the
 * UI file stays under the [`.cursorrules`](../../.cursorrules) hand-written-source line cap.
 */

type AuthHeadersFn = () => Promise<Record<string, string>>;

export async function postConfirmEnd(args: {
  sessionId: string;
  txHash: `0x${string}`;
  authHeaders: AuthHeadersFn;
}): Promise<string> {
  try {
    const headers = await args.authHeaders();
    const res = await fetch(`/api/sessions/${args.sessionId}/confirm-end`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ txHash: args.txHash }),
    });
    const body = (await res.json()) as {
      error?: string;
      blockNumber?: string;
      session?: { ended_on_chain_at?: string | null };
    };
    if (!res.ok) return `confirm-end failed: ${body.error ?? res.statusText}`;
    return `confirm-end OK · block ${body.blockNumber ?? "?"} · ended_on_chain_at=${
      body.session?.ended_on_chain_at ?? "?"
    }`;
  } catch (e) {
    return `confirm-end error: ${e instanceof Error ? e.message : String(e)}`;
  }
}
