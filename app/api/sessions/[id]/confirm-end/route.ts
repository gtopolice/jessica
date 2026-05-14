import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/privy-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBaseSepoliaPublicClient } from "@/lib/ethereum/base-sepolia-public-client";
import { SUPERFLUID_BASE_SEPOLIA } from "@/lib/superfluid/base-sepolia";
import { readCfaFlowRate } from "@/lib/superfluid/read-flow";

type RouteContext = { params: Promise<{ id: string }> };

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const RECEIPT_TIMEOUT_MS = 30_000;

/**
 * Webhook-style on-chain confirmation for `deleteFlow`.
 *
 * Called by the client after `endSession` signs `deleteFlow`. The server verifies:
 *  - tx receipt status is success and the call targeted the
 *    [CFAv1Forwarder](https://docs.superfluid.finance/docs/technical-reference/CFAv1Forwarder).
 *  - CFA `getFlow(token, sender, receiver)` reports `flowRate == 0`.
 *
 * On success the session row is stamped with `ended_on_chain_at` + `ended_on_chain_tx_hash`.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile(request);
  if (!auth.ok) return auth.response;

  const { id: sessionId } = await context.params;

  let body: { txHash?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const txHash = body.txHash?.trim();
  if (!txHash || !TX_HASH_RE.test(txHash)) {
    return NextResponse.json({ error: "txHash must be a 0x-prefixed 32-byte hex string" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, status, requester_id, stream_id, ended_on_chain_at, ended_on_chain_tx_hash")
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

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, wallet_address")
    .in("id", [stream.creator_id, session.requester_id]);

  const requesterWallet = profiles?.find((p) => p.id === session.requester_id)?.wallet_address;
  const fulfillerWallet = profiles?.find((p) => p.id === stream.creator_id)?.wallet_address;
  if (!requesterWallet || !fulfillerWallet) {
    return NextResponse.json({ error: "Missing wallet for session participants" }, { status: 500 });
  }
  const sender = requesterWallet.toLowerCase() as `0x${string}`;
  const receiver = fulfillerWallet.toLowerCase() as `0x${string}`;

  const client = getBaseSepoliaPublicClient();
  let receipt;
  try {
    receipt = await client.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      timeout: RECEIPT_TIMEOUT_MS,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Receipt wait failed";
    return NextResponse.json({ error: `Receipt unavailable: ${message}` }, { status: 504 });
  }

  if (receipt.status !== "success") {
    return NextResponse.json({ error: "deleteFlow tx reverted on-chain", txHash }, { status: 400 });
  }

  const forwarder = SUPERFLUID_BASE_SEPOLIA.cfaV1Forwarder.toLowerCase();
  if (receipt.to?.toLowerCase() !== forwarder) {
    return NextResponse.json(
      { error: "Tx did not target the Superfluid CFAv1Forwarder", txHash, to: receipt.to },
      { status: 400 },
    );
  }

  let onChainFlowRate: bigint;
  try {
    onChainFlowRate = await readCfaFlowRate({
      superToken: SUPERFLUID_BASE_SEPOLIA.fusdcx,
      sender,
      receiver,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "RPC error";
    return NextResponse.json({ error: `getFlow failed: ${message}` }, { status: 502 });
  }

  if (onChainFlowRate !== 0n) {
    return NextResponse.json(
      {
        error: "Stream is still active on-chain",
        onChainFlowRate: onChainFlowRate.toString(),
        txHash,
      },
      { status: 409 },
    );
  }

  const stampedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("sessions")
    .update({
      ended_on_chain_at: stampedAt,
      ended_on_chain_tx_hash: txHash,
      status: "ended",
      ended_at: session.status === "ended" ? undefined : stampedAt,
    })
    .eq("id", sessionId)
    .select("id, status, ended_at, ended_on_chain_at, ended_on_chain_tx_hash")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    session: updated,
    role: isFulfiller ? "fulfiller" : "requester",
    blockNumber: receipt.blockNumber?.toString() ?? null,
    onChainFlowRate: "0",
  });
}
