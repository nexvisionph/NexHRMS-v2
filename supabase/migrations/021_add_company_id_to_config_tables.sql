-- ============================================================
-- 021: Add company_id to configuration tables
-- This adds nullable company_id to global config tables that should
-- be tenant-aware (location, pay schedule, deductions, etc).
-- ============================================================

-- Location configuration (per-company)
ALTER TABLE IF EXISTS public.location_config
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_location_config_company_id ON public.location_config(company_id);
UPDATE public.location_config SET company_id = 'default' WHERE company_id IS NULL;

-- Pay schedule configuration (per-company)
ALTER TABLE IF EXISTS public.pay_schedule_config
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_pay_schedule_config_company_id ON public.pay_schedule_config(company_id);
UPDATE public.pay_schedule_config SET company_id = 'default' WHERE company_id IS NULL;

-- Payroll signature configuration (per-company)
ALTER TABLE IF EXISTS public.payroll_signature_config
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_payroll_signature_config_company_id ON public.payroll_signature_config(company_id);
UPDATE public.payroll_signature_config SET company_id = 'default' WHERE company_id IS NULL;

-- Deduction global defaults (per-company)
ALTER TABLE IF EXISTS public.deduction_global_defaults
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_deduction_global_defaults_company_id ON public.deduction_global_defaults(company_id);
UPDATE public.deduction_global_defaults SET company_id = 'default' WHERE company_id IS NULL;

-- Deduction templates (per-company)
ALTER TABLE IF EXISTS public.deduction_templates
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_deduction_templates_company_id ON public.deduction_templates(company_id);
UPDATE public.deduction_templates SET company_id = 'default' WHERE company_id IS NULL;

-- End of migration 021.
