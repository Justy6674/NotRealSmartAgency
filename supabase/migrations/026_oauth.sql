-- OAuth 2.0 for MCP server — enables Claude Desktop/Mobile "Add connector" flow

-- Registered OAuth clients (Claude Desktop registers dynamically via RFC 7591)
create table public.oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text unique not null,
  client_secret text not null,
  client_name text,
  redirect_uris text[] not null,
  created_at timestamptz not null default now()
);

-- Short-lived auth codes (5 min, single-use)
create table public.oauth_auth_codes (
  code text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_challenge text not null,
  redirect_uri text not null,
  state text,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_oauth_auth_codes_expires on public.oauth_auth_codes (expires_at) where used = false;

-- No RLS needed — these are only accessed via admin client (service role)
