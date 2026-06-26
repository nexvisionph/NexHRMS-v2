-- ============================================================
-- 068_attendance_summaries.sql
-- Attendance Summaries — clean per-employee-per-day summary
-- generated after Attendance Review approval.
-- Payroll reads from this table, not raw attendance_logs.
-- Ticket: NHRMS-ATT-001
-- ============================================================

BEGIN;

-- ─── Pre-flight ───────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attendance_logs'
  ) THEN
    RAISE EXCEPTION '[068] ABORTED: public.attendance_logs missing. Run 004 first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    RAISE EXCEPTION '[068] ABORTED: public.employees missing. Run 001-002 first.';
  END IF;
END $$;

-- ─── attendance_summaries ─────────────────────────────────────
-- One row per employee per attendance date.
-- Populated by /api/attendance/summaries/generate after HR review.
-- Payroll computation reads ONLY from this table (never raw logs).
CREATE TABLE IF NOT EXISTS public.attendance_summaries (
    id                          text PRIMARY KEY DEFAULT ('AS-' || gen_random_uuid()::text),
    company_id                  text,
    employee_id                 text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    attendance_date             date NOT NULL,

    -- ─── Shift reference ─────────────────────────────────────
    scheduled_shift_id          text,               -- FK to shift_templates (nullable)

    -- ─── Clock times ─────────────────────────────────────────
    first_clock_in              time,               -- earliest clock-in across all sources
    last_clock_out              time,               -- latest clock-out across all sources

    -- ─── Computed totals ─────────────────────────────────────
    total_work_hours            numeric(5,2) NOT NULL DEFAULT 0 CHECK (total_work_hours >= 0),
    late_minutes                integer NOT NULL DEFAULT 0 CHECK (late_minutes >= 0),
    undertime_minutes           integer NOT NULL DEFAULT 0 CHECK (undertime_minutes >= 0),
    overtime_minutes            integer NOT NULL DEFAULT 0 CHECK (overtime_minutes >= 0),
    night_diff_minutes          integer NOT NULL DEFAULT 0 CHECK (night_diff_minutes >= 0),

    -- ─── Status ───────────────────────────────────────────────
    attendance_status           text NOT NULL DEFAULT 'pending_review'
                                CHECK (attendance_status IN (
                                    'present',
                                    'absent',
                                    'late',
                                    'undertime',
                                    'half_day',
                                    'rest_day_work',
                                    'holiday_work',
                                    'pending_review'
                                )),

    -- ─── Source tracking ─────────────────────────────────────
    -- Comma-separated sources used: 'biometric', 'mobile_gps', 'web', 'manual'
    attendance_source_summary   text,

    -- ─── Approval ────────────────────────────────────────────
    approved_by                 text,               -- employee_id of approver
    approved_at                 timestamptz,

    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),

    -- One summary row per employee per day
    UNIQUE (employee_id, attendance_date)
);

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_att_summaries_employee  ON public.attendance_summaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_summaries_date      ON public.attendance_summaries(attendance_date);
CREATE INDEX IF NOT EXISTS idx_att_summaries_company   ON public.attendance_summaries(company_id);
CREATE INDEX IF NOT EXISTS idx_att_summaries_status    ON public.attendance_summaries(attendance_status);

-- ─── Updated-at trigger ───────────────────────────────────────
DROP TRIGGER IF EXISTS set_att_summaries_updated_at ON public.attendance_summaries;
CREATE TRIGGER set_att_summaries_updated_at
    BEFORE UPDATE ON public.attendance_summaries
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.attendance_summaries ENABLE ROW LEVEL SECURITY;

-- Admin / HR / Finance / Payroll can read and write all rows
DROP POLICY IF EXISTS att_summaries_admin_policy ON public.attendance_summaries;
CREATE POLICY att_summaries_admin_policy ON public.attendance_summaries FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.profile_id = auth.uid()
          AND e.role IN ('admin', 'hr', 'finance', 'payroll_admin')
    )
);

-- Supervisor: read only, own department
DROP POLICY IF EXISTS att_summaries_supervisor_policy ON public.attendance_summaries;
CREATE POLICY att_summaries_supervisor_policy ON public.attendance_summaries FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.employees sup
        JOIN public.employees emp ON emp.id = attendance_summaries.employee_id
        WHERE sup.profile_id = auth.uid()
          AND sup.role = 'supervisor'
          AND emp.department = sup.department
    )
);

-- Employee: read own only
DROP POLICY IF EXISTS att_summaries_employee_policy ON public.attendance_summaries;
CREATE POLICY att_summaries_employee_policy ON public.attendance_summaries FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.profile_id = auth.uid()
          AND e.id = attendance_summaries.employee_id
    )
);

-- ─── Self-validation ──────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attendance_summaries'
  ) THEN
    RAISE EXCEPTION '[068 VALIDATE] attendance_summaries table not created';
  END IF;
  RAISE NOTICE '[068] ALL VALIDATIONS PASSED — attendance_summaries created.';
END $$;

COMMIT;
