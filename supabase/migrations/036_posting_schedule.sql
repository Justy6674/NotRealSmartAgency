-- Phase 7 — Posting Schedule + Queue
--
-- Mixpost-style weekly slot system: users define recurring slots
-- (e.g. Mon 9am Facebook, Wed 5pm LinkedIn). Drafts dropped into the
-- queue are assigned to the next open slot for their platform; the
-- cron publisher honours `queue_slot_id` when picking work to publish.
--
-- This migration is non-destructive — it only adds a new table and a
-- nullable column on `scheduled_posts`. RLS uses the existing
-- `can_access_brand` / `can_write_for_owner` helpers from migrations
-- 015 / 019.

create table if not exists posting_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  platform text not null,
  day_of_week int not null check (day_of_week between 0 and 6),  -- 0 = Sunday
  time time not null,
  timezone text default 'Australia/Brisbane',
  created_at timestamptz default now() not null,
  unique (brand_id, platform, day_of_week, time)
);

create index if not exists posting_schedule_slots_brand_platform_idx
  on posting_schedule_slots (brand_id, platform);

alter table scheduled_posts
  add column if not exists queue_slot_id uuid references posting_schedule_slots(id) on delete set null;

create index if not exists scheduled_posts_queue_slot_idx
  on scheduled_posts (queue_slot_id) where queue_slot_id is not null;

alter table posting_schedule_slots enable row level security;

drop policy if exists "team members read slots" on posting_schedule_slots;
create policy "team members read slots" on posting_schedule_slots
  for select using (can_access_brand(brand_id));

drop policy if exists "team members write slots" on posting_schedule_slots;
create policy "team members write slots" on posting_schedule_slots
  for all using (can_write_for_owner(brand_id)) with check (can_write_for_owner(brand_id));
