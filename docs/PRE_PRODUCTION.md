# Pre-production backlog

Non-blocking issues to fix before production. Add items when ready.

---

## Notes (addressed in development)

- **Profile sync vs embedded wallet (Chrome console):** Previously the app called `POST /api/profile/sync` as soon as Privy reported `authenticated`, before the embedded Ethereum wallet existed, so the server returned **400** (“No Ethereum wallet…”) and DevTools logged several failed requests. **Fix:** wait until `user.linkedAccounts` exposes an Ethereum address (or smart wallet), then sync once; show “Creating embedded wallet…” in the UI until then (`components/home-client.tsx`).

