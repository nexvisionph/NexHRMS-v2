-- ============================================================
-- 065_ot_review_layer.sql
-- OT Review & Payroll Inclusion Layer
-- Tables: ot_records, ot_audit_logs, ot_settings
-- ============================================================

BEGIN;

-- ─── Pre-flight & Utilities ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees') THEN
    RAISE EXCEPTION '[065] ABORTED: public.employees missing. Run 001-002 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='attendance_logs') THEN
    RAISE EXCEPTION '[065] ABORTED: public.attendance_logs missing. Run 004 first.';
  END IF;
END $$;

-- ─── ot_records ───────────────────────────────────────────────
-- System-computed OT per attendance day, pending HR review
CREATE TABLE IF NOT EXISTS public.ot_records (
    id                  text PRIMARY KEY DEFAULT ('OT-' || gen_random_uuid()::text),
    employee_id         text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    attendance_id       text,                            -- FK to attendance_logs.id (nullable: may be computed without a log row)
    payroll_period_id   text,                            -- free-text period label, e.g. "2026-06-01/2026-06-15"
    ot_date             date NOT NULL,
    scheduled_time_out  time,                            -- from shift template
    actual_time_out     time,                            -- from attendance_logs.check_out
    computed_ot_hours   numeric(6,2) NOT NULL DEFAULT 0 CHECK (computed_ot_hours >= 0),
    approved_ot_hours   numeric(6,2)          CHECK (approved_ot_hours >= 0),
    ot_type             text NOT NULL DEFAULT 'regular'
                        CHECK (ot_type IN (
                            'regular',
                            'rest_day',
                            'regular_holiday',
                            'special_holiday',
                            'night_differential',
                            'rest_day_holiday'
                        )),
    computed_amount     numeric(12,2) NOT NULL DEFAULT 0,
    approved_amount     numeric(12,2),
    status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN (
                            'pending',
                            'approved',
                            'partially_approved',
                            'rejected',
                            'locked',
                            'included_in_payroll'
                        )),
    reviewed_by         text,                            -- employee_id of reviewer
    reviewed_at         timestamptz,
    remarks             text,
    company_id          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ot_records_employee    ON public.ot_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_ot_records_date        ON public.ot_records(ot_date);
CREATE INDEX IF NOT EXISTS idx_ot_records_status      ON public.ot_records(status);
CREATE INDEX IF NOT EXISTS idx_ot_records_period      ON public.ot_records(payroll_period_id);
CREATE INDEX IF NOT EXISTS idx_ot_records_company     ON public.ot_records(company_id);

ALTER TABLE public.ot_records ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_ot_records_updated_at ON public.ot_records;
CREATE TRIGGER set_ot_records_updated_at
    BEFORE UPDATE ON public.ot_records
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS: admin/hr/finance/payroll_admin → full access
DROP POLICY IF EXISTS ot_records_admin_policy ON public.ot_records;
CREATE POLICY ot_records_admin_policy ON public.ot_records FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.profile_id = auth.uid()
          AND e.role IN ('admin', 'hr', 'finance', 'payroll_admin')
    )
);

-- RLS: supervisor → SELECT only (their team via department match)
DROP POLICY IF EXISTS ot_records_supervisor_policy ON public.ot_records;
CREATE POLICY ot_records_supervisor_policy ON public.ot_records FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.employees sup
        JOIN public.employees emp ON emp.id = ot_records.employee_id
        WHERE sup.profile_id = auth.uid()
          AND sup.role = 'supervisor'
          AND emp.department = sup.department
    )
);

-- RLS: employee → SELECT own only
DROP POLICY IF EXISTS ot_records_employee_policy ON public.ot_records;
CREATE POLICY ot_records_employee_policy ON public.ot_records FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.profile_id = auth.uid()
          AND e.id = ot_records.employee_id
    )
);

