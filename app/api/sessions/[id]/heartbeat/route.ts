import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/privy-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Liveness ping for an active session. Sets `last_heartbeat_at = now()` if the caller
 * is the requester or fulfiller. The reconcile cron (see /api/sessions/reconcile)
 * ends sessions whose last heartbeat is stale.
 *
 * The client posts on an interval and on tab close (fetch `keepalive: true`).
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile(request);
  if (!auth.ok) return auth.response;

  const { id: sessionId } = await context.params;

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, status, requester_id, stream_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: stream, error: streamError } = await supabase
    .from("streams")
    .select("creator_id")
    .eq("id", session.stream_id)
    .single();
  if (streamError || !stream) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }

  const isRequester = session.requester_id === auth.data.profile.id;
  const isFulfiller = stream.creator_id === auth.data.profile.id;
  if (!isRequester && !isFulfiller) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("sessions")
    .update({ last_heartbeat_at: now })
    .eq("id", sessionId)
    .in("status", ["pending_payment", "active"]);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, heartbeatAt: now });
}
