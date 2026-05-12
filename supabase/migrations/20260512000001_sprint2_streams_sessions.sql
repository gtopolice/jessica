-- Sprint 2: streams (Daily room) + sessions (Superfluid flow gate).

create table if not exists public.streams (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  node_type text not null default 'human' check (node_type in ('human', 'onvif_cam', 'public_cam')),
  lat double precision,
  lng double precision,
  is_public boolean not null default false,
  daily_room_name text,
  daily_room_url text,
  livepeer_playback_url text,
  public_source_url text,
  teaser_url text,
  listed_rate_per_minute numeric,
  status text not null default 'live' check (status in ('live', 'ended')),
  created_at timestamptz not null default now()
);

create index if not exists streams_creator_id_idx on public.streams (creator_id);
create index if not exists streams_status_idx on public.streams (status);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  superfluid_flow_rate numeric not null,
  chain_id integer not null,
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'ended', 'disputed')),
  started_at timestamptz,
  ended_at timestamptz,
  bounty_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists sessions_stream_id_idx on public.sessions (stream_id);
create index if not exists sessions_requester_id_idx on public.sessions (requester_id);

alter table public.streams enable row level security;
alter table public.sessions enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'streams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.streams;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;
END $$;
