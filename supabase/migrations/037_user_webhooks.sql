-- Phase 8 — Outbound user webhooks
--
-- NRS users register webhooks pointing at their own Zapier / n8n / Make /
-- custom endpoint. They pick which events they care about (post.created,
-- post.published, media.uploaded, etc.) and NRS POSTs an HMAC-SHA256-signed
-- JSON payload when those events fire.
--
-- This is the OUTBOUND webhook layer. It is distinct from the inbound
-- Mixpost webhook receiver at /api/webhooks/mixpost — that one consumes
-- events FROM Mixpost. This table powers events flowing OUT of NRS to
-- third-party automation tools owned by our users.

create table if not exists user_webhooks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text,
  url text not null,
  method text default 'POST',
  secret text,
  events text[] default '{}'::text[],
  active boolean default true,
  last_delivery_at timestamptz,
  last_delivery_status text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists user_webhooks_brand_idx on user_webhooks(brand_id);

create table if not exists user_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid not null references user_webhooks(id) on delete cascade,
  event text not null,
  status text not null check (status in ('success','failed','pending')),
  http_status int,
  payload jsonb,
  response jsonb,
  error text,
  attempt int default 1,
  created_at timestamptz default now() not null
);

create index if not exists user_webhook_deliveries_webhook_idx
  on user_webhook_deliveries(webhook_id, created_at desc);

alter table user_webhooks enable row level security;
alter table user_webhook_deliveries enable row level security;

-- Reuse the same brand RLS helpers other tables use (defined in
-- migration 015_team_members.sql). can_access_brand() returns true for
-- the brand owner OR any team member with access; can_write_for_owner()
-- enforces owner/admin role.
create policy "team members read webhooks" on user_webhooks
  for select using (can_access_brand(brand_id));

create policy "team members write webhooks" on user_webhooks
  for all
  using (can_write_for_owner(brand_id))
  with check (can_write_for_owner(brand_id));

create policy "team members read deliveries" on user_webhook_deliveries
  for select using (
    webhook_id in (select id from user_webhooks where can_access_brand(brand_id))
  );

-- updated_at trigger — uses the project-wide update_updated_at() function
-- (note: NOT update_updated_at_column — see CLAUDE.md gotchas).
drop trigger if exists user_webhooks_updated_at on user_webhooks;
create trigger user_webhooks_updated_at
  before update on user_webhooks
  for each row execute function update_updated_at();
