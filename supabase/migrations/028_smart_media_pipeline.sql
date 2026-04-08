-- 028: Smart Media Pipeline — collections, structured tags, usage tracking
-- Enables: grouping media into carousels/campaigns, structured tag management,
-- tracking where media has been published, AI descriptions on uploads.

-- ─── media_tags (structured tags replacing free-text) ───────────────────────

CREATE TABLE IF NOT EXISTS public.media_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  colour TEXT DEFAULT '#6366f1',
  category TEXT,  -- e.g. 'campaign', 'product', 'season', 'mood'
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,  -- NULL = global tag
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name, brand_id)
);

ALTER TABLE public.media_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own media tags"
  ON public.media_tags FOR ALL
  USING (public.is_owner_or_team_member(user_id))
  WITH CHECK (public.is_owner_or_team_member(user_id));

CREATE INDEX IF NOT EXISTS idx_media_tags_user ON public.media_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_brand ON public.media_tags(brand_id);

-- ─── media_collections (carousel sets, campaign groups) ─────────────────────

CREATE TABLE IF NOT EXISTS public.media_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  collection_type TEXT NOT NULL DEFAULT 'carousel'
    CHECK (collection_type IN ('carousel', 'campaign', 'album', 'story_set')),
  cover_image_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.media_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own media collections"
  ON public.media_collections FOR ALL
  USING (public.is_owner_or_team_member(user_id))
  WITH CHECK (public.is_owner_or_team_member(user_id));

CREATE INDEX IF NOT EXISTS idx_media_collections_brand
  ON public.media_collections(brand_id, is_archived);

CREATE TRIGGER media_collections_updated_at
  BEFORE UPDATE ON public.media_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── media_collection_items (ordered items within a collection) ─────────────

CREATE TABLE IF NOT EXISTS public.media_collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.media_collections(id) ON DELETE CASCADE,
  media_item_id UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  slide_title TEXT,
  slide_subtitle TEXT,
  slide_caption TEXT,
  slide_type TEXT NOT NULL DEFAULT 'content'
    CHECK (slide_type IN ('intro', 'content', 'quote', 'stat', 'cta', 'outro')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(collection_id, media_item_id)
);

ALTER TABLE public.media_collection_items ENABLE ROW LEVEL SECURITY;

-- RLS through parent collection
CREATE POLICY "Users can manage collection items via collection ownership"
  ON public.media_collection_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.media_collections mc
      WHERE mc.id = collection_id
        AND public.is_owner_or_team_member(mc.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.media_collections mc
      WHERE mc.id = collection_id
        AND public.is_owner_or_team_member(mc.user_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_media_collection_items_collection
  ON public.media_collection_items(collection_id, position);

-- ─── media_usage (track where media was published) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.media_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_item_id UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  used_in_type TEXT NOT NULL
    CHECK (used_in_type IN ('scheduled_post', 'carousel', 'output', 'export')),
  used_in_id UUID,
  platform TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.media_usage ENABLE ROW LEVEL SECURITY;

-- RLS through parent media item
CREATE POLICY "Users can manage media usage via media item ownership"
  ON public.media_usage FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.media_items mi
      WHERE mi.id = media_item_id
        AND public.is_owner_or_team_member(mi.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.media_items mi
      WHERE mi.id = media_item_id
        AND public.is_owner_or_team_member(mi.user_id)
    )
  );

CREATE INDEX IF NOT EXISTS idx_media_usage_item ON public.media_usage(media_item_id);
CREATE INDEX IF NOT EXISTS idx_media_usage_ref ON public.media_usage(used_in_type, used_in_id);

-- ─── Extend media_items ─────────────────────────────────────────────────────

ALTER TABLE public.media_items
  ADD COLUMN IF NOT EXISTS ai_description TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'upload'
    CHECK (source_type IN ('upload', 'generated', 'ai_image', 'screenshot', 'import'));
