/**
 * Mint a Daily [meeting token](https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token)
 * so Prebuilt iframe can join **private** rooms.
 */
export async function createDailyMeetingToken(params: {
  roomName: string;
  userName: string;
  isOwner: boolean;
  /** Unix seconds */
  exp: number;
  userId?: string;
}): Promise<string> {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    throw new Error("DAILY_API_KEY is not set");
  }

  const body: Record<string, unknown> = {
    properties: {
      room_name: params.roomName,
      user_name: params.userName,
      is_owner: params.isOwner,
      exp: params.exp,
    },
  };

  if (params.userId && params.userId.length <= 36) {
    (body.properties as Record<string, unknown>).user_id = params.userId;
  }

  const res = await fetch("https://api.daily.co/v1/meeting-tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily meeting-tokens ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { token?: string };
  if (!json.token) {
    throw new Error("Daily meeting-tokens: missing token in response");
  }
  return json.token;
}

/** Append `t` query for Daily Prebuilt / iframe join. */
export function dailyRoomUrlWithToken(roomUrl: string, token: string): string {
  const u = new URL(roomUrl);
  u.searchParams.set("t", token);
  return u.toString();
}
