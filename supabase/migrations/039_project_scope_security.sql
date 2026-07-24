-- NRS central marketing control plane: project-isolated access, memory,
-- connectors, channels and audit evidence. Every record is project-bound.

begin;

-- ── Scoped API credentials ────────────────────────────────────────────────

alter table api_keys
  add column if not exists token_kind text not null default 'access',
  add column if not exists parent_key_id uuid references api_keys(id) on delete cascade,
  add column if not exists policy_version integer not null default 1,
  add column if not exists expires_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'api_keys_token_kind_check'
  ) then
    alter table api_keys add constraint api_keys_token_kind_check
      check (token_kind in ('access', 'refresh', 'personal'));
  end if;
end $$;

create index if not exists idx_api_keys_active_kind
  on api_keys (user_id, token_kind)
  where revoked_at is null;

-- OAuth authorization codes carry the selected project set through the PKCE
-- exchange. A code without a project set cannot mint an MCP access key.
alter table oauth_auth_codes
  add column if not exists project_ids uuid[] not null default '{}';

-- The old keys carried only an owner identity, not a project scope. They are
-- intentionally invalidated rather than silently inheriting access to every
-- project. New credentials are issued only with explicit project grants.
update api_keys
set revoked_at = now()
where revoked_at is null;

create table if not exists project_access_grants (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  channel text not null check (channel in ('web', 'mcp', 'telegram', 'internal')),
  capabilities text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (actor_user_id, brand_id, channel)
);

create index if not exists idx_project_access_grants_active
  on project_access_grants (actor_user_id, channel, brand_id)
  where status = 'active' and revoked_at is null;

create table if not exists api_key_project_grants (
  api_key_id uuid not null references api_keys(id) on delete cascade,
  project_access_grant_id uuid not null references project_access_grants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (api_key_id, project_access_grant_id)
);

create index if not exists idx_api_key_project_grants_key
  on api_key_project_grants (api_key_id);

-- Owner web grants provide an auditable baseline. MCP and Telegram grants are
-- created only when a scoped key or paired channel is created.
insert into project_access_grants (
  actor_user_id, brand_id, channel, capabilities, created_by
)
select
  b.user_id,
  b.id,
  'web',
  array['director:chat', 'draft:post', 'direct:read', 'direct:utility', 'publish:request'],
  b.user_id
from brands b
on conflict (actor_user_id, brand_id, channel) do nothing;

-- ── Explicit, directional project relationships ───────────────────────────

create table if not exists project_links (
  id uuid primary key default gen_random_uuid(),
  source_brand_id uuid not null references brands(id) on delete cascade,
  target_brand_id uuid not null references brands(id) on delete cascade,
  purpose text not null,
  allowed_data_classes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (source_brand_id <> target_brand_id),
  unique (source_brand_id, target_brand_id, purpose)
);

create index if not exists idx_project_links_target_active
  on project_links (target_brand_id, source_brand_id)
  where status = 'active' and revoked_at is null;

-- Approved initial flow: Downscale public marketing context may inform Do
-- Today. It is never a reverse link and never permits health/customer data.
insert into project_links (
  source_brand_id,
  target_brand_id,
  purpose,
  allowed_data_classes,
  approved_by
)
select
  downscale.id,
  do_today.id,
  'downscale-approved-public-marketing-context-for-do-today',
  array['approved_public_marketing_context', 'aggregate_marketing_analytics'],
  downscale.user_id
from brands downscale
join brands do_today on do_today.user_id = downscale.user_id
where lower(downscale.name) = 'downscale weight loss'
  and lower(do_today.name) = 'do today'
on conflict (source_brand_id, target_brand_id, purpose) do nothing;

-- ── First-party marketing connector contracts ─────────────────────────────

create table if not exists project_connectors (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  connector_type text not null,
  display_name text not null,
  endpoint_url text not null,
  credential_reference text not null,
  allowed_resources text[] not null default '{}',
  read_only boolean not null default true check (read_only),
  status text not null default 'disabled' check (status in ('disabled', 'active', 'error')),
  freshness_seconds integer not null default 86400 check (freshness_seconds > 0),
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, connector_type)
);

create index if not exists idx_project_connectors_brand_status
  on project_connectors (brand_id, status);

create trigger project_connectors_updated_at
  before update on project_connectors
  for each row execute function update_updated_at();

