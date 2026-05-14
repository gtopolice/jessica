-- Sprint 2 hardening: record on-chain confirmation that the Superfluid stream stopped.
-- `ended_at` is set when the DB session ends; `ended_on_chain_at` is set only after the
-- corresponding `deleteFlow` transaction confirms and CFA `getFlow` reports flowRate=0.

alter table public.sessions
  add column if not exists ended_on_chain_at timestamptz,
  add column if not exists ended_on_chain_tx_hash text;

create index if not exists sessions_ended_on_chain_at_idx
  on public.sessions (ended_on_chain_at);
