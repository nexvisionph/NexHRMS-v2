-- =====================================================
-- Migration 045: Payroll Simplification & Custom Deductions
-- =====================================================
-- Simplifies payslip flow: draft -> published -> signed
-- Simplifies run flow: draft -> locked -> completed
-- Adds custom deduction templates, employee assignments,
-- payslip line items, and employee deduction exemption.
--
-- PERMANENT FIX: Uses DO $$ blocks to detect the actual
-- column types of employees.id and payslips.id at runtime.
-- Handles both text and uuid PKs without manual intervention.
-- Self-validates at the end - rolls back if anything is wrong.
-- =====================================================

BEGIN;

-- STEP 0: Pre-flight - abort if prerequisite tables missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees') THEN
    RAISE EXCEPTION '[045] ABORTED: public.employees does not exist. Run migrations 001-002 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payslips') THEN
    RAISE EXCEPTION '[045] ABORTED: public.payslips does not exist. Run migration 006 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payroll_runs') THEN
    RAISE EXCEPTION '[045] ABORTED: public.payroll_runs does not exist. Run migration 006 first.';
  END IF;
END $$;

-- STEP 1: Add deduction exemption columns to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS deduction_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deduction_exempt_reason text;

-- STEP 2: Create deduction_templates table
CREATE TABLE IF NOT EXISTS public.deduction_templates (
  id text NOT NULL DEFAULT ('DT-' || gen_random_uuid()::text),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'deduction' CHECK (type IN ('deduction', 'allowance')),
  calculation_mode text NOT NULL DEFAULT 'fixed' CHECK (calculation_mode IN ('fixed', 'percentage', 'daily', 'hourly')),
  value numeric NOT NULL DEFAULT 0 CHECK (value >= 0),
  conditions jsonb,
  applies_to_all boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deduction_templates_pkey PRIMARY KEY (id)
);

-- STEP 3: Create employee_deduction_assignments (dynamic FK type)
DO $$
DECLARE
  v_emp_id_type text;
BEGIN
  SELECT udt_name INTO STRICT v_emp_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'id';

  RAISE NOTICE '[045] employees.id detected as: %', v_emp_id_type;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_deduction_assignments') THEN
    EXECUTE format($ddl$
      CREATE TABLE public.employee_deduction_assignments (
        id text NOT NULL DEFAULT ('EDA-' || gen_random_uuid()::text),
        employee_id %I NOT NULL,
        template_id text NOT NULL,
        override_value numeric,
        effective_from date NOT NULL DEFAULT CURRENT_DATE,
        effective_until date,
        is_active boolean NOT NULL DEFAULT true,
        assigned_by text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT employee_deduction_assignments_pkey PRIMARY KEY (id),
        CONSTRAINT eda_employee_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
        CONSTRAINT eda_template_fk FOREIGN KEY (template_id) REFERENCES public.deduction_templates(id) ON DELETE CASCADE
      )
    $ddl$, v_emp_id_type);
    RAISE NOTICE '[045] Created employee_deduction_assignments';
  ELSE
    RAISE NOTICE '[045] employee_deduction_assignments already exists - skipped';
  END IF;
END $$;

-- STEP 4: Create payslip_line_items (dynamic FK type)
DO $$
DECLARE
  v_payslip_id_type text;
BEGIN
  SELECT udt_name INTO STRICT v_payslip_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payslips' AND column_name = 'id';

  RAISE NOTICE '[045] payslips.id detected as: %', v_payslip_id_type;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payslip_line_items') THEN
    EXECUTE format($ddl$
      CREATE TABLE public.payslip_line_items (
        id text NOT NULL DEFAULT ('PLI-' || gen_random_uuid()::text),
        payslip_id %I NOT NULL,
        label text NOT NULL,
        type text NOT NULL CHECK (type IN ('earning', 'deduction', 'government', 'loan')),
        amount numeric NOT NULL,
        template_id text,
        calculation_detail text,
        CONSTRAINT payslip_line_items_pkey PRIMARY KEY (id),
        CONSTRAINT pli_payslip_fk FOREIGN KEY (payslip_id) REFERENCES public.payslips(id) ON DELETE CASCADE,
        CONSTRAINT pli_template_fk FOREIGN KEY (template_id) REFERENCES public.deduction_templates(id) ON DELETE SET NULL
      )
    $ddl$, v_payslip_id_type);
    RAISE NOTICE '[045] Created payslip_line_items';
  ELSE
    RAISE NOTICE '[045] payslip_line_items already exists - skipped';
  END IF;
