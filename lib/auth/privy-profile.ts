import { NextResponse } from "next/server";
import { PrivyClient } from "@privy-io/server-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEthereumWalletAddress } from "@/lib/privy/ethereum-address";

export type AuthedProfile = {
  privyUserId: string;
  wallet: `0x${string}`;
  profile: {
    id: string;
    wallet_address: string;
    reputation_score: number;
    blacklisted_at: string | null;
  };
};

/**
 * Verifies Privy bearer token and loads the caller's profile from Supabase.
 * Returns a JSON Response on failure.
 */
export async function getAuthedProfile(
  request: Request,
): Promise<{ ok: true; data: AuthedProfile } | { ok: false; response: NextResponse }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Missing bearer token" }, { status: 401 }),
    };
  }

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Privy is not configured on the server" }, { status: 500 }),
    };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const privy = new PrivyClient(appId, appSecret);

  let userId: string;
  try {
    const claims = await privy.verifyAuthToken(token);
    userId = claims.userId;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }),
    };
  }

  let user;
  try {
    user = await privy.getUser(userId);
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Could not load Privy user" }, { status: 502 }),
    };
  }

  const walletRaw = getEthereumWalletAddress(user);
  if (!walletRaw) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No Ethereum wallet on this account yet" },
        { status: 400 },
      ),
    };
  }
  const wallet = walletRaw.toLowerCase() as `0x${string}`;

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Supabase is not configured on the server" },
        { status: 500 },
      ),
    };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, wallet_address, reputation_score, blacklisted_at")
    .eq("privy_user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Profile not found; call POST /api/profile/sync first" },
        { status: 400 },
      ),
    };
  }

  if (profile.blacklisted_at) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Account is blacklisted" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    data: {
      privyUserId: userId,
      wallet,
      profile: {
        id: profile.id,
        wallet_address: profile.wallet_address,
        reputation_score: profile.reputation_score,
        blacklisted_at: profile.blacklisted_at,
      },
    },
  };
}
