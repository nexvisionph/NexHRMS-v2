-- =====================================================
-- RESET SCRIPT: Cleans up partial 045 migration state
-- =====================================================
-- Run this BEFORE re-running 045_payroll_simplification.sql
-- if the migration failed partway through.
-- =====================================================

BEGIN;

-- 1. Drop the new tables if they exist
DROP TABLE IF EXISTS public.payslip_line_items CASCADE;
DROP TABLE IF EXISTS public.employee_deduction_assignments CASCADE;
DROP TABLE IF EXISTS public.deduction_templates CASCADE;

-- 2. Drop ALL check constraints on payslips.status
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'payslips'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.payslips DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped payslips constraint: %', r.conname;
  END LOOP;
END $$;

-- 3. Drop ALL check constraints on payroll_runs.status
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'payroll_runs'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.payroll_runs DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Dropped payroll_runs constraint: %', r.conname;
  END LOOP;
END $$;

-- 4. Drop new columns if they exist
ALTER TABLE public.payslips DROP COLUMN IF EXISTS custom_deductions;
ALTER TABLE public.payslips DROP COLUMN IF EXISTS line_items_json;
ALTER TABLE public.employees DROP COLUMN IF EXISTS deduction_exempt;
ALTER TABLE public.employees DROP COLUMN IF EXISTS deduction_exempt_reason;
ALTER TABLE public.payroll_runs DROP COLUMN IF EXISTS completed_at;

-- 5. Drop indexes
DROP INDEX IF EXISTS public.idx_deduction_templates_active;
DROP INDEX IF EXISTS public.idx_eda_employee;
DROP INDEX IF EXISTS public.idx_eda_template;
DROP INDEX IF EXISTS public.idx_pli_payslip;
DROP INDEX IF EXISTS public.idx_employees_deduction_exempt;

-- 6. Restore original payslips status constraint (the old values)
-- This is optional - the 045 migration will handle any status values
-- ALTER TABLE public.payslips ADD CONSTRAINT payslips_status_check 
--   CHECK (status IN ('issued', 'confirmed', 'published', 'paid', 'acknowledged'));

-- 7. Restore original payroll_runs status constraint (the old values)
-- This is optional - the 045 migration will handle any status values
-- ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_status_check 
--   CHECK (status IN ('draft', 'validated', 'locked', 'published', 'paid'));

COMMIT;

-- =====================================================
-- After running this script, run 045_payroll_simplification.sql
-- =====================================================
