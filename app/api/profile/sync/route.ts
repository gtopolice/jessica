import { NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEthereumWalletAddress } from "@/lib/privy/ethereum-address";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
  }

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: "Privy is not configured on the server" },
      { status: 500 },
    );
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const privy = new PrivyClient(appId, appSecret);

  let userId: string;
  try {
    const claims = await privy.verifyAuthToken(token);
    userId = claims.userId;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  let user;
  try {
    user = await privy.getUser(userId);
  } catch {
    return NextResponse.json(
      { error: "Could not load Privy user" },
      { status: 502 },
    );
  }

  const wallet = getEthereumWalletAddress(user);
  if (!wallet) {
    return NextResponse.json(
      { error: "No Ethereum wallet on this account yet" },
      { status: 400 },
    );
  }

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        privy_user_id: userId,
        wallet_address: wallet,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "privy_user_id" },
    )
    .select("id, wallet_address, reputation_score, blacklisted_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile: data });
}
