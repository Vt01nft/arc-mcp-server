-- Arc Job Board — Supabase schema
-- Run this in the Supabase SQL editor to initialize the database.

-- Jobs: off-chain metadata for on-chain ERC-8183 jobs
create table if not exists jobs (
  id             uuid primary key default gen_random_uuid(),
  chain_job_id   bigint not null unique,      -- on-chain job ID from ERC-8183
  description    text not null,               -- full human-readable description
  category       text not null default 'General',
  client_address text not null,               -- checksummed 0x address
  provider_address text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists jobs_chain_job_id_idx on jobs (chain_job_id);
create index if not exists jobs_client_address_idx on jobs (client_address);
create index if not exists jobs_category_idx on jobs (category);

-- Evaluations: Gemini evaluation results per job
create table if not exists evaluations (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references jobs (id) on delete cascade,
  chain_job_id   bigint not null,
  decision       text not null check (decision in ('approve', 'reject')),
  reasoning      text not null,
  confidence     numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  evaluated_at   timestamptz not null default now(),
  evaluator      text not null default 'claude-sonnet-4-6'
);

create index if not exists evaluations_job_id_idx on evaluations (job_id);
create index if not exists evaluations_chain_job_id_idx on evaluations (chain_job_id);

-- Deliverables: IPFS content + preview for submitted work
create table if not exists deliverables (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references jobs (id) on delete cascade,
  chain_job_id    bigint not null,
  ipfs_cid        text,                        -- IPFS CID if content is on IPFS
  deliverable_hash text not null,              -- the bytes32 hash stored on-chain
  content_preview text,                        -- first 500 chars of deliverable
  submitted_at    timestamptz not null default now()
);

create index if not exists deliverables_job_id_idx on deliverables (job_id);
create index if not exists deliverables_chain_job_id_idx on deliverables (chain_job_id);

-- Auto-update updated_at on jobs
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists jobs_updated_at on jobs;
create trigger jobs_updated_at
  before update on jobs
  for each row execute function update_updated_at();

-- Row-level security: public read, authenticated write
alter table jobs enable row level security;
alter table evaluations enable row level security;
alter table deliverables enable row level security;

create policy "Public read jobs" on jobs for select using (true);
create policy "Service role write jobs" on jobs for insert with check (true);
create policy "Service role update jobs" on jobs for update using (true);

create policy "Public read evaluations" on evaluations for select using (true);
create policy "Service role write evaluations" on evaluations for insert with check (true);

create policy "Public read deliverables" on deliverables for select using (true);
create policy "Service role write deliverables" on deliverables for insert with check (true);
