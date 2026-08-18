-- Social desk command bus. Additive. Not applied in this run — live schema
-- changes wait for Justin. The client command bus does not read these tables
-- yet; they exist so a later API can persist compositions without inventing
-- a second write path.

create table if not exists public.social_compositions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid null,
  document jsonb not null,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_desk_commands (
  id uuid primary key,
  composition_id uuid not null references public.social_compositions(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  actor_user_id uuid not null,
  source text not null check (source in ('manual', 'director')),
  action jsonb not null,
  receipt jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists social_compositions_brand_idx
  on public.social_compositions (brand_id, updated_at desc);

create index if not exists social_desk_commands_composition_idx
  on public.social_desk_commands (composition_id, created_at desc);

alter table public.social_compositions enable row level security;
alter table public.social_desk_commands enable row level security;

create policy social_compositions_select on public.social_compositions
  for select using (public.can_access_brand(brand_id));

create policy social_compositions_write on public.social_compositions
  for all using (
    public.can_access_brand(brand_id)
    and public.can_write_for_owner(owner_user_id)
  )
  with check (
    public.can_access_brand(brand_id)
    and public.can_write_for_owner(owner_user_id)
  );

create policy social_desk_commands_select on public.social_desk_commands
  for select using (public.can_access_brand(brand_id));

create policy social_desk_commands_insert on public.social_desk_commands
  for insert with check (
    public.can_access_brand(brand_id)
    and public.can_write_for_owner(actor_user_id)
  );

create or replace function public.apply_social_desk_command(p_command jsonb)
returns jsonb
language plpgsql
security invoker
as $$
begin
  -- Persistence of the reducer is the TypeScript command service.
  -- This stub exists so the desk cannot be restored without naming the gate.
  raise exception 'apply_social_desk_command is owned by the application command service';
end;
$$;
