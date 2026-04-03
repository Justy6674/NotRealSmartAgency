-- 010: Brand Review — marketing status tracking for brand audit workflow

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS marketing_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS marketing_notes TEXT;
