-- 019: Inspiration Library — cross-industry marketing intelligence
-- Stores analysed marketing approaches from brands worth emulating.
-- Agents query this before producing campaigns to apply transferable principles.

-- ─── Inspiration Entries ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inspiration_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,                    -- e.g. "Mutimer", "Gymshark", "Notion"
  industry TEXT NOT NULL,                      -- e.g. "fashion", "fitness", "SaaS"
  platform TEXT,                               -- e.g. "tiktok", "instagram", "email"
  format TEXT,                                 -- e.g. "short_film", "carousel", "founder_video"
  what_they_did TEXT NOT NULL,                 -- factual description
  why_it_works TEXT NOT NULL,                  -- the psychological/cultural mechanic
  transferable_principle TEXT NOT NULL,         -- the abstracted rule for any brand
  applicability_tags TEXT[] DEFAULT '{}',       -- e.g. {"healthcare", "weight_loss", "subscription"}
  source_url TEXT,                             -- where to find it
  observed_at DATE DEFAULT CURRENT_DATE,       -- when this was captured
  performance_notes TEXT,                      -- feedback: did applying this work?
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspiration_user ON inspiration_entries(user_id);
CREATE INDEX idx_inspiration_tags ON inspiration_entries USING GIN(applicability_tags);
CREATE INDEX idx_inspiration_industry ON inspiration_entries(industry);

CREATE TRIGGER inspiration_updated_at
  BEFORE UPDATE ON inspiration_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE inspiration_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspiration_select" ON inspiration_entries FOR SELECT
  USING (is_owner_or_team_member(user_id));
CREATE POLICY "inspiration_insert" ON inspiration_entries FOR INSERT
  WITH CHECK (can_write_for_owner(user_id));
CREATE POLICY "inspiration_update" ON inspiration_entries FOR UPDATE
  USING (can_write_for_owner(user_id));
CREATE POLICY "inspiration_delete" ON inspiration_entries FOR DELETE
  USING (can_write_for_owner(user_id));
CREATE POLICY "service_inspiration" ON inspiration_entries FOR ALL
  USING (auth.role() = 'service_role');

-- ─── Emulation Wishlist on brands ───────────────────────────────────────────

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS emulation_wishlist JSONB DEFAULT '[]';
-- Structure: [{ "brand": "Mutimer", "why": "World-building, founder voice, cinematic narrative" }]

-- ─── Brand DNA Constraints (upgrade from adjective-based tone_of_voice) ─────

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS brand_dna_constraints JSONB DEFAULT '{}';
-- Structure:
-- {
--   "voice_rules": [
--     "Never use exclamation marks in clinical content",
--     "Always lead with patient experience before clinical data",
--     "Use 'you' before 'we' in all copy"
--   ],
--   "banned_words": ["amazing", "breakthrough", "revolutionary", "secret", "simple", "guaranteed"],
--   "founder_voice": { "name": "Justin Black NP", "platforms": ["tiktok", "instagram"], "framing": "first_person" },
--   "content_philosophy": "storytelling_first",
--   "never_do": ["before_after_images", "testimonials_in_ads", "guaranteed_outcomes"],
--   "narrative_world": "Empowering Australians to take control of their health through accessible, evidence-based telehealth"
-- }