END $$;

-- STEP 5: Add columns to payslips
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS custom_deductions numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_items_json jsonb;

-- STEP 6: Migrate payslip statuses (draft/published/signed)
-- First, drop ALL check constraints on payslips.status (regardless of name)
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
    RAISE NOTICE '[045] Dropped payslips constraint: %', r.conname;
  END LOOP;
END $$;

-- Update statuses to new 3-state values
UPDATE public.payslips SET status = 'draft' WHERE status IN ('issued', 'confirmed');
UPDATE public.payslips SET status = 'signed' WHERE status IN ('paid', 'acknowledged');
-- Catch any unknown statuses by forcing them to 'draft'
UPDATE public.payslips SET status = 'draft' WHERE status NOT IN ('draft', 'published', 'signed');

-- Add new constraint
ALTER TABLE public.payslips ADD CONSTRAINT payslips_status_check CHECK (status IN ('draft', 'published', 'signed'));

-- STEP 7: Migrate payroll_runs statuses (draft/locked/completed)
-- First, drop ALL check constraints on payroll_runs.status (regardless of name)
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
    RAISE NOTICE '[045] Dropped payroll_runs constraint: %', r.conname;
  END LOOP;
END $$;

-- Update statuses to new 3-state values
UPDATE public.payroll_runs SET status = 'draft' WHERE status = 'validated';
UPDATE public.payroll_runs SET status = 'completed' WHERE status IN ('published', 'paid');
-- Catch any unknown statuses by forcing them to 'draft'
UPDATE public.payroll_runs SET status = 'draft' WHERE status NOT IN ('draft', 'locked', 'completed');

-- Add new constraint
ALTER TABLE public.payroll_runs ADD CONSTRAINT payroll_runs_status_check CHECK (status IN ('draft', 'locked', 'completed'));
ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- STEP 8: Indexes
CREATE INDEX IF NOT EXISTS idx_deduction_templates_active ON public.deduction_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_eda_employee ON public.employee_deduction_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_eda_template ON public.employee_deduction_assignments(template_id);
CREATE INDEX IF NOT EXISTS idx_pli_payslip ON public.payslip_line_items(payslip_id);
CREATE INDEX IF NOT EXISTS idx_employees_deduction_exempt ON public.employees(deduction_exempt) WHERE deduction_exempt = true;

-- STEP 9: RLS Policies (idempotent)
ALTER TABLE public.deduction_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deduction_templates_read_policy ON public.deduction_templates;
CREATE POLICY deduction_templates_read_policy ON public.deduction_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS deduction_templates_write_policy ON public.deduction_templates;
CREATE POLICY deduction_templates_write_policy ON public.deduction_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.profile_id = auth.uid() AND e.role IN ('admin', 'hr', 'finance', 'payroll_admin'))
);

ALTER TABLE public.employee_deduction_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eda_admin_policy ON public.employee_deduction_assignments;
CREATE POLICY eda_admin_policy ON public.employee_deduction_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.profile_id = auth.uid() AND e.role IN ('admin', 'hr', 'finance', 'payroll_admin'))
);
DROP POLICY IF EXISTS eda_employee_read_policy ON public.employee_deduction_assignments;
CREATE POLICY eda_employee_read_policy ON public.employee_deduction_assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.profile_id = auth.uid() AND e.id = employee_id)
);