-- ─── ot_audit_logs ────────────────────────────────────────────
-- Immutable audit trail for every OT record action
CREATE TABLE IF NOT EXISTS public.ot_audit_logs (
    id              text PRIMARY KEY DEFAULT ('OTAL-' || gen_random_uuid()::text),
    ot_record_id    text NOT NULL REFERENCES public.ot_records(id) ON DELETE CASCADE,
    action          text NOT NULL,   -- 'computed','approved','partially_approved','rejected','adjusted_hours','locked','included_in_payroll','excluded_from_payroll'
    old_value       jsonb,
    new_value       jsonb,
    performed_by    text NOT NULL,   -- employee_id or 'SYSTEM'
    performed_at    timestamptz NOT NULL DEFAULT now(),
    remarks         text,
    ip_address      text
);

CREATE INDEX IF NOT EXISTS idx_ot_audit_record   ON public.ot_audit_logs(ot_record_id);
CREATE INDEX IF NOT EXISTS idx_ot_audit_actor    ON public.ot_audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_ot_audit_at       ON public.ot_audit_logs(performed_at);

ALTER TABLE public.ot_audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs: admin/hr/payroll_admin/finance/auditor can read; admin/hr can insert (system inserts via service role)
DROP POLICY IF EXISTS ot_audit_logs_read_policy ON public.ot_audit_logs;
CREATE POLICY ot_audit_logs_read_policy ON public.ot_audit_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.profile_id = auth.uid()
          AND e.role IN ('admin', 'hr', 'finance', 'payroll_admin', 'auditor')
    )
);

DROP POLICY IF EXISTS ot_audit_logs_insert_policy ON public.ot_audit_logs;
CREATE POLICY ot_audit_logs_insert_policy ON public.ot_audit_logs FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.profile_id = auth.uid()
          AND e.role IN ('admin', 'hr', 'finance', 'payroll_admin')
    )
);

-- ─── ot_settings ──────────────────────────────────────────────
-- Per-company OT review configuration (one row per company)
CREATE TABLE IF NOT EXISTS public.ot_settings (
    id                              text PRIMARY KEY DEFAULT 'default',
    company_id                      text,
    enable_ot_review                boolean NOT NULL DEFAULT true,
    minimum_ot_minutes              integer NOT NULL DEFAULT 30 CHECK (minimum_ot_minutes >= 0),
    ot_grace_period_minutes         integer NOT NULL DEFAULT 0  CHECK (ot_grace_period_minutes >= 0),
    require_supervisor_approval     boolean NOT NULL DEFAULT false,
    allow_partial_approval          boolean NOT NULL DEFAULT true,
    allow_payroll_officer_override  boolean NOT NULL DEFAULT true,
    include_pending_in_payroll      boolean NOT NULL DEFAULT false,
    updated_at                      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ot_settings ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_ot_settings_updated_at ON public.ot_settings;
CREATE TRIGGER set_ot_settings_updated_at
    BEFORE UPDATE ON public.ot_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS ot_settings_read_policy ON public.ot_settings;
CREATE POLICY ot_settings_read_policy ON public.ot_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS ot_settings_write_policy ON public.ot_settings;
CREATE POLICY ot_settings_write_policy ON public.ot_settings FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.profile_id = auth.uid()
          AND e.role IN ('admin', 'hr', 'payroll_admin')
    )
);

-- ─── Seed default OT settings ─────────────────────────────────
INSERT INTO public.ot_settings (id)
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
    AND table_name IN ('ot_records', 'ot_audit_logs', 'ot_settings');

  IF v_count <> 3 THEN
    RAISE EXCEPTION '[065 VALIDATE] Expected 3 tables, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_ot_records_employee','idx_ot_records_date',
      'idx_ot_records_status','idx_ot_records_period',
      'idx_ot_records_company','idx_ot_audit_record',
      'idx_ot_audit_actor','idx_ot_audit_at'
    );
  IF v_count < 8 THEN
    RAISE EXCEPTION '[065 VALIDATE] Expected 8 indexes, found %', v_count;
  END IF;

  RAISE NOTICE '[065] ALL VALIDATIONS PASSED — ot_records, ot_audit_logs, ot_settings created.';
END $$;

COMMIT;
