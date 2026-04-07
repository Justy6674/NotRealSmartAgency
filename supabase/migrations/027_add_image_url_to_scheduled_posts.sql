-- Add image_url column to scheduled_posts so publish-to-social and generate-image
-- can store a direct image URL alongside or instead of media_item_id.
-- The cron publisher uses this as a fallback when media_items is not linked.

ALTER TABLE public.scheduled_posts
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.scheduled_posts.image_url IS 'Direct public URL of an image for this post. Used as fallback when media_item_id is not set.';
