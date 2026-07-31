-- Restore AI cost tracking.
--
-- `ai_usage` had no `metadata` column, but the insert in /api/chat/route.ts has
-- always carried one. PostgREST rejects the entire row when a key has no
-- matching column (PGRST204), and the insert's result was never checked — so
-- every AI call since this app was built went unrecorded. The table had zero
-- rows. The Costs dashboard had nothing to show because there was nothing.
--
-- This is the same trap as `media_items` and its non-existent `status` column,
-- documented as #CRITICAL in CLAUDE.md. Adding the column rather than dropping
-- the key, because the gateway detail it carries — tier, cache-read and
-- cache-write tokens, budget charge — is what makes spend explainable rather
-- than just a number.

ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Cost queries are always "this user, recently", so index for that shape.
CREATE INDEX IF NOT EXISTS ai_usage_user_created_idx
  ON ai_usage (user_id, created_at DESC);

COMMENT ON COLUMN ai_usage.metadata IS
  'Gateway routing detail: tier, pricing model, cache token counts, budget charge in cents.';
