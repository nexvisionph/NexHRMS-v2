-- ─── Job Titles Table ──────────────────────────────────────────
-- Admin-managed registry of job titles (roles) that can be assigned
-- to employees. Each title has a display name, optional description,
-- department association, and whether it's a leadership position.

CREATE TABLE IF NOT EXISTS public.job_titles (
    id          text        PRIMARY KEY,
    name        text        NOT NULL UNIQUE,
    description text,
    department  text,
    is_active   boolean     NOT NULL DEFAULT true,
    is_lead     boolean     NOT NULL DEFAULT false,
    color       text        NOT NULL DEFAULT '#6366f1',
    created_by  text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: Full access for authenticated users (admin manages in UI)
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;

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

-- Index for quick name lookups / auto-complete
CREATE INDEX IF NOT EXISTS idx_job_titles_name ON public.job_titles (lower(name));

-- Index for department filtering
CREATE INDEX IF NOT EXISTS idx_job_titles_department ON public.job_titles (department);

-- Seed with default job titles from the app
INSERT INTO public.job_titles (id, name, department, is_lead, created_by) VALUES
    ('jt_frontend_dev', 'Frontend Developer', 'Engineering', false, 'system'),
    ('jt_backend_dev', 'Backend Developer', 'Engineering', false, 'system'),
    ('jt_uiux_designer', 'UI/UX Designer', 'Design', false, 'system'),
    ('jt_product_manager', 'Product Manager', 'Operations', true, 'system'),
    ('jt_hr_manager', 'HR Manager', 'Human Resources', true, 'system'),
    ('jt_hr_specialist', 'HR Specialist', 'Human Resources', false, 'system'),
    ('jt_finance_manager', 'Finance Manager', 'Finance', true, 'system'),
    ('jt_accountant', 'Accountant', 'Finance', false, 'system'),
    ('jt_marketing_lead', 'Marketing Lead', 'Marketing', true, 'system'),
    ('jt_sales_exec', 'Sales Executive', 'Sales', false, 'system'),
    ('jt_devops_engineer', 'DevOps Engineer', 'Engineering', false, 'system'),
    ('jt_qa_engineer', 'QA Engineer', 'Engineering', false, 'system')
ON CONFLICT (id) DO NOTHING;
