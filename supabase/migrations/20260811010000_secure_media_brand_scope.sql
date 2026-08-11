-- Keep media access aligned with a team member's assigned brand(s), rather
-- than granting every accepted teammate access to every media row an owner has.
-- The unique partial index makes signed desktop-completion retries idempotent.

create or replace function public.can_write_media_for_brand(p_user_id uuid, p_brand_id uuid)
returns boolean as $$
begin
  return (
    auth.uid() = p_user_id
    or exists (
      select 1 from public.team_members tm
      where tm.owner_id = p_user_id
        and tm.member_id = auth.uid()
        and tm.status = 'accepted'
        and tm.role in ('owner', 'admin')
        and (tm.brand_ids is null or p_brand_id = any(tm.brand_ids))
    )
  );
end;
$$ language plpgsql security definer stable set search_path = public;

drop policy if exists "media_items_select" on public.media_items;
drop policy if exists "media_items_insert" on public.media_items;
drop policy if exists "media_items_update" on public.media_items;
drop policy if exists "media_items_delete" on public.media_items;

create policy "media_items_select" on public.media_items for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.team_members tm
    where tm.owner_id = media_items.user_id
      and tm.member_id = auth.uid()
      and tm.status = 'accepted'
      and (tm.brand_ids is null or media_items.brand_id = any(tm.brand_ids))
  )
);

create policy "media_items_insert" on public.media_items for insert with check (
  public.can_write_media_for_brand(user_id, brand_id)
);

create policy "media_items_update" on public.media_items for update
  using (public.can_write_media_for_brand(user_id, brand_id))
  with check (public.can_write_media_for_brand(user_id, brand_id));

create policy "media_items_delete" on public.media_items for delete using (
  public.can_write_media_for_brand(user_id, brand_id)
);

create unique index if not exists idx_media_items_desktop_inbox_storage_path
  on public.media_items ((metadata ->> 'storage_path'))
  where metadata ->> 'source' = 'desktop_media_inbox';
