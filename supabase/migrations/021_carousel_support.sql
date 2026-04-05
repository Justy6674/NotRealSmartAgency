-- 021: Carousel and multi-media support for scheduled posts
-- Adds post_type (single/carousel/reel/video) and media_item_ids (UUID array)
-- Backward compatible: existing rows get post_type='single' and empty array

ALTER TABLE scheduled_posts
  ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'single'
    CHECK (post_type IN ('single', 'carousel', 'reel', 'video'));

ALTER TABLE scheduled_posts
  ADD COLUMN IF NOT EXISTS media_item_ids UUID[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_post_type
  ON scheduled_posts(post_type);
