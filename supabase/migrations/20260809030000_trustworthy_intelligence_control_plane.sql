-- NRS trustworthy intelligence control plane
--
-- This migration is deliberately additive. It records what a Director run
-- actually checked, makes Canva connection state durable, and gives memory
-- maintenance a resumable cursor. It does not rewrite OAuth credentials,
-- existing memories, outputs, posts, or approvals.

-- ---------------------------------------------------------------------------
-- 1. Director execution evidence
-- ---------------------------------------------------------------------------

create table if not exists public.director_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  channel text not null check (channel in ('web', 'mcp', 'telegram', 'mini_app', 'internal')),
  status text not null default 'running' check (status in ('running', 'completed', 'partial', 'blocked', 'failed')),
  claim_status text not null default 'not_applicable' check (claim_status in ('not_applicable', 'verified', 'limited', 'blocked')),
  request_summary text not null,
  idempotency_key text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_director_runs_idempotency
  on public.director_runs (user_id, brand_id, channel, idempotency_key)
  where idempotency_key is not null;
create index if not exists idx_director_runs_brand_created
  on public.director_runs (brand_id, created_at desc);
create index if not exists idx_director_runs_status_created
  on public.director_runs (status, created_at desc);

create table if not exists public.director_evidence (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.director_runs(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  capability text not null,
  source_kind text not null check (source_kind in ('specialist_tool', 'product_catalogue', 'regulatory_corpus', 'canva', 'gbrain', 'website', 'media', 'other')),
  status text not null check (status in ('verified', 'unavailable', 'stale', 'blocked', 'missing')),
  agent_type text,
  model text,
  tools_used text[] not null default '{}',
  citations jsonb not null default '[]'::jsonb,
  summary text not null default '',
  diagnostic_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_director_evidence_run_created
  on public.director_evidence (run_id, created_at);
create index if not exists idx_director_evidence_brand_status_created
  on public.director_evidence (brand_id, status, created_at desc);

-- Evidence is append-only for normal users. The service role writes it while
-- executing a run; no client UPDATE or DELETE policy exists.
alter table public.director_runs enable row level security;
alter table public.director_evidence enable row level security;

create policy "director_runs_select" on public.director_runs
  for select using (public.can_access_brand(brand_id));
create policy "director_runs_insert" on public.director_runs
  for insert with check (public.can_write_for_owner(user_id) and public.can_access_brand(brand_id));
create policy "director_runs_update" on public.director_runs
  for update using (public.can_write_for_owner(user_id) and public.can_access_brand(brand_id))
  with check (public.can_write_for_owner(user_id) and public.can_access_brand(brand_id));
create policy "service manages director runs" on public.director_runs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "director_evidence_select" on public.director_evidence
  for select using (public.can_access_brand(brand_id));
create policy "director_evidence_insert" on public.director_evidence
  for insert with check (public.can_write_for_owner(user_id) and public.can_access_brand(brand_id));
create policy "service manages director evidence" on public.director_evidence
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop trigger if exists director_runs_updated_at on public.director_runs;
create trigger director_runs_updated_at
  before update on public.director_runs
  for each row execute function public.update_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Durable Canva health and single refresh lease
-- ---------------------------------------------------------------------------

alter table public.user_integrations
  add column if not exists last_verified_at timestamptz,
  add column if not exists last_refresh_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_at timestamptz,
  add column if not exists refresh_lease_id uuid,
  add column if not exists refresh_lease_until timestamptz,
  add column if not exists refresh_version integer not null default 0;

create index if not exists idx_user_integrations_provider_health
  on public.user_integrations (provider, last_verified_at desc)
  where is_active = true;

create table if not exists public.connection_health_events (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.user_integrations(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  provider integration_provider not null,
  state text not null check (state in ('ready', 'not_connected', 'expired', 'unavailable')),
  error_code text,
  detail jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists idx_connection_health_events_user_provider_checked
  on public.connection_health_events (user_id, provider, checked_at desc);

alter table public.connection_health_events enable row level security;
create policy "connection_health_events_select" on public.connection_health_events
  for select using (public.is_owner_or_team_member(user_id));
create policy "connection_health_events_insert" on public.connection_health_events
  for insert with check (public.can_write_for_owner(user_id));
create policy "service manages connection health events" on public.connection_health_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. Resumable, non-destructive memory maintenance state
-- ---------------------------------------------------------------------------

create table if not exists public.memory_maintenance_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('embedding_backfill', 'consolidation')),
  status text not null default 'running' check (status in ('running', 'completed', 'partial', 'failed')),
  cursor jsonb not null default '{}'::jsonb,
  statistics jsonb not null default '{}'::jsonb,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_memory_maintenance_runs_job_status_created
  on public.memory_maintenance_runs (job_type, status, created_at desc);

alter table public.memory_maintenance_runs enable row level security;
create policy "service manages memory maintenance" on public.memory_maintenance_runs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop trigger if exists memory_maintenance_runs_updated_at on public.memory_maintenance_runs;
create trigger memory_maintenance_runs_updated_at
  before update on public.memory_maintenance_runs
  for each row execute function public.update_updated_at();

-- Rollback plan:
--   1. Disable the new application feature flags first. Existing runtime paths
--      do not depend on these fields until the deployment that uses them.
--   2. Preserve director_evidence, director_runs, health events and maintenance
--      rows for audit. Do not delete them as part of rollback.
--   3. If a schema rollback is ever required, drop only the additive indexes,
--      policies, triggers and tables above in a separately reviewed migration.
--      Do not remove the user_integrations columns while a deployed build may
--      still query them.
