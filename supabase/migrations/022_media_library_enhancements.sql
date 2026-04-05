-- 022: Smart Media Library — tags, creation date, uploader, archive
-- Adds tagging, file creation date tracking, uploader attribution, and soft archive

ALTER TABLE media_items ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS file_created_at TIMESTAMPTZ;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- GIN index for tag array containment queries
CREATE INDEX IF NOT EXISTS idx_media_items_tags ON media_items USING GIN (tags);

-- Composite index for the most common query: active media for a brand
CREATE INDEX IF NOT EXISTS idx_media_items_brand_archived ON media_items(brand_id, is_archived);
