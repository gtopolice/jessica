# Product Requirements Document (PRD): Project J.E.S.S.I.C.A.
**Full Name:** Joint Eyesight Sharing System for Instant Camera Access 
**Event:** ETHMexico 2026  
**Type:** Web3 PWA / DePIN / Agentic Commerce  

## 1. Executive Summary
J.E.S.S.I.C.A. is a DePIN protocol and two-sided marketplace that allows humans and autonomous AI agents to rent real-time visual data from individuals equipped with smartphones, AR smart glasses, or ONVIF-compatible IP security cameras. 

Leveraging **Superfluid** for real-time streaming micro-payments on **Base**, and the **x402 (Payment Required)** standard for programmatic agent access, the protocol creates a "Universe of Vision." It enables a global gig economy where users earn stablecoins for sharing their perspective, while requesters (Human or AI) can "teleport" anywhere instantly.

## 2. Target Personas
1. **The Fulfiller ("The Eyes"):** 
   - *Roving Nodes:* Mobile PWA users/concert-goers who earn USDC by sharing their view.
   - *Static Nodes:* Owners of ONVIF-compliant IP cameras (e.g., Axis) who provide 24/7 passive vision for yield.
2. **The Requester ("The Brain"):**
   - *Human:* Consumers seeking specific views (concerts, travel spots, remote checking).
   - *AI Agent:* Autonomous scripts that programmatically purchase visual data via x402 to "see" the physical world.

## 3. Technical Stack
- **Hosting:** Railway (Next.js App Router + Node.js background workers).
- **Database & Real-time:** Supabase (PostgreSQL + Realtime for live map syncing).
- **Object Storage:** Cloudflare R2 (S3-compatible, zero-egress storage for "Reels" teaser clips).
- **Blockchain Network:** Base L2 (Sepolia/Mainnet).
- **Auth & Smart Wallets:** Privy + Coinbase Developer Platform (CDP) for social login and gasless Account Abstraction.
- **Video Engine:** Daily.co (WebRTC) for Human nodes; Livepeer Ingress for ONVIF RTSP-to-WebRTC translation.
- **Payments:** Superfluid Protocol (Streaming USDCx).
- **Mapping:** Leaflet.js / React-Leaflet.

## 4. Core Product Features & UX Flows

### 4.1. Frictionless Onboarding (The "Gig Economy" Flow)
- One-tap login via Privy (Email/Google/Social).
- Automated Smart Account creation via CDP.
- **UX Abstraction:** Fulfillers see $USDC; background logic handles wrapping/unwrapping USDCx for streams.

### 4.2. Social & Discovery Layer
- **The "Reels" Feed:** Vertical snap-scroll feed showing 10s low-res looping teasers (stored on Cloudflare R2). 
- **Interactive Global Map:** Real-time Leaflet map showing:
  - *Grey Dots:* Free public webcams (Cold-start population via curated feeds).
  - *Blue Dots:* Active Human Nodes (Smartphones/Glasses).
  - *Green Dots:* Active Static ONVIF Nodes (Security Cameras).
  - *Yellow Pulses:* Open Bounties.
- **Bounty Marketplace:** Requesters pin coordinates, set reward-per-minute, and wait for a geofenced Fulfiller to accept.

### 4.3. The Payment Engine (Superfluid + x402)
- **The x402 Handshake:** AI Agents hit the API -> Receive 402 Error -> Initiate Superfluid Flow -> Unlock Stream.
- **Taxi Meter Logic:** 
  1. Requester creates a Superfluid `createFlow` of USDCx.
  2. Backend verifies flow status via subgraph/RPC.
  3. WebRTC stream initiates. Money flows per-second.
  4. Disconnect/Cancel triggers `deleteFlow` via webhook or heartbeat.

