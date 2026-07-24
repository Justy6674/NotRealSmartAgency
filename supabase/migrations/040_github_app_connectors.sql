-- Per-project GitHub App read connectors. This migration deliberately stores
-- only installation and repository identifiers; ephemeral credentials remain
-- in server memory while a single request is executing.

begin;

create table if not exists github_app_installations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  github_installation_id bigint not null,
  account_login text not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, github_installation_id)
);

create trigger github_app_installations_updated_at
  before update on github_app_installations
  for each row execute function update_updated_at();

create table if not exists github_installation_repositories (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references github_app_installations(id) on delete cascade,
  github_repository_id bigint not null,
  full_name text not null,
  default_branch text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installation_id, github_repository_id),
  unique (installation_id, full_name)
);

create trigger github_installation_repositories_updated_at
  before update on github_installation_repositories
  for each row execute function update_updated_at();

create table if not exists github_repository_bindings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  installation_id uuid not null references github_app_installations(id) on delete cascade,
  installation_repository_id uuid not null references github_installation_repositories(id) on delete restrict,
  allowed_paths text[] not null default array[
    'README.md',
    'package.json',
    'docs/CAPABILITY-MAP.md',
    'docs/PRODUCT.md',
    'PRODUCT.md',
    'BRAND.md'
  ]::text[],
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id),
  unique (brand_id, installation_repository_id),
  check (allowed_paths <@ array[
    'README.md',
    'package.json',
    'docs/CAPABILITY-MAP.md',
    'docs/PRODUCT.md',
    'PRODUCT.md',
    'BRAND.md'
  ]::text[])
);

create trigger github_repository_bindings_updated_at
  before update on github_repository_bindings
  for each row execute function update_updated_at();

-- The state value itself is delivered solely through Telegram and the browser.
-- It is never retained, only a verifier for a single 10-minute connection run.
create table if not exists github_connect_requests (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  telegram_account_id uuid not null references telegram_accounts(id) on delete cascade,
  project_access_grant_ids uuid[] not null check (cardinality(project_access_grant_ids) > 0),
  brand_ids uuid[] not null check (cardinality(brand_ids) > 0),
  state_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_github_connect_requests_valid
  on github_connect_requests (state_hash, expires_at)
  where used_at is null;

create index if not exists idx_github_repository_bindings_brand_active
  on github_repository_bindings (brand_id)
  where status = 'active';

-- The central connector register carries a human-readable, project-bound
-- descriptor. It never contains an app private key or a credential value.
alter table project_connectors
  drop constraint if exists project_connectors_github_app_read_only_check;
-- github_app requires read_only true.
alter table project_connectors
  add constraint project_connectors_github_app_read_only_check
  check (connector_type <> 'github_app' or read_only is true);

alter table github_app_installations enable row level security;
alter table github_installation_repositories enable row level security;
alter table github_repository_bindings enable row level security;
alter table github_connect_requests enable row level security;

create policy "owners read github app installations" on github_app_installations
  for select using (auth.uid() = owner_user_id);
create policy "service manages github app installations" on github_app_installations
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "owners read github installation repositories" on github_installation_repositories
  for select using (
    exists (
      select 1 from github_app_installations installation
      where installation.id = github_installation_repositories.installation_id
        and installation.owner_user_id = auth.uid()
    )
  );
create policy "service manages github installation repositories" on github_installation_repositories
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "project members read github repository bindings" on github_repository_bindings
  for select using (can_access_brand(brand_id));
create policy "project owners manage github repository bindings" on github_repository_bindings
  for all using (can_write_for_owner(brand_id)) with check (can_write_for_owner(brand_id));
create policy "service manages github repository bindings" on github_repository_bindings
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "actors read github connection requests" on github_connect_requests
  for select using (auth.uid() = actor_user_id);
create policy "service manages github connection requests" on github_connect_requests
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

commit;
