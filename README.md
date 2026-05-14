# J.E.S.S.I.C.A.

Next.js app for **J.E.S.S.I.C.A.** (Joint Eyesight Sharing System for Instant Camera Access). Product requirements live in [docs/PRD.md](docs/PRD.md).

## Sprint 1 — scaffold

- **Next.js** on the [App Router](https://nextjs.org/docs/app), ready to deploy on [Railway](https://railway.app/) (`npm run build` / `npm run start`).
- **Supabase:** PostgreSQL + Realtime. Run SQL migrations in the Supabase SQL Editor (or via CLI).
- **Privy:** login and embedded Ethereum wallets (Base / Base Sepolia).
- **Profile sync:** `POST /api/profile/sync` verifies the Privy access token and upserts `profiles` with the **service role** key (server only).

## Sprint 2 — Daily + Superfluid

- **Daily.co:** `POST /api/streams` creates a room (default **`privacy: private`**; optional `DAILY_ROOM_PRIVACY=public` for local tests without tokens). The app mints [meeting tokens](https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token) via **`POST /api/streams/[id]/meeting-token`**: the **fulfiller** (stream creator) and an **active** session **requester** get a short-lived `?t=` URL for the Prebuilt iframe — aligned with controlled access in [docs/PRD.md](docs/PRD.md).
- **Superfluid (Base Sepolia):** `POST /api/sessions` opens a `sessions` row and returns **CFAv1Forwarder** `createFlow` calldata for the **requester** to stream **fUSDCx** (Superfluid Super Token over faucet **fUSDC**) to the **fulfiller**. `POST /api/sessions/[id]/verify` reads the on-chain flow via the **CFA** contract; if the rate is sufficient it sets the session **active** and returns the Daily URL (HTTP **402** if no flow yet — same spirit as x402 gating). The Sprint 2 UI passes an explicit **`gasLimit`** to Privy’s `sendTransaction` (with `eth_estimateGas` plus headroom, or a safe fallback) so embedded wallets do not sign with an empty limit (**“intrinsic gas too low”**).
- **End session (either party):** `POST /api/sessions/[id]/end` is callable by the **fulfiller** or the **requester**. The route reads the on-chain `flowRate` and returns **`deleteFlow`** calldata for whoever clicked End when a stream is still live (Superfluid CFA accepts `deleteFlow` from sender **or** receiver). The route is **idempotent**: clicking End again returns the same cleanup tx (`cleanupOnly: true`) until `getFlow` reports `0`.
- **On-chain confirmation:** after `deleteFlow` is signed, the client posts the tx hash to `POST /api/sessions/[id]/confirm-end`. The server waits for the receipt, verifies success + that the call targeted the CFAv1Forwarder, re-reads `getFlow` to confirm `flowRate == 0`, then stamps `sessions.ended_on_chain_at` and `sessions.ended_on_chain_tx_hash`. Run [supabase/migrations/20260514000000_sessions_end_on_chain.sql](supabase/migrations/20260514000000_sessions_end_on_chain.sql) once to add those columns.
- **One-flow-per-pair pre-flight:** `POST /api/sessions` reads `getFlow(sender, receiver, fUSDCx)` before inserting. If a flow already exists (Superfluid CFA only allows one per pair+token), the route returns **HTTP 409** with `onChainFlowRate` so the UI can prompt End/cleanup instead of letting `createFlow` revert on-chain.
- **Heartbeat + reconcile cron (abandoned-tab safety):** the active session UI posts `POST /api/sessions/[id]/heartbeat` every 30 s and on `beforeunload`/`pagehide` (via `fetch` `keepalive`). A scheduled `POST /api/sessions/reconcile` ends sessions whose `last_heartbeat_at` is older than 360 s (guarded by `SCHEDULED_TASK_SECRET`). The cron service config lives in [`cron/`](cron/) and runs every 5 minutes (Railway's minimum). On-chain cleanup (`deleteFlow`) is signed by whichever participant returns next via the existing `/end` cleanup branch. Run [supabase/migrations/20260514000001_sessions_heartbeat.sql](supabase/migrations/20260514000001_sessions_heartbeat.sql) once to add the columns.
- **Wrap fUSDC ⇄ fUSDCx:** the wallet panel exposes a wrap widget (`approve` + `upgrade`) and an unwrap (`downgrade`) so users never have to leave the app to top up the streamable Super Token. Encoded in [lib/superfluid/super-token.ts](lib/superfluid/super-token.ts).
- **Smart-wallet send path:** all Superfluid txs go through [lib/hooks/use-superfluid-send.ts](lib/hooks/use-superfluid-send.ts). When the user has a Privy smart wallet (see [Coinbase Developer Platform](#coinbase-developer-platform-cdp--gas-sponsorship) below), txs are sent as gas-sponsored ERC-4337 UserOps via the dashboard-configured bundler + paymaster. Without a smart wallet, the hook falls back to the existing embedded EOA `useSendTransaction` flow with explicit `gasLimit`.
- **UI:** After profile sync succeeds, the home page shows a **Sprint 2** panel: two-browser demo (fulfiller creates stream; requester pastes `stream id`, signs `createFlow`, verifies, iframe).

### On-chain testnet assets

- Requester needs **fUSDCx** on Base Sepolia: mint **[fUSDC](https://sepolia.basescan.org/address/0x6b0dacea6a72e759243c99eaed840dee9564c194)** from the contract (if exposed), then wrap/upgrade to **[fUSDCx](https://sepolia.basescan.org/address/0x1650581f573ead727b92073b5ef8b4f5b94d1648)** via the [Superfluid Base Sepolia dashboard](https://explorer.superfluid.org/base-sepolia). If `createFlow` reverts, check fUSDCx balance and flow rules.
- Default **fUSDCx** address is in [lib/superfluid/base-sepolia.ts](lib/superfluid/base-sepolia.ts); override with `NEXT_PUBLIC_FUSDCX_ADDRESS` (or legacy `NEXT_PUBLIC_USDCX_ADDRESS`) if the explorer lists a newer token.

### Local setup

1. Copy [`.env.example`](.env.example) to `.env.local` and fill in values from the [Privy](https://dashboard.privy.io/), [Supabase](https://supabase.com/dashboard), and [Daily](https://dashboard.daily.co/) dashboards.
2. In Supabase → **SQL** → New query, run migrations **in order**:
   - [supabase/migrations/20260512000000_init_profiles.sql](supabase/migrations/20260512000000_init_profiles.sql)
   - [supabase/migrations/20260512000001_sprint2_streams_sessions.sql](supabase/migrations/20260512000001_sprint2_streams_sessions.sql)
   - [supabase/migrations/20260514000000_sessions_end_on_chain.sql](supabase/migrations/20260514000000_sessions_end_on_chain.sql)
   - [supabase/migrations/20260514000001_sessions_heartbeat.sql](supabase/migrations/20260514000001_sessions_heartbeat.sql)  
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

The app routes Superfluid (and wrap) transactions through `useSuperfluidSend`, which prefers a Privy **smart wallet** when one exists for the user and falls back to the embedded EOA otherwise. Enabling gasless `createFlow` / `deleteFlow` requires three things:

1. **Privy dashboard → Wallet infrastructure → Smart wallets**: enable smart wallets for the app and add a **Base Sepolia (84532)** network configuration. Set:
   - Smart account type: **Kernel** or **Safe** (either works with viem `permissionless`; Privy maps the choice).
   - **Bundler URL**: your CDP bundler endpoint for Base Sepolia.
   - **Paymaster URL**: your CDP paymaster endpoint for Base Sepolia (this is what actually sponsors gas).
2. **Coinbase Developer Platform**: provision a project for Base Sepolia, copy the bundler + paymaster URLs into Privy, and fund the paymaster (gas credits or USDC, per the CDP dashboard).
3. Re-login on the app — Privy provisions a smart account for the user on first login after smart wallets are enabled. Profile sync ([lib/privy/linked-ethereum-address.ts](lib/privy/linked-ethereum-address.ts)) already prefers the smart-wallet address over the EOA, so `createFlow`/`deleteFlow` calldata is automatically encoded with the smart account as `sender` and `useSuperfluidSend` submits via the smart-wallet client.

The fallback path (no smart wallet) is unchanged and still works with the embedded EOA. Optional server keys for later: `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` (see `.env.example`).

### Background reconcile job (heartbeat cleanup)

Set `SCHEDULED_TASK_SECRET` on the server and call the reconcile endpoint every 5 minutes (Railway's minimum cron interval):

```bash
curl -X POST -H "Authorization: Bearer $SCHEDULED_TASK_SECRET" \
  https://<app-host>/api/sessions/reconcile
```

This repo ships a ready-to-deploy Railway cron service in [`cron/`](cron/) (alpine + curl, `cronSchedule: */5 * * * *`). Add it once via `railway add --service jessica-reconcile-cron`, set `SCHEDULED_TASK_SECRET` + `APP_URL` on it, and deploy from a staged copy outside the git tree (see [cron/README.md](cron/README.md) for the exact commands — `railway up` from inside the repo uploads the whole project, which triggers Railpack on the Next.js app instead of our Dockerfile).

Without the cron, abandoned sessions still get cleaned up when a participant returns and clicks End — they just stay in `active` state until then.

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