ALTER TABLE public.payslip_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pli_admin_policy ON public.payslip_line_items;
CREATE POLICY pli_admin_policy ON public.payslip_line_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.employees e WHERE e.profile_id = auth.uid() AND e.role IN ('admin', 'hr', 'finance', 'payroll_admin'))
);
DROP POLICY IF EXISTS pli_employee_read_policy ON public.payslip_line_items;
CREATE POLICY pli_employee_read_policy ON public.payslip_line_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.payslips p JOIN public.employees e ON e.id = p.employee_id WHERE p.id = payslip_id AND e.profile_id = auth.uid())
);

-- STEP 10: Self-validation (rolls back on failure)
DO $$
DECLARE
  v_eda_type text;
  v_emp_type text;
  v_pli_type text;
  v_ps_type  text;
  v_count    integer;
BEGIN
  -- 10a. All 3 new tables exist
  SELECT COUNT(*) INTO v_count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('deduction_templates','employee_deduction_assignments','payslip_line_items');
  IF v_count <> 3 THEN RAISE EXCEPTION '[045 VALIDATE] Expected 3 new tables, found %', v_count; END IF;

  -- 10b. FK type matches: eda.employee_id = employees.id
  SELECT udt_name INTO v_eda_type FROM information_schema.columns WHERE table_schema='public' AND table_name='employee_deduction_assignments' AND column_name='employee_id';
  SELECT udt_name INTO v_emp_type FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='id';
  IF v_eda_type IS DISTINCT FROM v_emp_type THEN RAISE EXCEPTION '[045 VALIDATE] Type mismatch: eda.employee_id(%) != employees.id(%)', v_eda_type, v_emp_type; END IF;

  -- 10c. FK type matches: pli.payslip_id = payslips.id
  SELECT udt_name INTO v_pli_type FROM information_schema.columns WHERE table_schema='public' AND table_name='payslip_line_items' AND column_name='payslip_id';
  SELECT udt_name INTO v_ps_type FROM information_schema.columns WHERE table_schema='public' AND table_name='payslips' AND column_name='id';
  IF v_pli_type IS DISTINCT FROM v_ps_type THEN RAISE EXCEPTION '[045 VALIDATE] Type mismatch: pli.payslip_id(%) != payslips.id(%)', v_pli_type, v_ps_type; END IF;

  -- 10d. All 5 indexes
  SELECT COUNT(*) INTO v_count FROM pg_indexes WHERE schemaname='public' AND indexname IN ('idx_deduction_templates_active','idx_eda_employee','idx_eda_template','idx_pli_payslip','idx_employees_deduction_exempt');
  IF v_count <> 5 THEN RAISE EXCEPTION '[045 VALIDATE] Expected 5 indexes, found %', v_count; END IF;

  -- 10e. At least 6 RLS policies
  SELECT COUNT(*) INTO v_count FROM pg_policies WHERE schemaname='public' AND tablename IN ('deduction_templates','employee_deduction_assignments','payslip_line_items');
  IF v_count < 6 THEN RAISE EXCEPTION '[045 VALIDATE] Expected >= 6 RLS policies, found %', v_count; END IF;

  -- 10f. New columns exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='deduction_exempt') THEN
    RAISE EXCEPTION '[045 VALIDATE] employees.deduction_exempt missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payslips' AND column_name='custom_deductions') THEN
    RAISE EXCEPTION '[045 VALIDATE] payslips.custom_deductions missing';
  END IF;

  -- 10g. No stale statuses
  IF EXISTS (SELECT 1 FROM public.payslips WHERE status NOT IN ('draft','published','signed') LIMIT 1) THEN
    RAISE EXCEPTION '[045 VALIDATE] Stale payslip statuses found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payroll_runs WHERE status NOT IN ('draft','locked','completed') LIMIT 1) THEN
    RAISE EXCEPTION '[045 VALIDATE] Stale payroll_run statuses found';
  END IF;

  RAISE NOTICE '[045] ALL 7 VALIDATIONS PASSED';
END $$;

COMMIT;
