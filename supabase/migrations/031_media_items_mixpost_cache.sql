-- ─── Mixpost media cache ──────────────────────────────────────────────────
-- First time we publish a media_item via Mixpost, Mixpost transcodes the
-- source to standardised MP4 (takes ~6 minutes for a 141 MB video — two-pass
-- libx264). Once done, Mixpost returns a numeric media id we can reuse
-- forever. Cache it so subsequent publishes skip the 382-second round-trip.

alter table media_items
  add column if not exists mixpost_media_id integer,
  add column if not exists mixpost_media_uuid text,
  add column if not exists mixpost_cached_at timestamptz;

create index if not exists idx_media_items_mixpost_media_id on media_items(mixpost_media_id)
  where mixpost_media_id is not null;

comment on column media_items.mixpost_media_id is 'Numeric Mixpost media id after first successful upload — cache to skip re-upload on subsequent publishes';
comment on column media_items.mixpost_media_uuid is 'Mixpost media UUID (companion to numeric id)';

-- Seed the Hibiscus Mahajad video that was manually transcoded during
-- the 2026-04-09 test run — so the Director can use it immediately.
update media_items
set
  mixpost_media_id = 39,
  mixpost_media_uuid = 'b6e787e3-7c43-43a8-94d2-5b44271bcf42',
  mixpost_cached_at = '2026-04-09 09:46:38+00'
where id = '4940c11e-706a-4048-86e0-308be1e37142';
