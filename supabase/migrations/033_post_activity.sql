-- 033_post_activity.sql
--
-- Phase 4b of the Mixpost UI port — a lightweight comment + system-event
-- timeline attached to scheduled_posts. Lets team members (Justin, Bec,
-- admins) discuss a draft post inside NRS without bouncing to Slack or
-- Mixpost. Mirrors Mixpost Pro's Components/PostActivity feature but
-- stored in our own table so NRS owns the data.
--
-- Types:
--   comment         human-written comment via CommentEditor
--   created         post row first inserted (draft created)
--   scheduled       post moved to status='scheduled'
--   rescheduled     scheduled_at changed after first schedule
--   published       Mixpost webhook reported post.published
--   failed          Mixpost webhook reported post.publishing_failed
--   status_change   any other status transition
--   edit            caption / hashtags / media edited
--
-- RLS: read access mirrors can_access_brand (viewer role can see drafts),
-- write access mirrors can_write_for_owner (viewer cannot comment). Both
-- helpers are defined in 015_team_members.sql.
--
-- The scheduled_posts row already has user_id (owner), so RLS checks are
-- threaded through that column rather than the brand table.

create table if not exists post_activity (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_id uuid not null references scheduled_posts(id) on delete cascade,
  user_id uuid references users(id),
  -- user_id is nullable because system events (published/failed from the
  -- Mixpost webhook) don't have an authenticated user attached. The
  -- comment path always sets it.
  type text not null check (type in (
    'comment','created','scheduled','rescheduled','published','failed','status_change','edit'
  )),
  body text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

create index if not exists post_activity_post_id_idx
  on post_activity(scheduled_post_id, created_at desc);

alter table post_activity enable row level security;

-- SELECT: can read activity if you can access the owning scheduled_post
-- (owner or team member with brand access — viewer role is fine).
create policy "post_activity_select" on post_activity
  for select using (
    scheduled_post_id in (
      select sp.id from scheduled_posts sp
      where sp.user_id = auth.uid()
         or exists (
           select 1 from team_members tm
           where tm.owner_id = sp.user_id
             and tm.member_id = auth.uid()
             and tm.status = 'accepted'
         )
    )
  );

-- INSERT: only admins/owners can comment or log system events. Viewer
-- role cannot write. System events arriving via the Mixpost webhook
-- should use the service role which bypasses RLS entirely.
create policy "post_activity_insert" on post_activity
  for insert with check (
    scheduled_post_id in (
      select sp.id from scheduled_posts sp
      where can_write_for_owner(sp.user_id)
    )
  );

-- No UPDATE / DELETE policies — activity rows are append-only. Nothing
-- in the app should mutate history.
