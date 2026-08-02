-- Restrict one Telegram account to a subset of the projects its NRS account holds.
--
-- Why this and not a second NRS user: everything a Telegram request creates —
-- drafts, media, Mixpost pushes — is written under the acting NRS account. A
-- separate login for a second person would put their drafts under a different
-- user_id, where the owner's own Review tab could not see them (RLS scopes
-- reads to the owner and their accepted team members, not the other way
-- round). So the second person acts on the owner's account, and is fenced in
-- here instead.
--
-- NULL = every project the account is granted, which is the existing
-- behaviour and what every current row keeps.

ALTER TABLE telegram_accounts
  ADD COLUMN IF NOT EXISTS allowed_brand_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS label TEXT DEFAULT NULL;

COMMENT ON COLUMN telegram_accounts.allowed_brand_ids IS
  'Projects this Telegram user may work on. NULL means all of the actor''s granted projects. Set for shared accounts so a second person is limited to specific brands.';

COMMENT ON COLUMN telegram_accounts.label IS
  'Who this Telegram account belongs to. Read in the audit trail, where actor_user_id is the shared NRS account and cannot tell two people apart.';
