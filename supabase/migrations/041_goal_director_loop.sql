-- 041: Durable per-brand Director goal loop
-- A brand has one active end-user objective. The Director, task board, and
-- heartbeat all operate against it; completed work schedules an evidence-based
-- review instead of creating disconnected activity.

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS success_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS progress jsonb NOT NULL DEFAULT '{"percent": 0, "summary": "No verified progress recorded yet.", "evidence": []}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_claim_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.schedule_active_goal_review()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.level = 'objective' AND NEW.status = 'active' AND NEW.brand_id IS NOT NULL AND NEW.next_review_at IS NULL THEN
    NEW.next_review_at := now();
  END IF;

  IF NEW.status <> 'active' THEN
    NEW.next_review_at := NULL;
    NEW.review_claimed_at := NULL;
    NEW.review_claim_expires_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedule_active_goal_review ON public.goals;
CREATE TRIGGER schedule_active_goal_review
  BEFORE INSERT OR UPDATE OF level, status, brand_id, next_review_at ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_active_goal_review();

-- One current North Star per user and selected brand. Global/legacy goals may
-- remain, but cannot be mistaken for a scoped autonomous workstream.
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_one_active_objective_per_brand
  ON public.goals (user_id, brand_id)
  WHERE level = 'objective' AND status = 'active' AND brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_goals_due_review
  ON public.goals (next_review_at)
  WHERE level = 'objective' AND status = 'active' AND brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_goal_open
  ON public.tasks (goal_id, status)
  WHERE goal_id IS NOT NULL AND status IN ('assigned', 'in_progress', 'review');

UPDATE public.goals
SET next_review_at = now()
WHERE level = 'objective'
  AND status = 'active'
  AND brand_id IS NOT NULL
  AND next_review_at IS NULL;
