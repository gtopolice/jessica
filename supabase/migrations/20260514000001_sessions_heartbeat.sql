-- Sprint 2 hardening: client heartbeat for disconnect / abandoned-tab detection.
-- The Sprint 2 UI pings POST /api/sessions/[id]/heartbeat on an interval and on
-- `beforeunload`/`pagehide` (via fetch keepalive). The reconcile cron route then
-- ends active sessions whose `last_heartbeat_at` is older than the threshold.

alter table public.sessions
  add column if not exists last_heartbeat_at timestamptz;

create index if not exists sessions_last_heartbeat_at_idx
  on public.sessions (last_heartbeat_at);

create index if not exists sessions_status_heartbeat_idx
  on public.sessions (status, last_heartbeat_at);
