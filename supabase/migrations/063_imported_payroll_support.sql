-- =====================================================
-- Migration 063: Imported Payroll Support
-- =====================================================
-- Adds DB foundation for importing externally-computed payslips
-- (PB / NexHRIS / generic XLSX) and surfacing them on receipts.
--
--   1. Tag payslips/runs that originate from an imported file
--   2. Store DTR (attendance) summary + per-day rows ON the payslip
--      for receipt rendering ONLY — never written to attendance_logs
--
-- Style: 100% additive, idempotent (IF NOT EXISTS), no DROP.
-- All columns nullable / defaulted so existing rows are unaffected.
-- =====================================================

BEGIN;

-- ──────────────────────────────────────────────────────
-- STEP 0: Pre-flight — abort if prerequisite tables missing
-- ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payslips') THEN
    RAISE EXCEPTION '[063] ABORTED: public.payslips missing. Run migration 006 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payroll_runs') THEN
    RAISE EXCEPTION '[063] ABORTED: public.payroll_runs missing. Run migration 006 first.';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────
-- STEP 1: Imported-source tagging + DTR snapshot on payslips
-- ──────────────────────────────────────────────────────
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS source              text NOT NULL DEFAULT 'system'
                           CHECK (source IN ('system','imported')),
  ADD COLUMN IF NOT EXISTS computed_externally boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS imported_file_name  text,
  ADD COLUMN IF NOT EXISTS imported_at         timestamptz,
  ADD COLUMN IF NOT EXISTS dtr_days_present    numeric,
  ADD COLUMN IF NOT EXISTS dtr_days_absent     numeric,
  ADD COLUMN IF NOT EXISTS dtr_late_minutes    numeric,
  ADD COLUMN IF NOT EXISTS dtr_ot_hours        numeric,
  ADD COLUMN IF NOT EXISTS dtr_tard_hours      numeric,
  ADD COLUMN IF NOT EXISTS dtr_per_day_json    jsonb;

COMMENT ON COLUMN public.payslips.source              IS 'system = computed in-app; imported = figures came from an uploaded file (final, not recomputed)';
COMMENT ON COLUMN public.payslips.computed_externally IS 'When true, payroll engine must NOT recompute this payslip from attendance';
COMMENT ON COLUMN public.payslips.imported_file_name  IS 'Original filename of the imported payroll file (shown on the receipt banner)';
COMMENT ON COLUMN public.payslips.imported_at         IS 'Timestamp the payslip was imported';
COMMENT ON COLUMN public.payslips.dtr_days_present    IS 'Imported DTR summary — receipt only, never written to attendance_logs';
COMMENT ON COLUMN public.payslips.dtr_days_absent     IS 'Imported DTR summary — receipt only, never written to attendance_logs';
COMMENT ON COLUMN public.payslips.dtr_late_minutes    IS 'Imported DTR summary — receipt only, never written to attendance_logs';
COMMENT ON COLUMN public.payslips.dtr_ot_hours        IS 'Imported DTR summary — receipt only, never written to attendance_logs';
COMMENT ON COLUMN public.payslips.dtr_tard_hours      IS 'Imported DTR summary — receipt only, never written to attendance_logs';
COMMENT ON COLUMN public.payslips.dtr_per_day_json    IS 'Imported per-day DTR rows if the file provided them — receipt only';

-- ──────────────────────────────────────────────────────
-- STEP 2: Imported-source tagging on payroll_runs
-- ──────────────────────────────────────────────────────
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS source             text NOT NULL DEFAULT 'system'
                           CHECK (source IN ('system','imported')),
  ADD COLUMN IF NOT EXISTS imported_file_name text;

COMMENT ON COLUMN public.payroll_runs.source             IS 'system = created by in-app payroll flow; imported = created from an uploaded payroll file';
COMMENT ON COLUMN public.payroll_runs.imported_file_name IS 'Original filename of the imported payroll file';

-- ──────────────────────────────────────────────────────
-- STEP 3: Validation
-- ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payslips' AND column_name='source') THEN
    RAISE EXCEPTION '[063 VALIDATE] payslips.source missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payslips' AND column_name='dtr_per_day_json') THEN
    RAISE EXCEPTION '[063 VALIDATE] payslips.dtr_per_day_json missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payroll_runs' AND column_name='source') THEN
    RAISE EXCEPTION '[063 VALIDATE] payroll_runs.source missing';
  END IF;
  RAISE NOTICE '[063] Imported payroll support applied successfully.';
END $$;

COMMIT;

-- =====================================================
-- Done. Imported payroll support ready.
-- =====================================================