-- ── Telegram identity and explicit project session ─────────────────────────

create table if not exists telegram_accounts (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  telegram_user_id text not null,
  telegram_chat_id text not null,
  paired_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (telegram_user_id),
  unique (telegram_chat_id)
);

-- Pairing is deliberately one-time and project-scoped. Only a SHA-256 hash of
-- the short-lived code is stored, so a database read cannot be used to take
-- over the private control channel.
create table if not exists telegram_pair_codes (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  project_ids uuid[] not null check (cardinality(project_ids) > 0),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_pair_codes_valid
  on telegram_pair_codes (code_hash, expires_at)
  where used_at is null;

create table if not exists telegram_project_sessions (
  id uuid primary key default gen_random_uuid(),
  telegram_account_id uuid not null references telegram_accounts(id) on delete cascade,
  project_access_grant_id uuid not null references project_access_grants(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  selected_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'active' and ended_at is null) or (status = 'ended' and ended_at is not null))
);

create unique index if not exists idx_telegram_one_active_project_session
  on telegram_project_sessions (telegram_account_id)
  where status = 'active';

create index if not exists idx_telegram_project_sessions_active
  on telegram_project_sessions (telegram_account_id, brand_id)
  where status = 'active';

-- ── Redacted execution evidence ───────────────────────────────────────────

create table if not exists execution_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  api_key_id uuid references api_keys(id) on delete set null,
  project_access_grant_id uuid references project_access_grants(id) on delete set null,
  project_link_id uuid references project_links(id) on delete set null,
  brand_id uuid references brands(id) on delete set null,
  channel text not null check (channel in ('web', 'mcp', 'telegram', 'internal')),
  action text not null,
  outcome text not null check (outcome in ('allowed', 'denied', 'error')),
  policy_version integer not null default 1,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (not (detail ? 'raw_input')),
  check (not (detail ? 'message')),
  check (not (detail ? 'patient_data'))
);

create index if not exists idx_execution_audit_project_created
  on execution_audit (brand_id, created_at desc);

-- ── Project-bound memory ──────────────────────────────────────────────────

alter table agent_memories
  add column if not exists brand_id uuid references brands(id) on delete cascade,
  add column if not exists isolation_status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agent_memories_isolation_status_check'
  ) then
    alter table agent_memories add constraint agent_memories_isolation_status_check
      check (isolation_status in ('active', 'quarantined'));
  end if;
end $$;

-- Match the longest known slug so names such as "downscale-diary" cannot be
-- accidentally assigned to the shorter "downscale" prefix.
with candidate_memory_projects as (
  select
    am.id as memory_id,
    b.id as brand_id,
    row_number() over (
      partition by am.id
      order by length(b.slug) desc
    ) as match_rank
  from agent_memories am
  join brands b on am.namespace = 'nrs-' || b.slug
    or am.namespace like 'nrs-' || b.slug || '-%'
  where am.brand_id is null
)
update agent_memories am
set brand_id = candidate.brand_id,
    isolation_status = 'active'
from candidate_memory_projects candidate
where am.id = candidate.memory_id
  and candidate.match_rank = 1;

-- Agency-global and otherwise ambiguous historic memories are preserved for
-- audit only. They cannot enter prompts or ordinary memory retrieval.
update agent_memories
set isolation_status = 'quarantined'
where brand_id is null;

-- Enforce the invariant only after historic data has either been safely
-- assigned to one project or quarantined.  Adding this before the backfill
-- would reject the very legacy rows this migration is designed to contain.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'agent_memories_project_or_quarantine_check'
  ) then
    alter table agent_memories add constraint agent_memories_project_or_quarantine_check
      check (brand_id is not null or isolation_status = 'quarantined');
  end if;
end $$;

create index if not exists idx_agent_memories_active_project_namespace
  on agent_memories (user_id, brand_id, namespace, updated_at desc)
  where isolation_status = 'active';

