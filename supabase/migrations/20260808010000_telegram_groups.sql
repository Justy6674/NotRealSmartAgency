-- Remember the groups NRS is in.
--
-- A bot cannot ask Telegram which chats it belongs to — there is no such
-- method. So NRS only ever knew a group's id for the length of one webhook
-- request, which meant it could REACT to a message and never act on the group
-- itself. Every piece of setup therefore had to be a command the owner ran,
-- and every failure was his to interpret.
--
-- Recording it once turns that around: topics can be created for him, and the
-- weekly report can be posted where both owners already are.

CREATE TABLE IF NOT EXISTS telegram_groups (
  chat_id TEXT PRIMARY KEY,
  title TEXT,
  is_forum BOOLEAN NOT NULL DEFAULT false,
  /** The NRS account whose projects this group works on. */
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE telegram_groups IS
  'Groups NRS has seen a message in. Telegram offers no way to list a bot''s chats, so this is the only way it can act on a group rather than merely reply in one.';

ALTER TABLE telegram_groups ENABLE ROW LEVEL SECURITY;

-- Written only by the webhook, which uses the service role.
CREATE POLICY "service_telegram_groups" ON telegram_groups
  FOR ALL USING (auth.role() = 'service_role');

-- The owner can see the groups his own account is working in.
CREATE POLICY "owner_reads_telegram_groups" ON telegram_groups
  FOR SELECT USING (auth.uid() = actor_user_id);
