-- ============================================================
-- 066_payroll_rules_engine.sql
-- Payroll Rules Engine — Configurable compliance modes & OT multipliers
-- Tables: payroll_rules
-- ============================================================

BEGIN;

-- ─── Pre-flight ───────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees') THEN
    RAISE EXCEPTION '[066] ABORTED: public.employees missing. Run 001-002 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ot_settings') THEN
    RAISE EXCEPTION '[066] ABORTED: public.ot_settings missing. Run 065 first.';
  END IF;
END $$;

-- ─── payroll_rules ────────────────────────────────────────────
-- One row per company (or one global 'default' row).
-- Stores the compliance mode and all OT/payroll multipliers.
-- Payroll computation MUST read from here — no hardcoded values.
CREATE TABLE IF NOT EXISTS public.payroll_rules (
    id                          text PRIMARY KEY DEFAULT 'default',
    company_id                  text,

    -- ─── Compliance Mode ──────────────────────────────────────
    -- 'ph_dole'  = Philippine DOLE standard (protected defaults, can still be overridden)
    -- 'custom'   = Company-specific policy (admin responsibility)
    compliance_mode             text NOT NULL DEFAULT 'ph_dole'
                                CHECK (compliance_mode IN ('ph_dole', 'custom')),

    -- ─── OT Multipliers (total multiplier applied to hourly rate) ─
    -- DOLE PH formula: OT pay = hourly_rate × approved_ot_hours × multiplier
    -- Regular day OT: 1.25 (base 1.00 + 25% premium)
    -- Set to 1.00 to disable OT premium (company policy)
    regular_ot_multiplier       numeric(5,4) NOT NULL DEFAULT 1.25 CHECK (regular_ot_multiplier >= 0),
    restday_ot_multiplier       numeric(5,4) NOT NULL DEFAULT 1.30 CHECK (restday_ot_multiplier >= 0),
    special_holiday_multiplier  numeric(5,4) NOT NULL DEFAULT 1.30 CHECK (special_holiday_multiplier >= 0),
    regular_holiday_multiplier  numeric(5,4) NOT NULL DEFAULT 2.00 CHECK (regular_holiday_multiplier >= 0),
    restday_holiday_multiplier  numeric(5,4) NOT NULL DEFAULT 1.50 CHECK (restday_holiday_multiplier >= 0),

    -- ─── Night Differential ───────────────────────────────────
    -- DOLE: +10% of hourly rate for work between 10PM–6AM
    night_diff_multiplier       numeric(5,4) NOT NULL DEFAULT 1.10 CHECK (night_diff_multiplier >= 1),
    enable_night_diff           boolean NOT NULL DEFAULT true,
    night_diff_start            text NOT NULL DEFAULT '22:00',  -- HH:mm
    night_diff_end              text NOT NULL DEFAULT '06:00',  -- HH:mm

    -- ─── OT Threshold & Rounding ──────────────────────────────
    minimum_ot_minutes          integer NOT NULL DEFAULT 30 CHECK (minimum_ot_minutes >= 0),
    grace_period_minutes        integer NOT NULL DEFAULT 0  CHECK (grace_period_minutes >= 0),
    rounding_rule               text NOT NULL DEFAULT 'none'
                                CHECK (rounding_rule IN ('none', 'nearest_15', 'nearest_30', 'floor_15', 'floor_30')),

    -- ─── Review & Approval Gates ──────────────────────────────
    require_ot_review           boolean NOT NULL DEFAULT true,
    require_supervisor_review   boolean NOT NULL DEFAULT false,
    allow_partial_ot            boolean NOT NULL DEFAULT true,
    include_pending_in_payroll  boolean NOT NULL DEFAULT false,

    -- ─── Work Days Divisor ────────────────────────────────────
    -- daily_rate = monthly_salary / work_days_divisor
    -- DOLE PH basis: 313 working days / 12 months ≈ 26.09 (for 6-day work week)
    -- Common use: 22 (5-day), 26 (6-day)
    work_days_divisor           numeric(5,2) NOT NULL DEFAULT 22.00 CHECK (work_days_divisor > 0),
    hours_per_day               numeric(4,2) NOT NULL DEFAULT 8.00  CHECK (hours_per_day > 0),

    -- ─── Audit ────────────────────────────────────────────────
    -- Snapshot of who last confirmed compliance mode change
    compliance_mode_confirmed_by text,
    compliance_mode_confirmed_at timestamptz,

    created_by                  text,
    updated_by                  text,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_rules_company ON public.payroll_rules(company_id);

ALTER TABLE public.payroll_rules ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_payroll_rules_updated_at ON public.payroll_rules;
CREATE TRIGGER set_payroll_rules_updated_at
    BEFORE UPDATE ON public.payroll_rules
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS: everyone can read (used at payroll compute time)
DROP POLICY IF EXISTS payroll_rules_read_policy ON public.payroll_rules;
CREATE POLICY payroll_rules_read_policy ON public.payroll_rules FOR SELECT USING (true);

-- RLS: admin/hr/payroll_admin can write
DROP POLICY IF EXISTS payroll_rules_write_policy ON public.payroll_rules;
CREATE POLICY payroll_rules_write_policy ON public.payroll_rules FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.profile_id = auth.uid()
          AND e.role IN ('admin', 'hr', 'payroll_admin')
    )
);

