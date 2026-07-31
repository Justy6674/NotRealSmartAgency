-- One Telegram forum topic per project.
--
-- The owner already runs a forum group where each project has its own topic.
-- Posting in a topic should be enough to say which project he means, instead of
-- selecting one before every message.
--
-- Additive only: a nullable column and two indexes. No existing row changes, no
-- RLS change, nothing dropped. Existing 'active'/'ended' sessions are untouched
-- and keep working exactly as before.

ALTER TABLE telegram_project_sessions
  ADD COLUMN IF NOT EXISTS message_thread_id BIGINT;

COMMENT ON COLUMN telegram_project_sessions.message_thread_id IS
  'Telegram forum topic id. Set only on rows with status = ''topic'', which map a thread to a project rather than recording a selection.';

-- A thread belongs to exactly one project. Without this a duplicate setup run
-- could point one topic at two brands and the routing would be a coin toss.
CREATE UNIQUE INDEX IF NOT EXISTS telegram_project_sessions_topic_thread_idx
  ON telegram_project_sessions (telegram_account_id, message_thread_id)
  WHERE status = 'topic';

-- And one topic per project, so setup stays idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS telegram_project_sessions_topic_brand_idx
  ON telegram_project_sessions (telegram_account_id, brand_id)
  WHERE status = 'topic';
