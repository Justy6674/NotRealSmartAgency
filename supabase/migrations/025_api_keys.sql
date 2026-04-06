-- API Keys for MCP server access
-- Users create keys in settings, use them to connect Claude Code or any MCP client

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_api_keys_hash on public.api_keys (key_hash) where revoked_at is null;
create index idx_api_keys_user on public.api_keys (user_id);

alter table public.api_keys enable row level security;

create policy "Users manage own keys"
  on public.api_keys
  for all
  using (auth.uid() = user_id);

-- Trigger for updated_at is not needed — keys are immutable except for last_used_at and revoked_at
-- which are updated via admin client (service role)
