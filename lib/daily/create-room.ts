/**
 * Creates a Daily.co room (server-side).
 *
 * **Privacy:** Defaults to **`private`** (link-in-bio strangers cannot join; aligns with controlled access in
 * [docs/PRD.md](docs/PRD.md) §4–5). Joining from our app uses [meeting tokens](https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token)
 * via `POST /api/streams/[id]/meeting-token`. Set `DAILY_ROOM_PRIVACY=public` only for quick tests without tokens.
 *
 * @see https://docs.daily.co/reference/rest-api/rooms/create-room
 */
export async function createDailyRoom(params: { name: string }): Promise<{
  name: string;
  url: string;
  id: string;
}> {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) {
    throw new Error("DAILY_API_KEY is not set");
  }

  const privacy =
    process.env.DAILY_ROOM_PRIVACY === "public" ? "public" : "private";

  const res = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      privacy,
      properties: {
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
        enable_chat: true,
        start_video_off: false,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Daily API ${res.status}: ${text}`);
  }

  const body = (await res.json()) as { name: string; url: string; id: string };
  return { name: body.name, url: body.url, id: body.id };
}
