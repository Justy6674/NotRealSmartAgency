-- Which Vercel project serves each brand's website.
--
-- NRS could see how FAST a site was (a weekly PageSpeed check) but had no idea
-- whether anyone visited it. "How are we performing?" counted posts published,
-- not people who turned up — activity, not audience.
--
-- Stored as the project NAME and team slug rather than the prj_… id: the names
-- are what a person recognises in the Vercel dashboard, and the API resolves a
-- name to an id, so a readable value costs nothing.

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS vercel_project TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vercel_team TEXT DEFAULT NULL;

COMMENT ON COLUMN brands.vercel_project IS
  'Vercel project name serving this brand''s website, e.g. scent-australia. Null means site traffic cannot be read for this brand.';

COMMENT ON COLUMN brands.vercel_team IS
  'Vercel team slug that owns the project. Null for a personal-account project.';
