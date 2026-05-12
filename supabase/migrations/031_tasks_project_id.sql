-- ============================================================
-- 031_tasks_project_id.sql
-- Add project_id column to tasks table so tasks can be
-- directly linked to a project (in addition to via group).
-- ============================================================

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS project_id text
    REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks(project_id);
