import { NextResponse } from "next/server";
import { getAuthedProfile } from "@/lib/auth/privy-profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createDailyMeetingToken,
  dailyRoomUrlWithToken,
} from "@/lib/daily/meeting-token";

type RouteContext = { params: Promise<{ id: string }> };

const TOKEN_TTL_SEC = 60 * 60 * 6;

export async function POST(request: Request, context: RouteContext) {
  const auth = await getAuthedProfile(request);
  if (!auth.ok) return auth.response;

  const { id: streamId } = await context.params;

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
  }

  const { data: stream, error } = await supabase
    .from("streams")
    .select("id, creator_id, daily_room_name, daily_room_url, status")
    .eq("id", streamId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!stream?.daily_room_url || !stream.daily_room_name) {
    return NextResponse.json({ error: "Stream or Daily room not found" }, { status: 404 });
  }
  if (stream.status !== "live") {
    return NextResponse.json({ error: "Stream is not live" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + TOKEN_TTL_SEC;
  const profileId = auth.data.profile.id;

  let isOwner = false;
  let userName = "Viewer";

  if (stream.creator_id === profileId) {
    isOwner = true;
    userName = "Fulfiller";
  } else {
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("stream_id", streamId)
      .eq("requester_id", profileId)
      .eq("status", "active")
      .maybeSingle();

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Only the fulfiller or an active paid requester can open this Daily room. Complete verify first.",
        },
        { status: 403 },
      );
    }
    userName = "Requester";
  }

  let token: string;
  try {
    token = await createDailyMeetingToken({
      roomName: stream.daily_room_name,
      userName,
      isOwner,
      exp,
      userId: profileId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Daily token error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const embedUrl = dailyRoomUrlWithToken(stream.daily_room_url, token);

  return NextResponse.json({
    embedUrl,
    expiresAt: exp,
    role: isOwner ? "fulfiller" : "requester",
  });
}
