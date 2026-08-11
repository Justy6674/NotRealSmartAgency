-- Secure, brand-locked capability links for direct browser → Supabase media
-- uploads. Raw tokens never reach this table: only their SHA-256 hashes do.

create table if not exists public.media_intake_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  label text not null default 'Quick add media',
  token_prefix text not null,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  last_used_at timestamptz,
  last_media_item_id uuid references public.media_items(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'active' and revoked_at is null) or (status = 'revoked' and revoked_at is not null))
);

create index if not exists idx_media_intake_links_brand_active
  on public.media_intake_links (brand_id, created_at desc)
  where status = 'active' and revoked_at is null;

create index if not exists idx_media_intake_links_token_active
  on public.media_intake_links (token_hash)
  where status = 'active' and revoked_at is null;

-- A link must always file its upload under the owning brand's user. This keeps
-- the existing team-media RLS model intact: team members can see the new item,
-- while the public capability does not become a user identity.
create or replace function public.assert_media_intake_link_owner()
returns trigger as $$
declare
  brand_owner uuid;
begin
  select user_id into brand_owner from public.brands where id = new.brand_id;
  if brand_owner is null or brand_owner <> new.owner_user_id then
    raise exception 'media intake links must use the brand owner';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists media_intake_links_owner on public.media_intake_links;
create trigger media_intake_links_owner
  before insert or update of brand_id, owner_user_id on public.media_intake_links
  for each row execute function public.assert_media_intake_link_owner();

drop trigger if exists media_intake_links_updated_at on public.media_intake_links;
create trigger media_intake_links_updated_at
  before update on public.media_intake_links
  for each row execute function public.update_updated_at();

alter table public.media_intake_links enable row level security;

drop policy if exists "media intake links select" on public.media_intake_links;
create policy "media intake links select" on public.media_intake_links
  for select using (public.can_access_brand(brand_id));

drop policy if exists "media intake links insert" on public.media_intake_links;
create policy "media intake links insert" on public.media_intake_links
  for insert with check (
    public.can_access_brand(brand_id)
    and public.can_write_for_owner(owner_user_id)
  );

drop policy if exists "media intake links update" on public.media_intake_links;
create policy "media intake links update" on public.media_intake_links
  for update using (
    public.can_access_brand(brand_id)
    and public.can_write_for_owner(owner_user_id)
  ) with check (
    public.can_access_brand(brand_id)
    and public.can_write_for_owner(owner_user_id)
  );

drop policy if exists "media intake links delete" on public.media_intake_links;
create policy "media intake links delete" on public.media_intake_links
  for delete using (
    public.can_access_brand(brand_id)
    and public.can_write_for_owner(owner_user_id)
  );
