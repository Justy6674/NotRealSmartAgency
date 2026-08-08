-- Let a topic row exist at all.
--
-- telegram_project_sessions was built to record a SELECTION: status is
-- 'active' or 'ended', and an unnamed table check requires
--   (status='active' AND ended_at IS NULL) OR (status='ended' AND ended_at IS NOT NULL)
--
-- The forum-topics feature then wrote rows with status='topic'. Those satisfy
-- neither branch, so every insert failed on telegram_project_sessions_check —
-- and the 20260731 migration that shipped the feature was "additive only": it
-- added message_thread_id and two indexes and never touched the constraint.
--
-- So topics were created in Telegram and never linked to a brand, every time,
-- from the day it shipped. Because nothing was linked, every message fell
-- through to the selected project — which is why one brand appeared to be
-- "sticky" no matter which topic it was posted in. The owner's colleague read
-- the raw Postgres constraint error as her first experience of the product.
--
-- A topic row is a MAPPING, not a selection. It has a thread and a chat; it has
-- no ended_at, and the Director front-door topic has no brand at all.

ALTER TABLE telegram_project_sessions
  DROP CONSTRAINT IF EXISTS telegram_project_sessions_status_check;

ALTER TABLE telegram_project_sessions
  DROP CONSTRAINT IF EXISTS telegram_project_sessions_check;

-- Selections keep their old guarantee exactly; topics get their own.
ALTER TABLE telegram_project_sessions
  ADD CONSTRAINT telegram_project_sessions_status_check
  CHECK (status IN ('active', 'ended', 'topic'));

ALTER TABLE telegram_project_sessions
  ADD CONSTRAINT telegram_project_sessions_lifecycle_check
  CHECK (
    (status = 'active' AND ended_at IS NULL)
    OR (status = 'ended' AND ended_at IS NOT NULL)
    OR (status = 'topic' AND ended_at IS NULL)
  );

-- The Director topic is deliberately tied to no brand: a message there falls
-- through to the selected project rather than being pinned to one. So both
-- brand and grant have to be optional — but ONLY for a topic row.
ALTER TABLE telegram_project_sessions
  ALTER COLUMN brand_id DROP NOT NULL,
  ALTER COLUMN project_access_grant_id DROP NOT NULL;

ALTER TABLE telegram_project_sessions
  ADD CONSTRAINT telegram_project_sessions_shape_check
  CHECK (
    (
      status IN ('active', 'ended')
      AND brand_id IS NOT NULL
      AND project_access_grant_id IS NOT NULL
    )
    OR (
      status = 'topic'
      AND message_thread_id IS NOT NULL
      AND telegram_chat_id IS NOT NULL
    )
  );

-- One Director topic per group. Brand-mapped topics are already covered by
-- telegram_project_sessions_chat_brand_idx, but NULL brand_id repeats freely
-- in a unique index, so the front door needs its own rule.
CREATE UNIQUE INDEX IF NOT EXISTS telegram_project_sessions_chat_director_idx
  ON telegram_project_sessions (telegram_chat_id)
  WHERE status = 'topic' AND brand_id IS NULL;