-- ─── payroll_rules_audit_logs ─────────────────────────────────
-- Track every change to payroll rules (compliance mode, multipliers, etc.)
CREATE TABLE IF NOT EXISTS public.payroll_rules_audit_logs (
    id              text PRIMARY KEY DEFAULT ('PRAL-' || gen_random_uuid()::text),
    rules_id        text NOT NULL REFERENCES public.payroll_rules(id) ON DELETE CASCADE,
    field_changed   text NOT NULL,   -- e.g. 'compliance_mode', 'regular_ot_multiplier'
    old_value       jsonb,
    new_value       jsonb,
    changed_by      text NOT NULL,   -- employee_id or 'SYSTEM'
    changed_at      timestamptz NOT NULL DEFAULT now(),
    reason          text,
    ip_address      text
);

CREATE INDEX IF NOT EXISTS idx_pral_rules   ON public.payroll_rules_audit_logs(rules_id);
CREATE INDEX IF NOT EXISTS idx_pral_actor   ON public.payroll_rules_audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_pral_at      ON public.payroll_rules_audit_logs(changed_at);

ALTER TABLE public.payroll_rules_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admin/hr/finance/payroll_admin/auditor can read audit logs
DROP POLICY IF EXISTS pral_read_policy ON public.payroll_rules_audit_logs;
CREATE POLICY pral_read_policy ON public.payroll_rules_audit_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.profile_id = auth.uid()
          AND e.role IN ('admin', 'hr', 'finance', 'payroll_admin', 'auditor')
    )
);

-- System/service-role inserts audit logs; admin/hr can also insert
DROP POLICY IF EXISTS pral_insert_policy ON public.payroll_rules_audit_logs;
CREATE POLICY pral_insert_policy ON public.payroll_rules_audit_logs FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.profile_id = auth.uid()
          AND e.role IN ('admin', 'hr', 'payroll_admin')
    )
);

-- ─── Seed DOLE PH Standard defaults ──────────────────────────
INSERT INTO public.payroll_rules (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ─── Self-validation ──────────────────────────────────────────
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('payroll_rules', 'payroll_rules_audit_logs');

  IF v_count <> 2 THEN
    RAISE EXCEPTION '[066 VALIDATE] Expected 2 tables, found %', v_count;
  END IF;

  -- Verify default row seeded
  IF NOT EXISTS (SELECT 1 FROM public.payroll_rules WHERE id = 'default') THEN
    RAISE EXCEPTION '[066 VALIDATE] Default payroll_rules row missing after seed';
  END IF;

  RAISE NOTICE '[066] ALL VALIDATIONS PASSED — payroll_rules, payroll_rules_audit_logs created with DOLE PH defaults.';
END $$;

COMMIT;
