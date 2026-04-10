-- Phase 10a: Direct Publishing Infrastructure
-- OAuth token storage + publisher run logging + retry queue

create extension if not exists pgcrypto;

-- ── OAuth token storage ─────────────────────────────────────────────────────

create table if not exists social_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  platform text not null check (platform in ('facebook','instagram','linkedin','tiktok','youtube','twitter')),
  account_id text not null,
  account_name text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] default '{}'::text[],
  status text default 'active' check (status in ('active','expired','revoked','review_pending')),
  last_refreshed_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (brand_id, platform, account_id)
);

create index social_oauth_tokens_brand_platform_idx on social_oauth_tokens(brand_id, platform);

-- Trigger for updated_at
create trigger set_social_oauth_tokens_updated_at
  before update on social_oauth_tokens
  for each row execute function update_updated_at();

-- ── Publisher run log ───────────────────────────────────────────────────────

create table if not exists publisher_runs (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_id uuid not null references scheduled_posts(id) on delete cascade,
  platform text not null,
  publisher text not null check (publisher in ('native','mixpost')),
  status text not null check (status in ('pending','running','success','failed','rate_limited')),
  attempt int default 1,
  request_payload jsonb,
  response_payload jsonb,
  external_post_id text,
  external_permalink text,
  error text,
  duration_ms int,
  started_at timestamptz default now() not null,
  finished_at timestamptz
);

create index publisher_runs_post_idx on publisher_runs(scheduled_post_id, started_at desc);

-- ── Retry queue ─────────────────────────────────────────────────────────────

create table if not exists publisher_retry_queue (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_id uuid not null references scheduled_posts(id) on delete cascade,
  platform text not null,
  run_id uuid references publisher_runs(id) on delete cascade,
  next_attempt_at timestamptz not null,
  attempt int default 1,
  max_attempts int default 5,
  last_error text,
  created_at timestamptz default now() not null
);

create index publisher_retry_queue_next_attempt_idx
  on publisher_retry_queue(next_attempt_at) where next_attempt_at is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table social_oauth_tokens enable row level security;
alter table publisher_runs enable row level security;
alter table publisher_retry_queue enable row level security;

-- social_oauth_tokens — team members via existing RLS helpers
create policy "team members read tokens"
  on social_oauth_tokens for select
  using (can_access_brand(brand_id));

create policy "team members insert tokens"
  on social_oauth_tokens for insert
  with check (can_write_for_owner(brand_id));

create policy "team members update tokens"
  on social_oauth_tokens for update
  using (can_write_for_owner(brand_id));

create policy "team members delete tokens"
  on social_oauth_tokens for delete
  using (can_write_for_owner(brand_id));

-- publisher_runs — read-only for team members
create policy "team members read runs"
  on publisher_runs for select
  using (
    scheduled_post_id in (
      select id from scheduled_posts
      where brand_id in (select id from brands where can_access_brand(id))
    )
  );

-- publisher_retry_queue — read-only for team members
create policy "team members read retries"
  on publisher_retry_queue for select
  using (
    scheduled_post_id in (
      select id from scheduled_posts
      where brand_id in (select id from brands where can_access_brand(id))
    )
  );
