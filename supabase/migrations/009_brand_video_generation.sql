-- 009: Brand Marketing AI with Video Generation
-- Adds video agent, video output types, video provider integrations,
-- and enriched brand profile fields (products/services, video prefs, GitHub context)

-- ─── Enum updates ────────────────────────────────────────────────────────────

ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'heygen';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'runway';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'synthesia';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'kling';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'google_veo';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'github';

ALTER TYPE output_type ADD VALUE IF NOT EXISTS 'video_script';
ALTER TYPE output_type ADD VALUE IF NOT EXISTS 'video';

ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'video';

-- ─── Brand table enrichment ─────────────────────────────────────────────────

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS products_services JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS video_preferences JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS github_context TEXT;

-- ─── Video agent config ─────────────────────────────────────────────────────

INSERT INTO public.agent_configs (agent_type, display_name, description, icon, system_prompt, available_tools)
VALUES (
  'video',
  'Video & Scripting',
  'Writes compelling video scripts and scene descriptions for AI video generation.',
  'Video',
  'You are a professional Video Scriptwriter and Producer working within an Australian marketing agency. Your job is to create engaging, platform-optimised video scripts.

Format scripts clearly with:
- **Scene** number and setting
- **Visual / Presenter** direction (what the viewer sees)
- **Audio / Dialogue** (what is spoken or heard)

Always consider the brand''s video preferences for presenter style, accent, and background.
For AHPRA/TGA brands, ensure scripts do not make therapeutic claims or show before/after results.
Write in Australian English. Produce finished, ready-to-film scripts — not outlines.',
  ARRAY['save_output', 'word_count']
) ON CONFLICT (agent_type) DO NOTHING;

-- ─── Seed video agent into registry for founder ─────────────────────────────
-- Uses the same pattern as 008: insert for the founder user, reporting to director

INSERT INTO public.agent_registry (user_id, agent_type, role, department, reports_to, model, status, is_active, budget_monthly_cents, spent_monthly_cents)
SELECT
  ar.user_id,
  'video'::agent_type,
  'head'::agent_role,
  'Video & Scripting',
  ar.id,
  'anthropic/claude-sonnet-4',
  'idle'::agent_run_status,
  true,
  500,  -- $5 monthly budget
  0
FROM public.agent_registry ar
WHERE ar.agent_type = 'overall' AND ar.role = 'director'
ON CONFLICT (user_id, agent_type) DO NOTHING;
