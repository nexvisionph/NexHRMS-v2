-- =====================================================
-- Migration 055: Client Feature Pack
-- =====================================================
-- Adds DB foundation for 5 client-requested features:
--   1. Late/Absent/Undertime auto-deduction in payslips
--   2. Customizable payroll run period (period_start/end)
--   3. Editable OT threshold + multipliers
--   4. Per-project fixed QR codes
--   5. Employee bulk import/export (no schema change required)
--
-- Style: 100% additive, idempotent (IF NOT EXISTS), reversible-safe.
-- Safe to re-run. No DROP statements.
-- =====================================================

BEGIN;

-- ──────────────────────────────────────────────────────
-- STEP 0: Pre-flight — abort if prerequisite tables missing
-- ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='attendance_rule_sets') THEN
    RAISE EXCEPTION '[055] ABORTED: public.attendance_rule_sets missing. Run migration 004 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payroll_runs') THEN
    RAISE EXCEPTION '[055] ABORTED: public.payroll_runs missing. Run migration 006 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pay_schedule_config') THEN
    RAISE EXCEPTION '[055] ABORTED: public.pay_schedule_config missing. Run migration 010 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payslips') THEN
    RAISE EXCEPTION '[055] ABORTED: public.payslips missing. Run migration 006 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='projects') THEN
    RAISE EXCEPTION '[055] ABORTED: public.projects missing. Run migration 010 first.';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────
-- FEATURE 3: OT multipliers on attendance_rule_sets
-- ──────────────────────────────────────────────────────
ALTER TABLE public.attendance_rule_sets
  ADD COLUMN IF NOT EXISTS ot_multiplier_regular          numeric NOT NULL DEFAULT 1.25,
  ADD COLUMN IF NOT EXISTS ot_multiplier_rest_day         numeric NOT NULL DEFAULT 1.30,
  ADD COLUMN IF NOT EXISTS ot_multiplier_special_holiday  numeric NOT NULL DEFAULT 1.30,
  ADD COLUMN IF NOT EXISTS ot_multiplier_regular_holiday  numeric NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS ot_multiplier_night_diff       numeric NOT NULL DEFAULT 1.10;

COMMENT ON COLUMN public.attendance_rule_sets.ot_multiplier_regular         IS 'OT pay multiplier on a regular workday (DOLE default 1.25)';
COMMENT ON COLUMN public.attendance_rule_sets.ot_multiplier_rest_day        IS 'OT pay multiplier on rest day (DOLE default 1.30)';
COMMENT ON COLUMN public.attendance_rule_sets.ot_multiplier_special_holiday IS 'OT pay multiplier on special non-working holiday (DOLE default 1.30)';
COMMENT ON COLUMN public.attendance_rule_sets.ot_multiplier_regular_holiday IS 'OT pay multiplier on regular holiday (DOLE default 2.00)';
COMMENT ON COLUMN public.attendance_rule_sets.ot_multiplier_night_diff      IS 'Night differential multiplier (DOLE default 1.10)';

-- ──────────────────────────────────────────────────────
-- FEATURE 2: Period dates on payroll_runs
-- ──────────────────────────────────────────────────────
ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end   date;

COMMENT ON COLUMN public.payroll_runs.period_start IS 'Cut-off start date for this payroll run (used to filter attendance)';
COMMENT ON COLUMN public.payroll_runs.period_end   IS 'Cut-off end date for this payroll run';

-- Back-fill period dates from associated payslips (only where NULL).
-- Uses payroll_run_payslips junction table (created in migration 028).
UPDATE public.payroll_runs pr
SET period_start = sub.min_start,
    period_end   = sub.max_end
FROM (
  SELECT prp.run_id,
         MIN(p.period_start) AS min_start,
         MAX(p.period_end)   AS max_end
  FROM public.payroll_run_payslips prp
  JOIN public.payslips p ON p.id = prp.payslip_id
  GROUP BY prp.run_id
) sub
WHERE pr.id = sub.run_id
  AND (pr.period_start IS NULL OR pr.period_end IS NULL);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period
  ON public.payroll_runs(period_start, period_end);

-- ──────────────────────────────────────────────────────
-- FEATURE 1 & 3: Auto-deduction toggles + work-days config
-- ──────────────────────────────────────────────────────
ALTER TABLE public.pay_schedule_config
  ADD COLUMN IF NOT EXISTS auto_deduct_late      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_deduct_absent    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_deduct_undertime boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_add_overtime     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS work_days_per_month   integer NOT NULL DEFAULT 22 CHECK (work_days_per_month BETWEEN 1 AND 31);

COMMENT ON COLUMN public.pay_schedule_config.auto_deduct_late      IS 'When true, payroll engine auto-deducts late minutes from payslip';
COMMENT ON COLUMN public.pay_schedule_config.auto_deduct_absent    IS 'When true, payroll engine auto-deducts absent days from payslip';
COMMENT ON COLUMN public.pay_schedule_config.auto_deduct_undertime IS 'When true, payroll engine auto-deducts undertime hours (shift_hours - actual_hours)';
COMMENT ON COLUMN public.pay_schedule_config.auto_add_overtime     IS 'When true, payroll engine auto-adds approved OT hours to payslip earnings';
COMMENT ON COLUMN public.pay_schedule_config.work_days_per_month   IS 'Used to compute daily_rate from monthly salary (default 22)';

