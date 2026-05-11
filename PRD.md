# Product Requirements Document (PRD)
**Project Name:** J.E.S.S.I.C.A. (Joint Eyesight Sharing System for Instant Camera Access) / The CELIS Protocol  
**Event:** ETHMexico 2026  
**Type:** Web3 PWA (Progressive Web App) / DePIN  

## 1. Executive Summary
J.E.S.S.I.C.A. is a DePIN protocol and two-sided marketplace that allows humans and autonomous AI agents to rent real-time visual data (vision) from individuals equipped with smartphones or AR smart glasses. 

Leveraging **Superfluid** for real-time streaming micro-payments on the **Base** L2 network, and the **x402 (Payment Required)** standard for programmatic agent access, the protocol creates a global "Gig Economy of Vision." Users can teleport anywhere in the world—from a concert in Mexico City to a street in India—while Fulfillers earn stablecoins seamlessly via Account Abstraction.

## 2. Target Personas
1. **The Fulfiller ("The Eyes"):** Gig workers, concert-goers, or pedestrians. They want frictionless onboarding to earn USDC by sharing their live camera feed. They do not need prior Web3 knowledge.
2. **The Requester ("The Brain"):**
   - *Human:* A user wanting a remote view (e.g., front-row concert view, checking local weather/crowds).
   - *AI Agent:* Autonomous scripts (e.g., mapping bots, self-driving car algorithms) that programmatically pay for spatial/visual data via APIs.

## 3. Technical Stack
- **Frontend/Backend:** Next.js (App Router) configured as a PWA (Progressive Web App). Tailwind CSS for styling.
- **Blockchain Network:** Base L2 (Sepolia for Testnet, Mainnet for Prod).
- **Authentication & Smart Wallets:** Privy + Coinbase Developer Platform (CDP) for social login, Account Abstraction (ERC-4337), and gas sponsorship (Paymaster).
- **Video Streaming:** Daily.co (WebRTC) for ultra-low latency (<500ms) "Joint Eyesight" streaming.
- **Payments:** Superfluid Protocol (Streaming USDCx).
- **Database / Real-time:** Supabase (PostgreSQL) for active streams, users, and map data.
- **Mapping:** Leaflet.js / React-Leaflet.

## 4. Core Product Features & UX Flows

### 4.1. Frictionless Onboarding (The "Gig Economy" Flow)
- Users log in via Email, Google, or Phone Number using Privy.
- A smart contract wallet is generated in the background. Gas fees are sponsored by CDP.
- **UX Abstraction:** Fulfillers only see "USDC" balances in the UI. The app handles wrapping/unwrapping USDCx for Superfluid streams automatically.

### 4.2. Social & Discovery Layer
- **The "Reels" Feed:** A vertical, snap-scroll feed showing 10-second low-res looping "Teasers" of active public streams. Users can tap "Join Live" to upgrade to HD via payment.
- **Interactive Global Map:** Real-time map (Leaflet) displaying active "Eyes" (blue dots) and open "Bounties" (yellow pulses) globally.
- **Bounty Marketplace:** Requesters pin a coordinate, set a price, and duration. Fulfillers in the geofenced area receive a push notification to claim the bounty.

### 4.3. The Payment Engine (Superfluid + x402)
- **The x402 Handshake:** AI Agents hit the API, receive an `HTTP 402 Payment Required` response with Superfluid flow instructions.
- **The Taxi Meter Logic:**
  1. Requester creates a Superfluid flow (`createFlow`) of USDCx to the Fulfiller.
  2. Backend verifies active flow via the Superfluid subgraph.
  3. HTTP 402 challenge passes; WebRTC URL is returned to the AI/Human.
  4. Video streams. Money streams simultaneously frame-by-frame.
  5. If stream disconnects (or buyer cancels), backend triggers `deleteFlow`.

## 5. Security & Anti-Spoofing (Oracle Verifications)
- **Device Attestation:** Mobile PWA fetches accelerometer/gyroscope data to ensure the feed is live and not a screen recording.
- **AI "Proof of Sight":** Backend utilizes Gemini 1.5 Pro / GPT-4o Vision API to periodically sample video frames against the requested prompt (e.g., "Is this actually a live view of the Zócalo at sunset?"). If AI detects a spoof, the flow is terminated.
- **Reporting:** 3 community reports on a Fulfiller's stream results in an automatic wallet blacklist.

## 6. Database Schema (Supabase)

**Table: `profiles`**
- `id` (uuid, PK)
- `wallet_address` (string)
- `reputation_score` (int)

**Table: `streams`**
- `id` (uuid, PK)
- `creator_id` (uuid, FK -> profiles)
- `lat` (float)
- `lng` (float)
- `is_public` (boolean)
- `daily_room_url` (string)
- `status` (enum: live, ended)
- `created_at` (timestamp)

**Table: `bounties`**
- `id` (uuid, PK)
- `requester_id` (uuid, FK -> profiles)
- `lat` (float)
- `lng` (float)
- `reward_per_minute` (float)
- `prompt_description` (string)
- `status` (enum: open, active, closed)

## 7. Implementation Sprints for Hackathon
- **Sprint 1 (Infrastructure):** Setup Next.js PWA, Supabase connection, and Privy + CDP login.
- **Sprint 2 (The Core Loop):** Integrate Daily.co WebRTC rooms and Superfluid flow creation/deletion. 
- **Sprint 3 (Discovery):** Build the Leaflet Map and the Geofenced Bounty posting logic.
- **Sprint 4 (The Polish):** The vertical "Reels" feed, x402 API endpoints for AI scripts, and UI polish.