-- Arc Analytics — Supabase Schema
-- Run in Supabase project SQL editor

-- ── Event cache ─────────────────────────────────────────────────────────────────
-- Stores synced ERC-8183 events from Arc Testnet for fast analytics queries.
create table if not exists event_cache (
  id           bigserial primary key,
  block_number integer      not null,
  tx_hash      text         not null,
  event_name   text         not null,
  job_id       integer,
  amount_raw   text,          -- raw bigint string (18-decimal native USDC)
  from_address text,
  to_address   text,
  logged_at    timestamptz  not null default now(),

  unique (tx_hash, event_name)  -- prevent duplicate upserts
);

create index if not exists idx_event_cache_block   on event_cache (block_number desc);
create index if not exists idx_event_cache_event   on event_cache (event_name);
create index if not exists idx_event_cache_job_id  on event_cache (job_id);
create index if not exists idx_event_cache_logged  on event_cache (logged_at desc);

-- ── Narration history ────────────────────────────────────────────────────────────
-- Stores Claude-generated narrations for historical reference.
create table if not exists narrations (
  id           bigserial primary key,
  headline     text        not null,
  summary      text        not null,
  trend        text        not null check (trend in ('up', 'down', 'neutral')),
  stats_json   jsonb,        -- snapshot of stats at time of narration
  generated_at timestamptz not null default now()
);

-- ── Row Level Security ───────────────────────────────────────────────────────────
alter table event_cache  enable row level security;
alter table narrations   enable row level security;

-- Public read access
create policy "public read event_cache"  on event_cache  for select using (true);
create policy "public read narrations"   on narrations   for select using (true);

-- Service role write access (used by /api/sync and /api/narrate)
create policy "service insert event_cache"  on event_cache  for insert with check (true);
create policy "service upsert event_cache"  on event_cache  for update with check (true);
create policy "service insert narrations"   on narrations   for insert with check (true);
