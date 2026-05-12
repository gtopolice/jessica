import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthedProfile } from "@/lib/auth/privy-profile";
import { createDailyRoom } from "@/lib/daily/create-room";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await getAuthedProfile(request);
  if (!auth.ok) return auth.response;

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const roomName = `jessica-${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  let daily;
  try {
    daily = await createDailyRoom({ name: roomName });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Daily room creation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: stream, error } = await supabase
    .from("streams")
    .insert({
      creator_id: auth.data.profile.id,
      node_type: "human",
      daily_room_name: daily.name,
      daily_room_url: daily.url,
      status: "live",
    })
    .select("id, daily_room_url, daily_room_name, status, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stream });
}
