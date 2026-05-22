-- =====================================================
-- Migration 062: Fix RLS on departments + job_titles
-- =====================================================
-- Migration 023 replaced the open authenticated-user policies on
-- departments and job_titles with company-scoped policies that require
-- jwt.claims.company_id to match the row's company_id column.
-- In a single-tenant setup the JWT does not carry that claim, so every
-- SELECT returns 0 rows — breaking the Add Employee department dropdown
-- and the Job Titles picker throughout the app.
--
-- This migration:
--   1. Drops the company-scoped policies on both tables.
--   2. Restores the simple "authenticated users" policies from 034/035.
--   3. Re-seeds rows that may have been blocked by the previous RLS.
-- =====================================================

-- ── departments ──────────────────────────────────────────────

DROP POLICY IF EXISTS departments_company_scope  ON public.departments;

-- Restore original open policies (mirror of 035_departments.sql)
DROP POLICY IF EXISTS "Authenticated users can read departments"   ON public.departments;
DROP POLICY IF EXISTS "Authenticated users can insert departments"  ON public.departments;
DROP POLICY IF EXISTS "Authenticated users can update departments"  ON public.departments;
DROP POLICY IF EXISTS "Authenticated users can delete departments"  ON public.departments;

CREATE POLICY "Authenticated users can read departments"
    ON public.departments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert departments"
    ON public.departments FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update departments"
    ON public.departments FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete departments"
    ON public.departments FOR DELETE
    TO authenticated
    USING (true);

-- Re-seed default departments (idempotent)
INSERT INTO public.departments (id, name, description, created_by) VALUES
    ('dept_engineering', 'Engineering',     'Software development and technical teams',       'system'),
    ('dept_design',      'Design',          'UI/UX and graphic design teams',                 'system'),
    ('dept_marketing',   'Marketing',       'Marketing and brand management',                 'system'),
    ('dept_hr',          'Human Resources', 'HR, recruitment, and employee relations',        'system'),
    ('dept_finance',     'Finance',         'Accounting, payroll, and financial operations',  'system'),
    ('dept_sales',       'Sales',           'Sales and business development',                 'system'),
    ('dept_operations',  'Operations',      'Business operations and administration',         'system')
ON CONFLICT (id) DO NOTHING;

-- ── job_titles ───────────────────────────────────────────────

DROP POLICY IF EXISTS job_titles_company_scope ON public.job_titles;

-- Restore original open policies (mirror of 034_job_titles.sql)
DROP POLICY IF EXISTS "Authenticated users can read job_titles"   ON public.job_titles;
DROP POLICY IF EXISTS "Authenticated users can insert job_titles"  ON public.job_titles;
DROP POLICY IF EXISTS "Authenticated users can update job_titles"  ON public.job_titles;
DROP POLICY IF EXISTS "Authenticated users can delete job_titles"  ON public.job_titles;

CREATE POLICY "Authenticated users can read job_titles"
    ON public.job_titles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert job_titles"
    ON public.job_titles FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update job_titles"
    ON public.job_titles FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete job_titles"
    ON public.job_titles FOR DELETE
    TO authenticated
    USING (true);

-- Re-seed default job titles (idempotent)
INSERT INTO public.job_titles (id, name, department, is_lead, created_by) VALUES
    ('jt_frontend_dev',   'Frontend Developer', 'Engineering',     false, 'system'),
    ('jt_backend_dev',    'Backend Developer',  'Engineering',     false, 'system'),
    ('jt_uiux_designer',  'UI/UX Designer',     'Design',          false, 'system'),
    ('jt_product_manager','Product Manager',    'Operations',      true,  'system'),
    ('jt_hr_manager',     'HR Manager',         'Human Resources', true,  'system'),
    ('jt_hr_specialist',  'HR Specialist',      'Human Resources', false, 'system'),
    ('jt_finance_manager','Finance Manager',    'Finance',         true,  'system'),
    ('jt_accountant',     'Accountant',         'Finance',         false, 'system'),
    ('jt_marketing_lead', 'Marketing Lead',     'Marketing',       true,  'system'),
    ('jt_sales_exec',     'Sales Executive',    'Sales',           false, 'system'),
    ('jt_devops_engineer','DevOps Engineer',    'Engineering',     false, 'system'),
    ('jt_qa_engineer',    'QA Engineer',        'Engineering',     false, 'system')
ON CONFLICT (id) DO NOTHING;
