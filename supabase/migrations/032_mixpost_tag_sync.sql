-- Mixpost tag sync — gives NRS a way to mirror brands + hashtag_groups
-- into Mixpost's own tag system so Justin can filter the Mixpost library
-- by brand ("show me all Scent Sell drafts") and hashtag group without
-- us building a separate library UI.
--
-- Sync direction is one-way: NRS → Mixpost. We cache the Mixpost tag id
-- and uuid on the source row so creation is idempotent — subsequent calls
-- to ensureBrandTagInMixpost / ensureHashtagGroupTagInMixpost become
-- no-ops the moment the first sync succeeds.

alter table brands
  add column if not exists mixpost_tag_id integer,
  add column if not exists mixpost_tag_uuid uuid,
  add column if not exists mixpost_tag_synced_at timestamptz;

alter table hashtag_groups
  add column if not exists mixpost_tag_id integer,
  add column if not exists mixpost_tag_uuid uuid,
  add column if not exists mixpost_tag_synced_at timestamptz;

-- Comments for the auto-generated type file so future Claude sessions
-- know these columns exist without having to crawl the migration dir.
comment on column brands.mixpost_tag_id is
  'Mixpost tag id mirroring this brand''s name. Populated by ensureBrandTagInMixpost on first draft sync. Idempotent cache.';
comment on column hashtag_groups.mixpost_tag_id is
  'Mixpost tag id mirroring this hashtag group''s name. Populated by ensureHashtagGroupTagInMixpost on first POST/PATCH to /api/hashtag-groups. Idempotent cache.';
