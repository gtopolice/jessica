import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/privy-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPERFLUID_BASE_SEPOLIA } from "@/lib/superfluid/base-sepolia";
import { encodeCfaDeleteFlow } from "@/lib/superfluid/cfa-forwarder";
import { readCfaFlowRate } from "@/lib/superfluid/read-flow";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * End a session.
 *
 * Both the **fulfiller** (flow receiver) and **requester** (flow sender) can call this. The Superfluid
 * [CFA](https://docs.superfluid.finance/docs/technical-reference/CFAv1Forwarder) accepts `deleteFlow`
 * from either party, so we hand back `deleteFlow` calldata to whichever side clicked End — as long as
 * the on-chain flow is still live. The route is idempotent: if a stream lingers after the DB session
 * was marked `ended`, calling End again still returns the cleanup tx (`cleanupOnly: true`).
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

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, wallet_address")
    .in("id", [stream.creator_id, session.requester_id]);

  if (profilesError || !profiles) {
    return NextResponse.json({ error: "Could not load participants" }, { status: 500 });
  }

  const fulfillerWallet = profiles.find((p) => p.id === stream.creator_id)?.wallet_address;
  const requesterWallet = profiles.find((p) => p.id === session.requester_id)?.wallet_address;
  if (!fulfillerWallet || !requesterWallet) {
    return NextResponse.json({ error: "Missing wallet for session participants" }, { status: 500 });
  }

  const sender = requesterWallet.toLowerCase() as `0x${string}`;
  const receiver = fulfillerWallet.toLowerCase() as `0x${string}`;

  let onChainFlowRate = 0n;
  try {
    onChainFlowRate = await readCfaFlowRate({
      superToken: SUPERFLUID_BASE_SEPOLIA.fusdcx,
      sender,
      receiver,
    });
  } catch {
    onChainFlowRate = 0n;
  }

  const deleteTx =
    onChainFlowRate > 0n
      ? encodeCfaDeleteFlow({
          superToken: SUPERFLUID_BASE_SEPOLIA.fusdcx,
          sender,
          receiver,
        })
      : null;

  const wasAlreadyEnded = session.status === "ended";
  let endedAt: string | null = null;
  let status: string = session.status;
  if (!wasAlreadyEnded) {
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
    status = updated.status;
    endedAt = updated.ended_at;
  }

  return NextResponse.json({
    session: { id: sessionId, status, ended_at: endedAt },
    role: isFulfiller ? "fulfiller" : "requester",
    onChainFlowRate: onChainFlowRate.toString(),
    cleanupOnly: wasAlreadyEnded && deleteTx !== null,
    deleteFlowTransaction: deleteTx ? { to: deleteTx.to, data: deleteTx.data } : null,
  });
}
