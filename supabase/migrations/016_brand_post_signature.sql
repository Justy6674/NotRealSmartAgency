-- 016: Brand Post Signature
-- Configurable signature/attribution appended to all agency-produced content

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS post_signature JSONB DEFAULT '{}';

-- Structure:
-- {
--   "enabled": true,
--   "text": "Developed by Not Real (Artificial) Smart (Intelligence) - Agentic Marketing Agency",
--   "format": "text" | "mention" | "hashtag",
--   "mention": "@notrealsmart",
--   "hashtag": "#NotRealSmart",
--   "banner_url": "/NRS Banner (1000 x 100 mm).png"
-- }
