# J.E.S.S.I.C.A.

Next.js app for **J.E.S.S.I.C.A.** (Joint Eyesight Sharing System for Instant Camera Access). Product requirements live in [docs/PRD.md](docs/PRD.md).

## Sprint 1 (current)

- **Next.js** on the [App Router](https://nextjs.org/docs/app), ready to deploy on [Railway](https://railway.app/) (`npm run build` / `npm run start`).
- **Supabase:** PostgreSQL + Realtime. Run the SQL migration in the Supabase SQL Editor (or via CLI) to create `profiles` and attach it to Realtime.
- **Privy:** login and embedded Ethereum wallets (Base / Base Sepolia).
- **Profile sync:** `POST /api/profile/sync` verifies the Privy access token and upserts `profiles` with the **service role** key (server only).

### Local setup

1. Copy [`.env.example`](.env.example) to `.env.local` and fill in values from the [Privy](https://dashboard.privy.io/) and [Supabase](https://supabase.com/dashboard) dashboards.
2. In Supabase → **SQL** → New query, paste [supabase/migrations/20260512000000_init_profiles.sql](supabase/migrations/20260512000000_init_profiles.sql) and run it.  
   If `alter publication … add table` errors because the table is already in the publication, skip that line.
3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), log in, and confirm **Supabase** shows `OK` and **Supabase Realtime** shows `connected`.

### Railway

1. New project → **Deploy from GitHub repo** (or CLI) pointing at this repository.
2. Set the same variables as in `.env.example` in the service **Variables** tab (including `PRIVY_APP_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`, which must stay server-side).
3. Use the default **Nixpacks** build (`npm install`, `npm run build`) and start command `npm run start`. Set **Root directory** to the repo root if needed.

### Coinbase Developer Platform (CDP) — gas sponsorship

Sprint 1 does not call CDP APIs from code. To enable **gasless** transactions for embedded wallets, create a Paymaster / Bundler in the [CDP Portal](https://portal.cdp.coinbase.com/) and add the Paymaster policy URL (or equivalent) in the **Privy dashboard** under your app’s smart wallet / gas sponsorship settings for **Base Sepolia** (then Base mainnet for production).

Optional server keys for later sprints: `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET` (see `.env.example`).

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Dev server (Turbopack)   |
| `npm run build` | Production build        |
| `npm run start` | Production server       |
| `npm run lint` | ESLint                   |

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Privy + Next.js](https://docs.privy.io/guide/react/configuration/nextjs)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
