-- 018: Channel Strategy — the Marketing DNA for each brand
-- Defines channel allocation, content mix, posting frequency, and growth approach.
-- This is the heartbeat that drives ALL content generation, scheduling, and publishing.

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS channel_strategy JSONB DEFAULT '{}';

-- Structure:
-- {
--   "channels": {
--     "linkedin": 30,
--     "youtube": 25,
--     "instagram": 20,
--     "facebook": 15,
--     "tiktok": 10,
--     "twitter": 0,
--     "reddit": 0
--   },
--   "content_mix": {
--     "educational": 40,
--     "product": 25,
--     "behind_the_scenes": 15,
--     "social_proof": 10,
--     "engagement": 10
--   },
--   "posting_frequency": "daily",
--   "avoid": ["email_campaigns", "google_ads"],
--   "growth_approach": "organic",
--   "aeo_priority": true,
--   "notes": "Reddit does the work for weight loss organically"
-- }
