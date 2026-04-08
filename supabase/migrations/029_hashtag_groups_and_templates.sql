-- 029: Hashtag groups and post templates
-- Reusable content building blocks for the Creative Studio

-- ─── Hashtag Groups ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hashtag_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,  -- e.g. 'core', 'campaign', 'seasonal', 'niche'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hashtag_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own hashtag groups"
  ON public.hashtag_groups FOR ALL
  USING (public.is_owner_or_team_member(user_id))
  WITH CHECK (public.is_owner_or_team_member(user_id));

CREATE INDEX IF NOT EXISTS idx_hashtag_groups_brand ON public.hashtag_groups(brand_id);

CREATE TRIGGER hashtag_groups_updated_at
  BEFORE UPDATE ON public.hashtag_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Post Templates ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  caption_template TEXT NOT NULL,  -- supports {brand}, {date}, {product} etc.
  default_hashtags TEXT[] NOT NULL DEFAULT '{}',
  platform TEXT,  -- NULL = all platforms
  variables JSONB NOT NULL DEFAULT '[]',  -- [{key: 'product', label: 'Product name', default: ''}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.post_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own post templates"
  ON public.post_templates FOR ALL
  USING (public.is_owner_or_team_member(user_id))
  WITH CHECK (public.is_owner_or_team_member(user_id));

CREATE INDEX IF NOT EXISTS idx_post_templates_brand ON public.post_templates(brand_id);

CREATE TRIGGER post_templates_updated_at
  BEFORE UPDATE ON public.post_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
