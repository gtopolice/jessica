import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/privy-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPERFLUID_BASE_SEPOLIA } from "@/lib/superfluid/base-sepolia";
import { encodeCfaDeleteFlow } from "@/lib/superfluid/cfa-forwarder";

type RouteContext = { params: Promise<{ id: string }> };

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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

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

  if (session.status === "ended") {
    return NextResponse.json({ ok: true, session: { id: sessionId, status: "ended" } });
  }

  const { data: fulfiller } = await supabase
    .from("profiles")
    .select("wallet_address")
    .eq("id", stream.creator_id)
    .single();

  if (!fulfiller?.wallet_address) {
    return NextResponse.json({ error: "Fulfiller wallet missing" }, { status: 500 });
  }

  const receiver = fulfiller.wallet_address.toLowerCase() as `0x${string}`;
  const deleteTx = encodeCfaDeleteFlow({
    superToken: SUPERFLUID_BASE_SEPOLIA.fusdcx,
    receiver,
  });

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("sessions")
    .update({ status: "ended", ended_at: now })
    .eq("id", sessionId)
    .in("status", ["pending_payment", "active"])
    .select("id, status, ended_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    session: updated,
    deleteFlowTransaction:
      isRequester && session.status === "active"
        ? { to: deleteTx.to, data: deleteTx.data }
        : null,
  });
}
