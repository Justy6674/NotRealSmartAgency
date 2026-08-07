-- How a brand's name is written, held as data rather than guessed.
--
-- `brands.name` was the only thing anything knew, so it was doing three jobs at
-- once: the display name, the full form to use when writing the business out
-- properly, and the authority for correcting a mis-heard mention. It could not
-- do all three, and the result was the owner reading his own company's name
-- spelt wrong in copy his marketing platform had written.
--
--   name        the wordmark, exactly as it must always appear ("Scent Sell")
--   name_full   the whole thing, for a first mention or an introduction
--               ("Scent Sell Fragrance Marketplace in Australia")
--   name_never  spellings that MEAN this brand but must never be printed —
--               run-together forms, and whatever speech-to-text keeps hearing.
--               Everything here is normalised to `name` wherever it appears.

ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS name_full TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS name_never TEXT[] DEFAULT NULL;

COMMENT ON COLUMN brands.name IS
  'The wordmark, exactly as it must always be written. Every writer and every transcript is normalised to this.';

COMMENT ON COLUMN brands.name_full IS
  'The full descriptive name, for a first mention or an introduction. Null means use `name`.';

COMMENT ON COLUMN brands.name_never IS
  'Spellings that mean this brand but must never be printed — run-together forms and known speech-to-text mishearings. Normalised to `name` in transcripts and forbidden in prompts.';