## 5. Privacy & Consent (The "Ethical Vision" Layer)
- **Edge AI Anonymization:** Mobile PWA uses **TensorFlow.js** locally to detect and blur faces/license plates *before* transmission.
- **Static Node Privacy Zones:** ONVIF owners must configure static "Privacy Masks" (blackout zones) for private property/windows.
- **Explicit Consent:** Camera never auto-starts. Fulfillers must manually "Accept & Share" each session.

## 6. Security & Anti-Spoofing (Oracle Verifications)
- **Device Attestation:** PWA cross-references camera feed with accelerometer/gyroscope/GPS data to ensure physical presence.
- **AI "Proof of Sight":** Backend uses Gemini 1.5 Pro Vision to sample frames and verify they match the requested location/description.
- **Reputation:** 3 community reports = Wallet/Device blacklist.

## 7. Database Schema (Supabase)

**Table: `profiles`**
- `id` (uuid, PK), `wallet_address` (string), `reputation_score` (int)
- `blacklisted_at` (timestamp, nullable) — set when abuse threshold is hit; blocks new sessions

**Table: `streams`**
- `id` (uuid, PK)
- `creator_id` (uuid, FK -> profiles, nullable for free public cams)
- `node_type` (enum: human, onvif_cam, public_cam)
- `lat` / `lng` (float)
- `is_public` (boolean)
- `daily_room_url` (string, nullable) — Human path (Daily.co)
- `livepeer_playback_url` (string, nullable) — Static ONVIF path after RTSP → WebRTC
- `public_source_url` (string, nullable) — Attribution / canonical source for curated public webcams
- `teaser_url` (string -> Cloudflare R2 link)
- `listed_rate_per_minute` (numeric, nullable) — Optional advertised price for map tap-to-watch (human/premium nodes)
- `status` (enum: live, ended)
- `created_at` (timestamp)

**Table: `bounties`**
- `id` (uuid, PK)
- `requester_id` (uuid, FK -> profiles)
- `reward_per_minute` (float)
- `lat` / `lng` (float)
- `radius_meters` (float) — geofence for matching / notifications
- `expires_at` (timestamp)
- `fulfiller_id` (uuid, FK -> profiles, nullable until claimed)
- `claimed_stream_id` (uuid, FK -> streams, nullable) — stream opened for this bounty
- `prompt_description` (text)
- `status` (enum: open, active, fulfilled, expired, cancelled)

**Table: `sessions`**
- `id` (uuid, PK)
- `stream_id` (uuid, FK -> streams)
- `requester_id` (uuid, FK -> profiles)
- `superfluid_flow_rate` (numeric) — USDCx per second or per month token-native rate (store whichever subgraph expects)
- `chain_id` (int) — e.g. Base Sepolia / Base mainnet
- `status` (enum: pending_payment, active, ended, disputed)
- `started_at` / `ended_at` (timestamp, nullable)
- Optional `bounty_id` (uuid, FK -> bounties, nullable) — bounty-driven sessions

**Table: `reports`**
- `id` (uuid, PK)
- `stream_id` (uuid, FK -> streams)
- `reporter_id` (uuid, FK -> profiles)
- `reason` (text, short)
- `created_at` (timestamp)

## 8. Product Clarifications (implementation-ready)

### 8.1. Hackathon scope & success criteria
- **Demo bar:** End-to-end path for one **Human** stream: login → go live on map → second wallet/device joins → Superfluid flow verified → Daily WebRTC video. Secondary: one **bounty** posted → accepted inside geofence → paid session.
- **Explicit non-goals (v0):** Production-grade device attestation, legal review of every public cam source, full appeals workflow for bans, multi-region HA, native mobile apps (PWA only).
- **Stretch (Sprint 4):** x402-only agent client hitting the same unlock API as humans, ONVIF → Livepeer path smoke-tested.

