-- ============================================================
-- 018: Make appearance_config tenant-aware (scaffold)
-- This adds a nullable `company_id` to `appearance_config` and backfills
-- with the default company created in 017. Do not mark NOT NULL or add FK
-- until you've verified app behavior and backfilled tenant data.
-- ============================================================

ALTER TABLE IF EXISTS public.appearance_config
  ADD COLUMN IF NOT EXISTS company_id text;

CREATE INDEX IF NOT EXISTS idx_appearance_config_company_id ON public.appearance_config(company_id);

-- Backfill existing rows to the default company
UPDATE public.appearance_config SET company_id = 'default' WHERE company_id IS NULL;

-- Recommendation: After validating, consider making `id` a per-company key or
-- moving to rows keyed by (company_id) with a unique constraint on company_id.
-- Example:
-- ALTER TABLE public.appearance_config ADD CONSTRAINT appearance_config_company_unique UNIQUE (company_id);

-- End of migration 018.
