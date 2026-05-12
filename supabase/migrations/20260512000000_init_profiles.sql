-- Sprint 1: profiles + Realtime publication (map sync uses this in later sprints).
-- Run in Supabase SQL Editor or via Supabase CLI: supabase db push

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  privy_user_id text unique not null,
  wallet_address text not null,
  reputation_score int not null default 0,
  blacklisted_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index if not exists profiles_wallet_address_idx on public.profiles (wallet_address);

alter table public.profiles enable row level security;

-- No policies for `anon` / `authenticated`: REST and Realtime row changes stay closed until
-- you add Supabase third-party JWT or scoped policies. Server routes use the service role.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
