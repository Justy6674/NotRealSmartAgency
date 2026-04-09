-- ─── MCP Jobs ──────────────────────────────────────────────────────────────
-- Async job queue for long-running MCP Director conversations.
-- The MCP transport has a ~60s client-side timeout; the Director with full
-- delegation chains takes 90s+. Pattern: chat_with_director inserts a row
-- and returns job_id immediately, then the Director runs in the background
-- via Next.js after(). Clients poll get_director_response(job_id).

create table if not exists mcp_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid references brands(id) on delete cascade,
  job_type text not null check (job_type in ('director_chat')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  input jsonb not null,
  result jsonb,
  error text,
  cost_cents integer default 0,
  duration_ms integer,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_mcp_jobs_user_status on mcp_jobs(user_id, status);
create index if not exists idx_mcp_jobs_created_at on mcp_jobs(created_at desc);

-- RLS: users can only see their own jobs. Service role bypasses for the runner.
alter table mcp_jobs enable row level security;

create policy "users read own mcp_jobs" on mcp_jobs
  for select
  using (auth.uid() = user_id);

-- Inserts/updates only happen via service role (admin client) inside the
-- Director job runner. No user-facing INSERT/UPDATE policies needed.

-- Cleanup: jobs older than 7 days are stale, dropped by daily-intel cron later.
comment on table mcp_jobs is 'Async job queue for MCP Director chats. Background runner via after(). Cleaned up after 7 days.';
