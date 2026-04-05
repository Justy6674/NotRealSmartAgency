-- Add content tagging columns for strategy tracking
ALTER TABLE scheduled_posts
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS content_pillar TEXT;

ALTER TABLE outputs
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS content_pillar TEXT;

COMMENT ON COLUMN scheduled_posts.content_type IS 'entertainment | education | inspiration | promotional';
COMMENT ON COLUMN scheduled_posts.content_pillar IS 'Content pillar from brand content_pillars array';
COMMENT ON COLUMN outputs.content_type IS 'entertainment | education | inspiration | promotional';
COMMENT ON COLUMN outputs.content_pillar IS 'Content pillar from brand content_pillars array';
