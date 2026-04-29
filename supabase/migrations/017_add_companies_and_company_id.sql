-- ============================================================
-- 017: Add companies table + company_id columns for multi-tenancy (scaffold)
-- IMPORTANT: This migration only *adds columns/indexes* and a `companies` table.
-- It does NOT change NOT NULL constraints or add FKs so it is safe to run
-- in an existing single-tenant database. After you migrate data you can
-- tighten constraints and add FK/policies as needed.
-- ============================================================

-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);

-- Insert a default company to preserve single-tenant behavior
INSERT INTO public.companies (id, name, slug)
SELECT 'default', 'Default Company', 'default'
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE id = 'default');

-- Helper: list of tables to add `company_id` to. Only add to tables that exist.
-- Alter tables to add a nullable company_id column, create index, and backfill to 'default'.

-- Core business tables
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'profiles', 'employees', 'projects', 'project_assignments', 'project_verification_methods',
    'tasks', 'task_groups', 'task_comments', 'announcements', 'notification_logs', 'notification_rules',
    'attendance_events', 'attendance_logs', 'timesheets', 'leave_requests', 'leave_balances',
    'payroll_runs', 'payslips', 'payroll_run_payslips', 'payslip_line_items',
    'employee_documents', 'push_subscriptions', 'kiosk_devices', 'kiosk_pins', 'qr_tokens',
    'face_enrollments', 'dashboard_layouts', 'custom_pages', 'loans'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id text', tbl);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_company_id ON public.%I(company_id)', tbl, tbl);
      -- Backfill existing rows to default company to preserve single-tenant behavior
      EXECUTE format('UPDATE public.%I SET company_id = ''default'' WHERE company_id IS NULL', tbl);
    END IF;
  END LOOP;
END$$;

-- Notes for follow-up (manual steps recommended):
-- 1) Review each table and, when safe, add a NOT NULL constraint and a FOREIGN KEY:
--    ALTER TABLE public.<table> ALTER COLUMN company_id SET NOT NULL;
--    ALTER TABLE public.<table> ADD CONSTRAINT fk_<table>_company FOREIGN KEY (company_id) REFERENCES public.companies(id);
-- 2) Update application code and JWT claims to include `company_id` (or `company`) and use it in RLS policies.
-- 3) Create/adjust RLS policies to scope SELECT/INSERT/UPDATE/DELETE to the current user's company.

-- Example RLS policy template (replace <table> and adjust conditions):
-- ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "<table> company scope" ON public.<table>
--   FOR ALL USING (company_id = current_setting('jwt.claims.company_id', true));

-- End of migration 017.
