-- ============================================================
-- 029_project_assignments_junction.sql
-- Replace projects.assigned_employee_ids text[] with proper
-- junction table for FK enforcement and indexing.
-- ============================================================

-- ─── Junction table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.project_assignments (
    project_id   text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employee_id  text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    assigned_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_pa_employee ON public.project_assignments(employee_id);

ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;

-- RLS: readable by all (matches projects table), writable by admin/hr/supervisor
CREATE POLICY "project_assignments_read"
    ON public.project_assignments
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "project_assignments_write"
    ON public.project_assignments
    FOR ALL
    TO authenticated
    USING (
        public.get_user_role() IN ('admin', 'hr', 'supervisor')
    )
    WITH CHECK (
        public.get_user_role() IN ('admin', 'hr', 'supervisor')
    );

-- ─── Migrate existing data ───────────────────────────────────

INSERT INTO public.project_assignments (project_id, employee_id)
SELECT p.id, unnest(p.assigned_employee_ids)
FROM public.projects p
WHERE array_length(p.assigned_employee_ids, 1) > 0
ON CONFLICT DO NOTHING;

-- ─── Update the enforce_one_project_per_employee trigger ─────
-- Now operates on the junction table instead of array column.

CREATE OR REPLACE FUNCTION public.enforce_one_project_per_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- When an assignment is inserted, remove that employee
    -- from any OTHER project (enforce 1 project per employee).
    DELETE FROM public.project_assignments
    WHERE employee_id = NEW.employee_id
      AND project_id <> NEW.project_id;

    RETURN NEW;
END;
$$;

-- Drop old trigger (was on projects table)
DROP TRIGGER IF EXISTS trg_one_project_per_employee ON public.projects;

-- New trigger on the junction table
DROP TRIGGER IF EXISTS trg_one_project_per_employee ON public.project_assignments;
CREATE TRIGGER trg_one_project_per_employee
    BEFORE INSERT
    ON public.project_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_one_project_per_employee();

-- ─── Keep old column but mark deprecated ─────────────────────
COMMENT ON COLUMN public.projects.assigned_employee_ids
    IS 'DEPRECATED — use project_assignments junction table. Will be removed in a future migration.';
