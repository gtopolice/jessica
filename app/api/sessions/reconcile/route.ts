import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Railway cron minimum is 5 minutes, so we use 6 minutes here to give the
// scheduled call a full cycle of headroom before we end a session.
const STALE_AFTER_SECONDS = 360;

/**
 * Cron-style reconciliation. Marks active sessions whose `last_heartbeat_at` is
 * older than `STALE_AFTER_SECONDS` as `ended`, capturing the abandoned-tab case.
 *
 * On-chain `deleteFlow` is **not** signed by the server (no custodial signer in
 * Sprint 2). The next time a participant returns and clicks End, the
 * `/api/sessions/[id]/end` route's cleanup branch sees the lingering flow and
 * returns calldata so the user can stop it.
 *
 * Guarded by `SCHEDULED_TASK_SECRET`. Invoke from Railway/Vercel Cron / GH Action:
 *   `curl -X POST -H "Authorization: Bearer $SCHEDULED_TASK_SECRET" $URL/api/sessions/reconcile`
 */
export async function POST(request: Request) {
  const expected = process.env.SCHEDULED_TASK_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "SCHEDULED_TASK_SECRET is not configured" },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - STALE_AFTER_SECONDS * 1000).toISOString();
  const now = new Date().toISOString();

  // Pass 1: sessions that heartbeated at least once but went stale.
  const stale = await supabase
    .from("sessions")
    .update({ status: "ended", ended_at: now })
    .eq("status", "active")
    .lt("last_heartbeat_at", cutoff)
    .select("id");

  // Pass 2: sessions that never heartbeated and were started before the cutoff.
  const neverPinged = await supabase
    .from("sessions")
    .update({ status: "ended", ended_at: now })
    .eq("status", "active")
    .is("last_heartbeat_at", null)
    .lt("started_at", cutoff)
    .select("id");

  if (stale.error || neverPinged.error) {
    return NextResponse.json(
      { error: stale.error?.message ?? neverPinged.error?.message },
      { status: 500 },
    );
  }

  const endedIds = [
    ...(stale.data?.map((s) => s.id) ?? []),
    ...(neverPinged.data?.map((s) => s.id) ?? []),
  ];

  return NextResponse.json({
    ok: true,
    cutoffSeconds: STALE_AFTER_SECONDS,
    endedCount: endedIds.length,
    endedIds,
  });
}