drop function if exists public.match_memories(extensions.vector, float, integer, text, uuid);
create function public.match_memories(
  query_embedding extensions.vector(1536),
  match_threshold float default 0.7,
  match_count int default 10,
  filter_namespace text default null,
  filter_user_id uuid default null,
  filter_brand_id uuid default null
) returns table (
  id uuid,
  key text,
  namespace text,
  value text,
  tags text[],
  memory_type text,
  confidence real,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz
) language plpgsql security definer as $$
begin
  return query
  select
    am.id,
    am.key,
    am.namespace,
    am.value,
    am.tags,
    am.memory_type,
    am.confidence,
    (1 - (am.embedding <=> query_embedding))::float as similarity,
    am.created_at,
    am.updated_at
  from agent_memories am
  where am.isolation_status = 'active'
    and (filter_namespace is null or am.namespace = filter_namespace)
    and (filter_user_id is null or am.user_id = filter_user_id)
    and (filter_brand_id is null or am.brand_id = filter_brand_id)
    and am.embedding is not null
    and (1 - (am.embedding <=> query_embedding)) > match_threshold
  order by am.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ── Scope proof on MCP jobs ───────────────────────────────────────────────

alter table mcp_jobs
  add column if not exists channel text not null default 'mcp' check (channel in ('mcp', 'telegram')),
  add column if not exists api_key_id uuid references api_keys(id) on delete set null,
  add column if not exists project_access_grant_id uuid references project_access_grants(id) on delete set null,
  add column if not exists policy_version integer not null default 1;

create index if not exists idx_mcp_jobs_scope
  on mcp_jobs (api_key_id, project_access_grant_id, brand_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────

alter table project_access_grants enable row level security;
alter table api_key_project_grants enable row level security;
alter table project_links enable row level security;
alter table project_connectors enable row level security;
alter table telegram_accounts enable row level security;
alter table telegram_pair_codes enable row level security;
alter table telegram_project_sessions enable row level security;
alter table execution_audit enable row level security;

create policy "actors read their project grants" on project_access_grants
  for select using (auth.uid() = actor_user_id);
create policy "service manages project grants" on project_access_grants
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "users read their api key grants" on api_key_project_grants
  for select using (
    exists (
      select 1 from api_keys k
      where k.id = api_key_project_grants.api_key_id
        and k.user_id = auth.uid()
    )
  );
create policy "service manages api key grants" on api_key_project_grants
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "project members read project links" on project_links
  for select using (can_access_brand(source_brand_id) or can_access_brand(target_brand_id));
create policy "project owners manage project links" on project_links
  for all using (can_write_for_owner(source_brand_id)) with check (can_write_for_owner(source_brand_id));
create policy "service manages project links" on project_links
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "project members read connectors" on project_connectors
  for select using (can_access_brand(brand_id));
create policy "project owners manage connectors" on project_connectors
  for all using (can_write_for_owner(brand_id)) with check (can_write_for_owner(brand_id));
create policy "service manages connectors" on project_connectors
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "actors manage telegram accounts" on telegram_accounts
  for all using (auth.uid() = actor_user_id) with check (auth.uid() = actor_user_id);
create policy "service manages telegram accounts" on telegram_accounts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "actors read their telegram pair codes" on telegram_pair_codes
  for select using (auth.uid() = actor_user_id);
create policy "service manages telegram pair codes" on telegram_pair_codes
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "actors read telegram sessions" on telegram_project_sessions
  for select using (
    exists (
      select 1 from telegram_accounts a
      where a.id = telegram_project_sessions.telegram_account_id
        and a.actor_user_id = auth.uid()
    )
  );
create policy "service manages telegram sessions" on telegram_project_sessions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "actors read execution audit" on execution_audit
  for select using (auth.uid() = actor_user_id);
create policy "service manages execution audit" on execution_audit
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "Users manage own memories" on agent_memories;
drop policy if exists "Team members read brand memories" on agent_memories;
drop policy if exists "Team admins write brand memories" on agent_memories;
drop policy if exists "Service role full access" on agent_memories;

create policy "owners manage own project memories" on agent_memories
  for all using (
    auth.uid() = user_id
    and isolation_status = 'active'
    and can_access_brand(brand_id)
  ) with check (
    auth.uid() = user_id
    and isolation_status = 'active'
    and can_access_brand(brand_id)
  );
create policy "team members read active project memories" on agent_memories
  for select using (isolation_status = 'active' and can_access_brand(brand_id));
create policy "team admins write active project memories" on agent_memories
  for insert with check (isolation_status = 'active' and can_write_for_owner(brand_id));
create policy "service manages scoped memories" on agent_memories
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

commit;
