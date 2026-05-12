import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/privy-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPERFLUID_BASE_SEPOLIA } from "@/lib/superfluid/base-sepolia";
import { readCfaFlowRate } from "@/lib/superfluid/read-flow";

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
    .select("id, status, requester_id, stream_id, superfluid_flow_rate, chain_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.requester_id !== auth.data.profile.id) {
    return NextResponse.json({ error: "Only the requester can verify this session" }, { status: 403 });
  }

  if (session.status !== "pending_payment") {
    return NextResponse.json(
      { error: `Session is ${session.status}, expected pending_payment` },
      { status: 400 },
    );
  }

  const { data: stream, error: streamError } = await supabase
    .from("streams")
    .select("id, daily_room_url, creator_id, status")
    .eq("id", session.stream_id)
    .single();

  if (streamError || !stream?.daily_room_url) {
    return NextResponse.json({ error: "Stream missing or has no Daily URL" }, { status: 500 });
  }

  const { data: fulfiller, error: fulfillerError } = await supabase
    .from("profiles")
    .select("wallet_address")
    .eq("id", stream.creator_id)
    .single();

  if (fulfillerError || !fulfiller?.wallet_address) {
    return NextResponse.json({ error: "Fulfiller wallet missing" }, { status: 500 });
  }

  const sender = auth.data.wallet;
  const receiver = fulfiller.wallet_address.toLowerCase() as `0x${string}`;
  const minRate = BigInt(String(session.superfluid_flow_rate));

  let onChainRate: bigint;
  try {
    onChainRate = await readCfaFlowRate({
      superToken: SUPERFLUID_BASE_SEPOLIA.fusdcx,
      sender,
      receiver,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "RPC error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (onChainRate < minRate) {
    return NextResponse.json(
      {
        error: "No Superfluid stream detected yet (or flow rate below session minimum)",
        onChainFlowRate: onChainRate.toString(),
        requiredMin: minRate.toString(),
      },
      { status: 402 },
    );
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("sessions")
    .update({
      status: "active",
      started_at: now,
    })
    .eq("id", sessionId)
    .eq("status", "pending_payment")
    .select("id, status, started_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    session: updated,
    streamId: stream.id,
    dailyRoomUrl: stream.daily_room_url,
    onChainFlowRate: onChainRate.toString(),
  });
}
