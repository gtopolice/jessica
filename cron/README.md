# Reconcile cron service

A 1-second curl wrapped in a Railway scheduled service. It calls the main
`jessica` web service's `POST /api/sessions/reconcile` endpoint every 5 minutes
(the lowest interval Railway permits — see
[Cron Jobs](https://docs.railway.com/reference/cron-jobs)).

## What it does

The reconcile endpoint ends `active` sessions whose `last_heartbeat_at` is older
than the staleness threshold (`STALE_AFTER_SECONDS = 360` in
[`app/api/sessions/reconcile/route.ts`](../app/api/sessions/reconcile/route.ts)).
This catches the "user closed the tab without clicking End" case so we don't
leave sessions stuck in `active`. The on-chain Superfluid flow is **not**
auto-deleted (no custodial signer) — the next participant to click End signs
`deleteFlow` via the existing cleanup branch in `/api/sessions/[id]/end`.

## Configuration

The service is configured entirely via [`railway.json`](./railway.json):

- `startCommand` — invokes `curl` against `$APP_URL/api/sessions/reconcile` with
  a Bearer header reading `$SCHEDULED_TASK_SECRET`.
- `cronSchedule: "*/5 * * * *"` — every 5 minutes (UTC).
- `restartPolicyType: "NEVER"` — cron services must exit; we don't want Railway
  restarting a failed curl forever.

## Required Railway variables (on the cron service)

| Name | Value |
| ---- | ----- |
| `SCHEDULED_TASK_SECRET` | Same value as on the `jessica` web service. |
| `APP_URL` | Public URL of the web service (`https://jessica-production-….up.railway.app`). |

## Deploying

`railway up` uploads the git context (the whole repo root, ignoring `.gitignore`) — so deploying *directly* from this folder pulls in the Next.js app and triggers Railpack instead of our Dockerfile. To get a clean upload of just these files, deploy from a copy outside the git tree:

```bash
STAGE=$(mktemp -d)
cp cron/Dockerfile cron/railway.json "$STAGE/"
(cd "$STAGE" \
  && railway link \
       --project 507a9c65-f7d5-4700-a9c6-d989fff1a58d \
       --environment production \
       --service jessica-reconcile-cron \
  && railway up --ci)
```

The build snapshot should be only a few hundred bytes and the build log should
show `[1/2] FROM docker.io/library/alpine:3.20` (not Railpack / Next.js).
