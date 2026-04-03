-- 011: Content Automation Machine — media upload, transcription, scheduling, publishing

-- ─── Enum updates ────────────────────────────────────────────────────────────

ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'deepgram';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'instagram_business';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'facebook_page';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'linkedin_company';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'twitter_app';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'tiktok_business';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'youtube_channel';
ALTER TYPE integration_provider ADD VALUE IF NOT EXISTS 'ayrshare';

ALTER TYPE output_type ADD VALUE IF NOT EXISTS 'scheduled_post';
