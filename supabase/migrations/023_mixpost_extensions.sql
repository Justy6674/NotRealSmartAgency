-- 023: Mixpost integration extensions
-- Adds Mixpost tag IDs to scheduled posts for cross-system tagging

ALTER TABLE scheduled_posts
  ADD COLUMN IF NOT EXISTS mixpost_tag_ids INTEGER[] DEFAULT '{}';