### 8.2. Video & session model (one product surface)
- **Human nodes:** Create/join via `daily_room_url`. Teaser clip upload to R2 unchanged.
- **ONVIF static nodes:** Ingest via Livepeer; store resulting **viewer** URL in `livepeer_playback_url`. UI “Watch” resolves `daily_room_url` **or** `livepeer_playback_url` based on `node_type` (never both required).
- **Public (grey) nodes:** Read-only embed or HLS/WebRTC URL in `public_source_url`; **no** on-chain payment in hackathon unless explicitly enabled later. Cold-start feeds must be **curated** with stored attribution for judges / compliance story.
- **Unified API:** `POST /sessions` (human app) or x402-gated `POST /sessions` (agent) returns `{ playback_url, session_id }` after payment gate passes.

### 8.3. Bounty lifecycle (state machine)
1. **open** — Requester sets `lat`, `lng`, `radius_meters`, `reward_per_minute`, `expires_at`, `prompt_description`. Map shows yellow pulse; eligible fulfillers in radius may get **in-app** or **push** notification (platform-dependent; document as best-effort on PWA).
2. **active** — A fulfiller accepts; set `fulfiller_id`, bind `claimed_stream_id`, start Superfluid flow from requester to fulfiller at agreed rate.
3. **fulfilled** — Bounty objective met or requester ends session; `deleteFlow`; terminal.
4. **expired** / **cancelled** — No taker by `expires_at`, or requester cancels before claim; terminal.

### 8.4. Pricing & who pays gas
- **Bounties:** Price is `reward_per_minute` (requester-defined floor for that task).
- **Ad-hoc map streams:** Optional `listed_rate_per_minute` on `streams`; if null, UI shows “Ask” or uses protocol default constant for demo only.
- **Gas:** CDP Paymaster sponsors **user-facing** txs where possible (wrap/unwrap, flow ops initiated from app). Document **operator** wallet for subgraph/indexer or server-side watchers separately in runbooks (not end-user).

### 8.5. x402 response sketch (agent path)
- Protected resource: e.g. `POST /v1/sessions` with body `{ stream_id, requested_duration_sec }`.
- **402 body** includes machine-readable payment requirements: `chainId`, **Superfluid** `token` (USDCx), `receiver`, `flowRatePerSecond` (or agreed encoding), `session_id` or `nonce` for idempotency, and `callback_url` or poll URL for confirmation.
- Agent creates on-chain flow → **polls** `GET /v1/sessions/:id/payment` until backend sees active flow via subgraph/RPC → returns `200` + `playback_url`.
- Humans use the **same** session + verification logic from the signed-in app (no 402), unless you intentionally demo agent-only 402 for judging.

### 8.6. Abuse, Proof of Sight, compliance (v0 stance)
- **Reports:** Append-only `reports`; nightly or realtime job sets `blacklisted_at` on `profiles` when **≥3** distinct reporters on streams tied to that wallet (tune threshold in config). **No appeals UI** in v0; document manual unban for organizers.
- **Proof of Sight:** Sample every **N** seconds (config); on **mismatch** reduce score / end session / flag — avoid hard ban on single frame false positive.
- **Device attestation (PWA):** Treat as **best-effort** signal only for demo (sensor correlation); do not claim hardware attestation without Web APIs that support it.
- **Teasers on R2:** Short **TTL** or periodic purge job; no long-term retention promise in UI copy.
- **Recording:** Default **off**; if ever enabled, explicit toggle + separate consent string (out of scope for hackathon unless built).

## 9. Implementation Sprints
- **Sprint 1 (Scaffold):** Next.js on Railway, Supabase Realtime setup, Privy/CDP integration.
- **Sprint 2 (Payment & Video):** Daily.co WebRTC rooms + Superfluid Flow management logic (create/delete). 
- **Sprint 3 (Discovery & Media):** Leaflet Map + Cloudflare R2 upload pipeline for Reels.
- **Sprint 4 (Advanced):** x402 AI Agent endpoints, TensorFlow.js privacy prototype, and final UI polish for the demo.