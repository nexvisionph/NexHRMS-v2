-- Migration 020: Enable Supabase Realtime for all operational tables
--
-- Tier 1 — Core (multi-user, real-time critical):
--   attendance_logs      — live check-in/out, admin overrides
--   attendance_events    — append-only audit ledger
--   leave_requests       — approval status visible to employees
--   leave_balances       — balance updates after approvals
--   overtime_requests    — OT approval flow
--   employees            — profile/status/salary changes
--   payslips             — employee sees published payslips immediately
--   payroll_runs         — admin sees run status transitions
--   loans                — balance changes, freeze/settle
--   salary_change_requests — HR→Finance approval flow
--
-- Tier 2 — Collaboration:
--   announcements        — company-wide comms
--   channel_messages     — team chat
--   tasks                — task assignments & status
--   holidays             — schedule changes affect everyone
--   shift_templates      — shift changes affect attendance
--
-- REPLICA IDENTITY FULL is required so UPDATE payloads include all columns.

DO $$
DECLARE
  tables text[] := ARRAY[
    -- Tier 1: Core operational
    'attendance_logs',
    'attendance_events',
    'leave_requests',
    'leave_balances',
    'overtime_requests',
    'employees',
    'payslips',
    'payroll_runs',
    'loans',
    'salary_change_requests',
    -- Tier 2: Collaboration
    'announcements',
    'channel_messages',
    'tasks',
    'holidays',
    'shift_templates',
    'employee_shifts'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END;
$$;
