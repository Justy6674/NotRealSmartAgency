-- ============================================================================
-- 007: Agentic Management System
-- Paperclip-inspired orchestration: org chart, tasks, goals, budgets,
-- audit log, approvals, heartbeats
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. New ENUM types
-- ---------------------------------------------------------------------------
CREATE TYPE agent_role AS ENUM ('director', 'head', 'worker');
CREATE TYPE agent_run_status AS ENUM ('idle', 'working', 'paused', 'terminated');
CREATE TYPE task_status AS ENUM ('backlog', 'assigned', 'in_progress', 'review', 'done', 'blocked', 'cancelled');
CREATE TYPE goal_status AS ENUM ('planned', 'active', 'completed', 'paused', 'cancelled');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE heartbeat_source AS ENUM ('cron', 'event', 'manual');

-- ---------------------------------------------------------------------------
-- 2. agent_registry — runtime org chart per user
-- ---------------------------------------------------------------------------
CREATE TABLE public.agent_registry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  agent_type agent_type NOT NULL,
  role agent_role NOT NULL DEFAULT 'head',
  department text,
  reports_to uuid REFERENCES public.agent_registry(id) ON DELETE SET NULL,
  model text NOT NULL DEFAULT 'anthropic/claude-sonnet-4',
  status agent_run_status NOT NULL DEFAULT 'idle',
  is_active boolean DEFAULT true,
  budget_monthly_cents integer DEFAULT 0,
  spent_monthly_cents integer DEFAULT 0,
  last_heartbeat_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, agent_type)
);

CREATE INDEX idx_agent_registry_user_status ON agent_registry (user_id, status);
CREATE INDEX idx_agent_registry_user_reports ON agent_registry (user_id, reports_to);

CREATE TRIGGER update_agent_registry_updated_at
  BEFORE UPDATE ON agent_registry FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agents"
  ON agent_registry FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on agent_registry"
  ON agent_registry FOR ALL
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. goals — hierarchical objectives
-- ---------------------------------------------------------------------------
CREATE TABLE public.goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES public.goals(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  level text NOT NULL DEFAULT 'task' CHECK (level IN ('objective', 'key_result', 'task')),
  status goal_status NOT NULL DEFAULT 'planned',
  owner_agent_id uuid REFERENCES public.agent_registry(id) ON DELETE SET NULL,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  deadline timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_goals_user_status ON goals (user_id, status);
CREATE INDEX idx_goals_parent ON goals (parent_id);
CREATE INDEX idx_goals_brand ON goals (brand_id);

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own goals"
  ON goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on goals"
  ON goals FOR ALL
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. tasks — the work board
-- ---------------------------------------------------------------------------
CREATE TABLE public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  assigned_agent_id uuid REFERENCES public.agent_registry(id) ON DELETE SET NULL,
  created_by_agent_id uuid REFERENCES public.agent_registry(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  context jsonb DEFAULT '{}',
  status task_status NOT NULL DEFAULT 'backlog',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  result jsonb,
  tokens_used integer DEFAULT 0,
  cost_cents integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tasks_user_status ON tasks (user_id, status);
CREATE INDEX idx_tasks_assigned ON tasks (assigned_agent_id, status);
CREATE INDEX idx_tasks_brand ON tasks (brand_id);
CREATE INDEX idx_tasks_goal ON tasks (goal_id);
CREATE INDEX idx_tasks_parent ON tasks (parent_id);

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on tasks"
  ON tasks FOR ALL
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. audit_log — immutable, append-only
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES public.agent_registry(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  detail jsonb DEFAULT '{}',
  cost_cents integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON audit_log (user_id, created_at DESC);
CREATE INDEX idx_audit_log_agent ON audit_log (agent_id, created_at DESC);
CREATE INDEX idx_audit_log_task ON audit_log (task_id);
CREATE INDEX idx_audit_log_action ON audit_log (action);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT only for users (no update/delete)
CREATE POLICY "Users view own audit log"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT only for users
CREATE POLICY "Users insert own audit log"
  ON audit_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access on audit_log"
  ON audit_log FOR ALL
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. approval_queue — human sign-off gates
-- ---------------------------------------------------------------------------
CREATE TABLE public.approval_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES public.agent_registry(id) ON DELETE SET NULL,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status approval_status NOT NULL DEFAULT 'pending',
  decision_note text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_approval_queue_user_status ON approval_queue (user_id, status);
CREATE INDEX idx_approval_queue_agent ON approval_queue (agent_id);

CREATE TRIGGER update_approval_queue_updated_at
  BEFORE UPDATE ON approval_queue FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

ALTER TABLE approval_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own approvals"
  ON approval_queue FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on approval_queue"
  ON approval_queue FOR ALL
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 7. heartbeats — cron execution log
-- ---------------------------------------------------------------------------
CREATE TABLE public.heartbeats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES public.agent_registry(id) ON DELETE SET NULL,
  triggered_by heartbeat_source NOT NULL DEFAULT 'cron',
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  tasks_checked integer DEFAULT 0,
  tasks_actioned integer DEFAULT 0,
  duration_ms integer,
  error text,
  context_snapshot jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_heartbeats_user ON heartbeats (user_id, created_at DESC);
CREATE INDEX idx_heartbeats_agent ON heartbeats (agent_id, created_at DESC);

ALTER TABLE heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own heartbeats"
  ON heartbeats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on heartbeats"
  ON heartbeats FOR ALL
  USING (true) WITH CHECK (true);
