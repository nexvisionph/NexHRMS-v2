-- ─── Departments Table ──────────────────────────────────────────
-- Admin-managed registry of departments/teams within the organization.
-- Each department has a name, optional description, head (manager),
-- and color for visual distinction.

CREATE TABLE IF NOT EXISTS public.departments (
    id          text        PRIMARY KEY,
    name        text        NOT NULL UNIQUE,
    description text,
    head_id     text,       -- employee ID of department head (optional)
    color       text        NOT NULL DEFAULT '#6366f1',
    is_active   boolean     NOT NULL DEFAULT true,
    created_by  text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS: Full access for authenticated users (admin manages in UI)
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

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

-- Index for quick name lookups / auto-complete
CREATE INDEX IF NOT EXISTS idx_departments_name ON public.departments (lower(name));

-- Seed with default departments from the app
INSERT INTO public.departments (id, name, description, created_by) VALUES
    ('dept_engineering', 'Engineering', 'Software development and technical teams', 'system'),
    ('dept_design', 'Design', 'UI/UX and graphic design teams', 'system'),
    ('dept_marketing', 'Marketing', 'Marketing and brand management', 'system'),
    ('dept_hr', 'Human Resources', 'HR, recruitment, and employee relations', 'system'),
    ('dept_finance', 'Finance', 'Accounting, payroll, and financial operations', 'system'),
    ('dept_sales', 'Sales', 'Sales and business development', 'system'),
    ('dept_operations', 'Operations', 'Business operations and administration', 'system')
ON CONFLICT (id) DO NOTHING;
