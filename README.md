# J.E.S.S.I.C.A.

Next.js app for **J.E.S.S.I.C.A.** (Joint Eyesight Sharing System for Instant Camera Access). Product requirements live in [docs/PRD.md](docs/PRD.md).

## Sprint 1 — scaffold

- **Next.js** on the [App Router](https://nextjs.org/docs/app), ready to deploy on [Railway](https://railway.app/) (`npm run build` / `npm run start`).
- **Supabase:** PostgreSQL + Realtime. Run SQL migrations in the Supabase SQL Editor (or via CLI).
- **Privy:** login and embedded Ethereum wallets (Base / Base Sepolia).
- **Profile sync:** `POST /api/profile/sync` verifies the Privy access token and upserts `profiles` with the **service role** key (server only).

## Sprint 2 — Daily + Superfluid

- **Daily.co:** `POST /api/streams` creates a room (default **`privacy: private`**; optional `DAILY_ROOM_PRIVACY=public` for local tests without tokens). The app mints [meeting tokens](https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token) via **`POST /api/streams/[id]/meeting-token`**: the **fulfiller** (stream creator) and an **active** session **requester** get a short-lived `?t=` URL for the Prebuilt iframe — aligned with controlled access in [docs/PRD.md](docs/PRD.md).
- **Superfluid (Base Sepolia):** `POST /api/sessions` opens a `sessions` row and returns **CFAv1Forwarder** `createFlow` calldata for the **requester** to stream **fUSDCx** (Superfluid Super Token over faucet **fUSDC**) to the **fulfiller**. `POST /api/sessions/[id]/verify` reads the on-chain flow via the **CFA** contract; if the rate is sufficient it sets the session **active** and returns the Daily URL (HTTP **402** if no flow yet — same spirit as x402 gating).
- **UI:** After profile sync succeeds, the home page shows a **Sprint 2** panel: two-browser demo (fulfiller creates stream; requester pastes `stream id`, signs `createFlow`, verifies, iframe).

### On-chain testnet assets

- Requester needs **fUSDCx** on Base Sepolia: mint **[fUSDC](https://sepolia.basescan.org/address/0x6b0dacea6a72e759243c99eaed840dee9564c194)** from the contract (if exposed), then wrap/upgrade to **[fUSDCx](https://sepolia.basescan.org/address/0x1650581f573ead727b92073b5ef8b4f5b94d1648)** via the [Superfluid Base Sepolia dashboard](https://explorer.superfluid.org/base-sepolia). If `createFlow` reverts, check fUSDCx balance and flow rules.
- Default **fUSDCx** address is in [lib/superfluid/base-sepolia.ts](lib/superfluid/base-sepolia.ts); override with `NEXT_PUBLIC_FUSDCX_ADDRESS` (or legacy `NEXT_PUBLIC_USDCX_ADDRESS`) if the explorer lists a newer token.

### Local setup

1. Copy [`.env.example`](.env.example) to `.env.local` and fill in values from the [Privy](https://dashboard.privy.io/), [Supabase](https://supabase.com/dashboard), and [Daily](https://dashboard.daily.co/) dashboards.
2. In Supabase → **SQL** → New query, run migrations **in order**:
   - [supabase/migrations/20260512000000_init_profiles.sql](supabase/migrations/20260512000000_init_profiles.sql)
   - [supabase/migrations/20260512000001_sprint2_streams_sessions.sql](supabase/migrations/20260512000001_sprint2_streams_sessions.sql)  
   If `alter publication … add table` errors because the table is already in the publication, skip that `DO` block line for that table.
3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), log in, confirm **Supabase** shows `OK`, **Realtime** shows `connected`, then use the Sprint 2 panel with **two browsers** (two Privy users).

### Railway

1. New project → **Deploy from GitHub repo** (or CLI) pointing at this repository.
2. Set the same variables as in `.env.example` in the service **Variables** tab (including `PRIVY_APP_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `DAILY_API_KEY`, which must stay server-side).
3. Use the default **Nixpacks** build (`npm install`, `npm run build`) and start command `npm run start`. Set **Root directory** to the repo root if needed.

### Coinbase Developer Platform (CDP) — gas sponsorship

The app does not call CDP REST APIs directly yet. For **gasless** `createFlow` / `deleteFlow` from the embedded wallet, configure gas sponsorship in the **Privy dashboard** for **Base Sepolia** and fund Privy gas credits.

Optional server keys for later: `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` (see `.env.example`).

## Scripts

| Command         | Description            |
| --------------- | ---------------------- |
| `npm run dev`   | Dev server (Turbopack) |
| `npm run build` | Production build       |
| `npm run start` | Production server      |
| `npm run lint`  | ESLint                 |

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Privy + Next.js](https://docs.privy.io/guide/react/configuration/nextjs)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Daily REST API — Create room](https://docs.daily.co/reference/rest-api/rooms/create-room)
- [Superfluid CFA](https://docs.superfluid.finance/docs/protocol/agreements/constant-flow-agreement-cfa)
