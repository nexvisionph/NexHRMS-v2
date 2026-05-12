-- Migration 040: Add missing tables to Realtime publication + disable RLS for testing
--
-- Fix: sync.service.ts subscribes to 23 tables but migration 020 only added 16.
-- The 7 missing tables cause "mismatch between server and client bindings" error.
--
-- Missing tables:
--   payroll_adjustments, final_pay_computations, calendar_events,
--   leave_policies, projects, timesheets, notification_rules
--
-- Also disables RLS on all tables for easier development/testing.
-- Re-enable RLS before deploying to production.

-- ─── 1. Add missing tables to supabase_realtime publication ────────────

DO $$
DECLARE
  tables text[] := ARRAY[
    'payroll_adjustments',
    'final_pay_computations',
    'calendar_events',
    'leave_policies',
    'projects',
    'timesheets',
    'notification_rules'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      -- REPLICA IDENTITY FULL required so UPDATE payloads include all columns
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END;
$$;

-- ─── 2. Disable RLS on all tables for development/testing ──────────────
-- WARNING: Re-enable RLS before deploying to production!

DO $$
DECLARE
  all_tables text[] := ARRAY[
    'announcements',
    'appearance_config',
    'attendance_events',
    'attendance_evidence',
    'attendance_exceptions',
    'attendance_logs',
    'attendance_rule_sets',
    'audit_logs',
    'break_records',
    'calendar_events',
    'channel_messages',
    'custom_pages',
    'dashboard_layouts',
    'deduction_global_defaults',
    'deduction_overrides',
    'departments',
    'employee_documents',
    'employee_shifts',
    'employees',
    'face_enrollments',
    'final_pay_computations',
    'gov_table_versions',
    'holidays',
    'job_titles',
    'kiosk_devices',
    'kiosk_pins',
    'leave_balances',
    'leave_policies',
    'leave_requests',
    'loan_balance_history',
    'loan_deductions',
    'loan_repayment_schedule',
    'loans',
    'location_config',
    'location_pings',
    'manual_checkin_reasons',
    'manual_checkins',
    'notification_logs',
    'notification_rules',
    'overtime_requests',
    'pay_schedule_config',
    'payroll_adjustments',
    'payroll_run_payslips',
    'payroll_runs',
    'payroll_signature_config',
    'payslips',
    'penalty_records',
    'profiles',
    'project_assignments',
    'project_verification_methods',
    'projects',
    'qr_tokens',
    'roles_custom',
    'salary_change_requests',
    'salary_history',
    'shift_templates',
    'site_survey_photos',
    'task_comments',
    'task_completion_reports',
    'task_groups',
    'task_tags',
    'tasks',
    'text_channels',
    'timesheets'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END;
$$;
