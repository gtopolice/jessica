import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/privy-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_FLOW_RATE_PER_SECOND,
  DEMO_CHAIN_ID,
  SUPERFLUID_BASE_SEPOLIA,
} from "@/lib/superfluid/base-sepolia";
import { encodeCfaCreateFlow } from "@/lib/superfluid/cfa-forwarder";

export async function POST(request: Request) {
  const auth = await getAuthedProfile(request);
  if (!auth.ok) return auth.response;

  let body: { streamId?: string; flowRateWeiPerSecond?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const streamId = body.streamId?.trim();
  if (!streamId) {
    return NextResponse.json({ error: "streamId is required" }, { status: 400 });
  }

  let flowRate = DEFAULT_FLOW_RATE_PER_SECOND;
  if (body.flowRateWeiPerSecond != null && body.flowRateWeiPerSecond !== "") {
    try {
      flowRate = BigInt(body.flowRateWeiPerSecond);
    } catch {
      return NextResponse.json({ error: "Invalid flowRateWeiPerSecond" }, { status: 400 });
    }
    if (flowRate <= 0n) {
      return NextResponse.json({ error: "flowRateWeiPerSecond must be positive" }, { status: 400 });
    }
  }

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const { data: stream, error: streamError } = await supabase
    .from("streams")
    .select("id, creator_id, daily_room_url, status")
    .eq("id", streamId)
    .maybeSingle();

  if (streamError) {
    return NextResponse.json({ error: streamError.message }, { status: 500 });
  }
  if (!stream || stream.status !== "live" || !stream.daily_room_url) {
    return NextResponse.json({ error: "Stream not found or not live" }, { status: 404 });
  }

  if (stream.creator_id === auth.data.profile.id) {
    return NextResponse.json(
      { error: "Use a second wallet (requester) to start a paid session" },
      { status: 400 },
    );
  }

  const { data: fulfiller, error: fulfillerError } = await supabase
    .from("profiles")
    .select("wallet_address")
    .eq("id", stream.creator_id)
    .single();

  if (fulfillerError || !fulfiller) {
    return NextResponse.json({ error: "Could not load fulfiller profile" }, { status: 500 });
  }

  const fulfillerWallet = fulfiller.wallet_address.toLowerCase() as `0x${string}`;
  const requesterWallet = auth.data.wallet;

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({
      stream_id: stream.id,
      requester_id: auth.data.profile.id,
      superfluid_flow_rate: flowRate.toString(),
      chain_id: DEMO_CHAIN_ID,
      status: "pending_payment",
    })
    .select("id, status, superfluid_flow_rate, chain_id, stream_id")
    .single();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  const tx = encodeCfaCreateFlow({
    superToken: SUPERFLUID_BASE_SEPOLIA.fusdcx,
    receiver: fulfillerWallet,
    flowRatePerSecond: flowRate,
  });

  return NextResponse.json({
    session,
    chainId: DEMO_CHAIN_ID,
    superToken: SUPERFLUID_BASE_SEPOLIA.fusdcx,
    fulfillerWallet,
    requesterWallet,
    flowRateWeiPerSecond: flowRate.toString(),
    transaction: {
      to: tx.to,
      data: tx.data,
    },
  });
}
