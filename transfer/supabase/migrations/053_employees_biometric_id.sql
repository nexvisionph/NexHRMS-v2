-- ============================================================
-- 053_employees_biometric_id.sql
-- Link HRMS employees to the physical biometric scanner user ID
-- ============================================================

ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS biometric_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_biometric_id_unique
    ON public.employees (biometric_id)
    WHERE biometric_id IS NOT NULL AND biometric_id <> '';
