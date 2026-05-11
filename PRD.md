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

**Table: `streams`**
- `id` (uuid, PK)
- `creator_id` (uuid, FK -> profiles, nullable for free public cams)
- `node_type` (enum: human, onvif_cam, public_cam)
- `lat` / `lng` (float)
- `is_public` (boolean)
- `daily_room_url` (string)
- `teaser_url` (string -> Cloudflare R2 link)
- `status` (enum: live, ended)
- `created_at` (timestamp)

**Table: `bounties`**
- `id` (uuid, PK)
- `requester_id` (uuid, FK -> profiles)
- `reward_per_minute` (float)
- `lat` / `lng` (float)
- `prompt_description` (text)
- `status` (enum: open, active, closed)

## 8. Implementation Sprints
- **Sprint 1 (Scaffold):** Next.js on Railway, Supabase Realtime setup, Privy/CDP integration.
- **Sprint 2 (Payment & Video):** Daily.co WebRTC rooms + Superfluid Flow management logic (create/delete). 
- **Sprint 3 (Discovery & Media):** Leaflet Map + Cloudflare R2 upload pipeline for Reels.
- **Sprint 4 (Advanced):** x402 AI Agent endpoints, TensorFlow.js privacy prototype, and final UI polish for the demo.