-- Labels for the social desk.
--
-- Why this table exists at all: the publisher has no tag taxonomy. Its post
-- records carry `tags` and `hashtags` as plain string arrays with no colour, no
-- per-business list and no way to filter a list by one. Mixpost's labels — the
-- coloured chips in the Labels column and the stripes down the side of a
-- calendar card — have nothing behind them upstream, so they are ours to own.
-- That is Build-First by necessity rather than by preference, and it is worth
-- saying plainly so nobody later "moves labels to the publisher" and discovers
-- there is nothing to move them to.
--
-- Scope: a label attaches to a post THIS desk made (`scheduled_posts`). History
-- published outside this app has no row here to hang a label off, so the Labels
-- cell on a history row is honestly empty rather than quietly unavailable.

-- =============================================================================
-- 0. Write predicate — why can_access_brand() alone is not one
-- =============================================================================
--
-- `can_access_brand()` (015_team_members.sql) has NO role clause: an accepted
-- team member with role 'viewer' passes it. Used on its own in a write policy
-- it lets a read-only member create, attach and delete labels on a health
-- brand's posts — four of these businesses advertise regulated services, so a
-- viewer editing what a post is filed under is a compliance exposure, not a
-- cosmetic one.
--
-- `can_write_for_owner()` is the role check, but its first branch is
-- `auth.uid() = p_user_id`. Handing it the ACTING user's id (which is what the
-- route stores in owner_user_id) makes that branch always true, so the whole
-- predicate collapses back to can_access_brand(). The id it is given has to be
-- the WORKSPACE OWNER — `brands.user_id` — for the check to mean anything.
--
-- This helper is the two of them composed correctly, in one place, so a later
-- policy cannot get the pairing wrong again.

