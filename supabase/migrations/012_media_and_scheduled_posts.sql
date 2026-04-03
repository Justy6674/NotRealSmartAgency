-- 012: Create media_items and scheduled_posts tables
-- These were referenced in code but never created, blocking the entire CAM pipeline

-- ─── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE media_status AS ENUM ('pending', 'transcribing', 'transcribed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE post_platform AS ENUM ('instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE scheduled_post_status AS ENUM ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── media_items ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT,
  duration_seconds NUMERIC,
  thumbnail_url TEXT,
  transcription TEXT,
  transcription_model TEXT,
  transcription_status media_status NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_items_user_id ON public.media_items(user_id);
CREATE INDEX IF NOT EXISTS idx_media_items_brand_id ON public.media_items(brand_id);
CREATE INDEX IF NOT EXISTS idx_media_items_status ON public.media_items(transcription_status);

-- RLS
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own media items"
  ON public.media_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER media_items_updated_at
  BEFORE UPDATE ON public.media_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── scheduled_posts ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  media_item_id UUID REFERENCES public.media_items(id) ON DELETE SET NULL,
  output_id UUID REFERENCES public.outputs(id) ON DELETE SET NULL,
  platform post_platform NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  status scheduled_post_status NOT NULL DEFAULT 'draft',
  external_post_id TEXT,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id ON public.scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_brand_id ON public.scheduled_posts(brand_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON public.scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON public.scheduled_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_scheduled ON public.scheduled_posts(status, scheduled_at)
  WHERE status = 'scheduled';

-- RLS
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scheduled posts"
  ON public.scheduled_posts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER scheduled_posts_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
