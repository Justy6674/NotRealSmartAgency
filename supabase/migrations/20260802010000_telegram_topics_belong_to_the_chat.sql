-- A forum topic belongs to the group, not to the person who created it.
--
-- Topic mappings were keyed by telegram_account_id, which was fine while one
-- person used the bot. With two people in the group it breaks: whoever runs
-- "set up topics" owns every mapping, and everybody else posting in those same
-- topics resolves to nothing and gets asked to pick a project — in a group,
-- where the picker's buttons do not work.
--
-- Keying on the chat makes a topic mean the same thing to everyone in it.
-- Access is unaffected: the project a topic names still has to appear in the
-- reader's own grants before anything runs.

ALTER TABLE telegram_project_sessions
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL;

COMMENT ON COLUMN telegram_project_sessions.telegram_chat_id IS
  'Group chat a topic row belongs to. Null on ordinary selection rows, which are per-account by nature.';

-- One topic per project per group, and one project per topic.
CREATE UNIQUE INDEX IF NOT EXISTS telegram_project_sessions_chat_thread_idx
  ON telegram_project_sessions (telegram_chat_id, message_thread_id)
  WHERE status = 'topic' AND telegram_chat_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS telegram_project_sessions_chat_brand_idx
  ON telegram_project_sessions (telegram_chat_id, brand_id)
  WHERE status = 'topic' AND telegram_chat_id IS NOT NULL;

-- The per-account topic indexes from 20260731 would now reject a second
-- person's identical view of the same group topic. Chat-scoped uniqueness
-- above is the rule that matters.
DROP INDEX IF EXISTS telegram_project_sessions_topic_thread_idx;
DROP INDEX IF EXISTS telegram_project_sessions_topic_brand_idx;
