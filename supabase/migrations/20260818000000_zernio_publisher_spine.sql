-- Zernio spine (T1): widen publisher_runs, persist accountId→brand,
-- webhook event dedupe, and a row lock for concurrent publishers.
-- New file after 055-class / 20260817. Do not edit 034_direct_publishing.sql.

-- ── publisher_runs: zernio is a real publisher, and every run names an account ──

alter table publisher_runs
  drop constraint publisher_runs_publisher_check;

alter table publisher_runs
  add constraint publisher_runs_publisher_check
  check (publisher in ('native', 'mixpost', 'zernio'));

-- Zero live rows (checked 2026-08-18). NOT NULL is safe.
alter table publisher_runs
  add column brand_id uuid not null references brands(id) on delete cascade,
  add column account_id text not null,
  add column idempotency_key text;

create unique index publisher_runs_brand_idempotency_uidx
  on publisher_runs (brand_id, idempotency_key)
  where idempotency_key is not null;

create index publisher_runs_account_idx
  on publisher_runs (account_id)
  where account_id is not null;

-- ── Tenant map. Isolation is ours; Zernio listAccounts({profileId}) ignores the filter. ──

create table if not exists zernio_account_map (
  account_id text not null,
  brand_id uuid not null references brands(id) on delete cascade,
  profile_id text not null,
  platform text not null,
  username text,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, brand_id)
);

create index zernio_account_map_brand_live_idx
  on zernio_account_map (brand_id)
  where disconnected_at is null;

create trigger set_zernio_account_map_updated_at
  before update on zernio_account_map
  for each row execute function update_updated_at();

alter table zernio_account_map enable row level security;

create policy "team members read zernio account map"
  on zernio_account_map for select
  using (can_access_brand(brand_id));

create policy "team members write zernio account map"
  on zernio_account_map for insert
  with check (can_access_brand(brand_id));

create policy "team members update zernio account map"
  on zernio_account_map for update
  using (can_access_brand(brand_id));

-- ── Webhook dedupe. Primary key is Zernio payload.id. ──

create table if not exists zernio_webhook_events (
  id text primary key,
  event text not null,
  zernio_post_id text,
  account_id text,
  received_at timestamptz not null default now(),
  payload jsonb
);

create unique index zernio_webhook_events_event_post_uidx
  on zernio_webhook_events (event, zernio_post_id)
  where zernio_post_id is not null;

create unique index zernio_webhook_events_event_account_uidx
  on zernio_webhook_events (event, account_id)
  where zernio_post_id is null and account_id is not null;

alter table zernio_webhook_events enable row level security;
-- Service-role webhook writer bypasses RLS. No authenticated policies on purpose.

-- ── D26: every status write takes the same row lock ──

create or replace function public.lock_scheduled_post(p_id uuid)
returns scheduled_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  locked scheduled_posts;
begin
  select * into locked
  from scheduled_posts
  where id = p_id
  for update;

  if not found then
    raise exception 'scheduled_post not found';
  end if;

  return locked;
end;
$$;

revoke all on function public.lock_scheduled_post(uuid) from public;
grant execute on function public.lock_scheduled_post(uuid) to service_role;
