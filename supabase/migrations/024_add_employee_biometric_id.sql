-- ============================================================
-- 024: Add biometric_id to employees
-- ============================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS biometric_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_biometric_id
  ON public.employees (biometric_id);