-- ──────────────────────────────────────────────────────
-- FEATURE 1 & 3: Itemized deduction & rate snapshot fields on payslips
-- ──────────────────────────────────────────────────────
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS late_deduction       numeric NOT NULL DEFAULT 0 CHECK (late_deduction       >= 0),
  ADD COLUMN IF NOT EXISTS absent_deduction     numeric NOT NULL DEFAULT 0 CHECK (absent_deduction     >= 0),
  ADD COLUMN IF NOT EXISTS undertime_deduction  numeric NOT NULL DEFAULT 0 CHECK (undertime_deduction  >= 0),
  ADD COLUMN IF NOT EXISTS overtime_pay         numeric NOT NULL DEFAULT 0 CHECK (overtime_pay         >= 0),
  ADD COLUMN IF NOT EXISTS daily_rate           numeric NOT NULL DEFAULT 0 CHECK (daily_rate           >= 0),
  ADD COLUMN IF NOT EXISTS hourly_rate          numeric NOT NULL DEFAULT 0 CHECK (hourly_rate          >= 0);

COMMENT ON COLUMN public.payslips.late_deduction      IS 'Auto-computed late-arrival deduction (late_minutes/60 * hourly_rate)';
COMMENT ON COLUMN public.payslips.absent_deduction    IS 'Auto-computed absent-day deduction (absent_days * daily_rate)';
COMMENT ON COLUMN public.payslips.undertime_deduction IS 'Auto-computed undertime deduction ((shift_hours - actual_hours) * hourly_rate)';
COMMENT ON COLUMN public.payslips.overtime_pay        IS 'Auto-computed OT earnings from approved overtime_requests within period';
COMMENT ON COLUMN public.payslips.daily_rate          IS 'Snapshot of daily_rate at payslip issuance';
COMMENT ON COLUMN public.payslips.hourly_rate         IS 'Snapshot of hourly_rate at payslip issuance';

-- ──────────────────────────────────────────────────────
-- FEATURE 4: Per-project fixed QR secret + enable flag
-- ──────────────────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS qr_secret  text,
  ADD COLUMN IF NOT EXISTS qr_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.projects.qr_secret  IS 'Per-project nonce used by QR HMAC. Server-only; never sent to unauthenticated clients.';
COMMENT ON COLUMN public.projects.qr_enabled IS 'When false, project QR scans are rejected by the kiosk';

-- Back-fill qr_secret for existing projects (24 random bytes -> base64).
-- Uses pgcrypto's gen_random_bytes (extension created in migration 001).
UPDATE public.projects
SET qr_secret = encode(gen_random_bytes(24), 'base64')
WHERE qr_secret IS NULL;

-- Enforce qr_secret presence going forward
ALTER TABLE public.projects
  ALTER COLUMN qr_secret SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_qr_secret_unique
  ON public.projects(qr_secret);

-- ──────────────────────────────────────────────────────
-- POST-FLIGHT: Self-validation
-- ──────────────────────────────────────────────────────
DO $$
DECLARE
  missing_count int := 0;
BEGIN
  -- Verify every new column exists
  SELECT COUNT(*) INTO missing_count FROM (VALUES
    ('attendance_rule_sets', 'ot_multiplier_regular'),
    ('attendance_rule_sets', 'ot_multiplier_rest_day'),
    ('attendance_rule_sets', 'ot_multiplier_special_holiday'),
    ('attendance_rule_sets', 'ot_multiplier_regular_holiday'),
    ('attendance_rule_sets', 'ot_multiplier_night_diff'),
    ('payroll_runs', 'period_start'),
    ('payroll_runs', 'period_end'),
    ('pay_schedule_config', 'auto_deduct_late'),
    ('pay_schedule_config', 'auto_deduct_absent'),
    ('pay_schedule_config', 'auto_deduct_undertime'),
    ('pay_schedule_config', 'auto_add_overtime'),
    ('pay_schedule_config', 'work_days_per_month'),
    ('payslips', 'late_deduction'),
    ('payslips', 'absent_deduction'),
    ('payslips', 'undertime_deduction'),
    ('payslips', 'overtime_pay'),
    ('payslips', 'daily_rate'),
    ('payslips', 'hourly_rate'),
    ('projects', 'qr_secret'),
    ('projects', 'qr_enabled')
  ) AS expected(t, c)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = expected.t
      AND column_name = expected.c
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION '[055] ABORTED: % expected columns missing after migration', missing_count;
  END IF;

  -- Verify every project has a qr_secret
  IF EXISTS (SELECT 1 FROM public.projects WHERE qr_secret IS NULL OR qr_secret = '') THEN
    RAISE EXCEPTION '[055] ABORTED: at least one project still has NULL/empty qr_secret after back-fill';
  END IF;

  RAISE NOTICE '[055] OK: all % expected columns present and projects back-filled', 20;
END $$;

COMMIT;