create or replace function public.brand_owner_id(p_brand_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select b.user_id from public.brands b where b.id = p_brand_id;
$$;

create or replace function public.can_write_for_brand(p_brand_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.can_access_brand(p_brand_id)
     and public.can_write_for_owner(public.brand_owner_id(p_brand_id));
$$;

comment on function public.can_write_for_brand(uuid) is
  'Brand-scoped write predicate: access to this brand AND an owner/admin role '
  'against the brand''s owner. Never use can_access_brand() alone in a write '
  'policy — it admits viewers.';

-- =============================================================================
-- 1. Tables
-- =============================================================================

create table if not exists public.social_post_labels (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  -- The WORKSPACE OWNER (brands.user_id), never the person who happened to
  -- click New label. A label created by a team admin used to carry that
  -- admin's id, which left the owner of the business unable to delete a chip
  -- on their own posts. Filled by the trigger below, so a caller cannot get
  -- it wrong and no route needs to know the rule.
  owner_user_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 40),
  -- oklch only, per DESIGN.md. Stored as the full CSS colour so the desk never
  -- has to translate a hex into the house palette at render time.
  colour text not null default 'oklch(0.62 0.10 220)',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One name per business, case-insensitively. "Offer" and "offer" being two
-- different chips is the kind of small mess that makes a filter untrustworthy.
create unique index if not exists social_post_labels_brand_name_idx
  on public.social_post_labels (brand_id, lower(trim(name)));

-- =============================================================================
-- 2. A link can only ever join a label and a post from the SAME business
-- =============================================================================
--
-- The link row carries brand_id of its own (see the note on its select policy).
-- Carrying it is not the same as it being true: nothing above stops a caller
-- posting a label id from one business with a post id from another and a
-- brand_id that matches whichever of the two it has access to. Composite
-- foreign keys make that unrepresentable in the table rather than merely
-- discouraged in the caller — a check the application cannot forget.
--
-- Both parents therefore need a unique key on (id, brand_id). id is already
-- unique, so these add an index and no new restriction.

do $$
begin
  alter table public.social_post_labels
    add constraint social_post_labels_id_brand_key unique (id, brand_id);
exception
  when duplicate_table or duplicate_object then null;
end $$;

do $$
begin
  alter table public.scheduled_posts
    add constraint scheduled_posts_id_brand_key unique (id, brand_id);
exception
  when duplicate_table or duplicate_object then null;
end $$;

create table if not exists public.social_post_label_links (
  label_id uuid not null,
  scheduled_post_id uuid not null,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (label_id, scheduled_post_id),
  constraint social_post_label_links_label_fk
    foreign key (label_id, brand_id)
    references public.social_post_labels (id, brand_id)
    on delete cascade,
  constraint social_post_label_links_post_fk
    foreign key (scheduled_post_id, brand_id)
    references public.scheduled_posts (id, brand_id)
    on delete cascade
);

-- If an earlier draft of this file was ever applied, the table above already
-- exists with plain single-column foreign keys and `create table if not
-- exists` silently leaves them alone — the fix would look applied and not be.
-- Restate the keys so the shape is the same whichever way the table got here.
-- Adding a foreign key validates the rows already in the table, so a link that
-- straddles two businesses stops this migration loudly rather than being
-- carried forward.
do $$
begin
  alter table public.social_post_label_links
    drop constraint if exists social_post_label_links_label_id_fkey;
  alter table public.social_post_label_links
    drop constraint if exists social_post_label_links_scheduled_post_id_fkey;

  begin
    alter table public.social_post_label_links
      add constraint social_post_label_links_label_fk
      foreign key (label_id, brand_id)
      references public.social_post_labels (id, brand_id) on delete cascade;
  exception when duplicate_object then null;
  end;

  begin
    alter table public.social_post_label_links
      add constraint social_post_label_links_post_fk
      foreign key (scheduled_post_id, brand_id)
      references public.scheduled_posts (id, brand_id) on delete cascade;
  exception when duplicate_object then null;
  end;
end $$;

create index if not exists social_post_label_links_post_idx
  on public.social_post_label_links (scheduled_post_id);

create index if not exists social_post_label_links_brand_idx
  on public.social_post_label_links (brand_id, label_id);

-- =============================================================================
-- 3. owner_user_id is derived, not supplied
-- =============================================================================

create or replace function public.set_social_post_label_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Whatever the caller sent is discarded. The owner of a label is the owner of
  -- the business, full stop; the acting user is already recorded in audit_log.
  new.owner_user_id := public.brand_owner_id(new.brand_id);
  if new.owner_user_id is null then
    raise exception 'social_post_labels.brand_id % has no owner', new.brand_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_owner_user_id on public.social_post_labels;
create trigger set_owner_user_id
  before insert or update on public.social_post_labels
  for each row execute function public.set_social_post_label_owner();

-- Correct anything an earlier draft let through. A label filed under the team
-- admin who happened to create it is one the business's own owner cannot
-- delete, so this is a repair, not tidying.
update public.social_post_labels l
   set owner_user_id = b.user_id
  from public.brands b
 where b.id = l.brand_id
   and l.owner_user_id is distinct from b.user_id;

-- =============================================================================
-- 4. RLS
-- =============================================================================

alter table public.social_post_labels enable row level security;
alter table public.social_post_label_links enable row level security;

-- An earlier draft of this file shipped a single FOR ALL policy per table whose
-- only real test was can_access_brand() — which a viewer passes. If that draft
-- was ever applied anywhere, the policy is still sitting there granting writes,
-- and `create policy` under a new name would not disturb it: RLS policies are
-- permissive and OR together, so leaving it would keep the hole open beside the
-- fix. Drop it by name before creating anything.
drop policy if exists social_post_labels_write on public.social_post_labels;
drop policy if exists social_post_label_links_write on public.social_post_label_links;

drop policy if exists social_post_labels_select on public.social_post_labels;
drop policy if exists social_post_labels_insert on public.social_post_labels;
drop policy if exists social_post_labels_update on public.social_post_labels;
drop policy if exists social_post_labels_delete on public.social_post_labels;
drop policy if exists social_post_label_links_select on public.social_post_label_links;
drop policy if exists social_post_label_links_insert on public.social_post_label_links;
drop policy if exists social_post_label_links_delete on public.social_post_label_links;

-- Reading is brand access, plainly: a viewer is meant to see the chips.
create policy social_post_labels_select on public.social_post_labels
  for select using (public.can_access_brand(brand_id));

-- Writing is split per verb rather than FOR ALL, so each one can be read on its
-- own and an audit does not have to reason about which verbs a single USING
-- clause is silently covering.
--
-- The owner_user_id equality is belt and braces beside the trigger: if the
-- trigger were ever dropped, the policy still refuses a row filed under anyone
-- but the business's owner.
create policy social_post_labels_insert on public.social_post_labels
  for insert with check (
    public.can_write_for_brand(brand_id)
    and owner_user_id = public.brand_owner_id(brand_id)
  );

create policy social_post_labels_update on public.social_post_labels
  for update using (public.can_write_for_brand(brand_id))
  with check (
    public.can_write_for_brand(brand_id)
    and owner_user_id = public.brand_owner_id(brand_id)
  );

create policy social_post_labels_delete on public.social_post_labels
  for delete using (public.can_write_for_brand(brand_id));

-- The link table carries its own brand_id rather than joining through to the
-- label. Without it every policy check on a link row is a join, and a join in a
-- policy is a place where a missing index turns a list page into a table scan.
-- The composite foreign keys above are what keep that denormalised brand_id
-- honest.
create policy social_post_label_links_select on public.social_post_label_links
  for select using (public.can_access_brand(brand_id));

create policy social_post_label_links_insert on public.social_post_label_links
  for insert with check (public.can_write_for_brand(brand_id));

create policy social_post_label_links_delete on public.social_post_label_links
  for delete using (public.can_write_for_brand(brand_id));

-- No UPDATE policy: a link is two ids and a brand. Changing either one is a
-- different link, and setPostLabels() replaces the set wholesale, so an update
-- path would exist only as an unaudited way to move a label between posts.

drop trigger if exists set_updated_at on public.social_post_labels;
create trigger set_updated_at
  before update on public.social_post_labels
  for each row execute function public.update_updated_at();
