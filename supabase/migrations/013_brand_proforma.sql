-- 013: Master Marketing Proforma — living document per brand
-- Two tables: structured sections + conversation log

-- =============================================================================
-- 1. brand_proforma_sections — structured JSONB sections with RAG status
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.brand_proforma_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_title TEXT NOT NULL,
  section_data JSONB NOT NULL DEFAULT '{}',
  rag_status TEXT DEFAULT 'unknown', -- red / amber / green / unknown
  review_cadence TEXT DEFAULT 'monthly', -- weekly / fortnightly / monthly / quarterly
  last_reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand_id, section_key)
);

CREATE INDEX idx_proforma_brand ON brand_proforma_sections(brand_id);
CREATE INDEX idx_proforma_stale ON brand_proforma_sections(brand_id, updated_at);

ALTER TABLE brand_proforma_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own brand proformas" ON brand_proforma_sections FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()))
  WITH CHECK (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE TRIGGER proforma_sections_updated_at
  BEFORE UPDATE ON brand_proforma_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- 2. brand_conversation_log — summary of every meaningful conversation
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.brand_conversation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  decisions TEXT[], -- key decisions made
  action_items TEXT[], -- things to do
  wins TEXT[], -- wins recorded
  learnings TEXT[], -- learnings captured
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_convo_log_brand ON brand_conversation_log(brand_id);

ALTER TABLE brand_conversation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conversation logs" ON brand_conversation_log FOR ALL
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()))
  WITH CHECK (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
