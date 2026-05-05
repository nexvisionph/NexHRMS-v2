-- 027_fix_task_completion_reports_cascade_delete
-- Migration: Without ON DELETE CASCADE, deleting a task that has a completion report
-- throws: "update or delete on table "tasks" violates foreign key constraint
-- task_completion_reports_task_id_fkey"
-- Intern: Jana
-- Date: 2026-05-05

ALTER TABLE public.task_completion_reports
  DROP CONSTRAINT IF EXISTS task_completion_reports_task_id_fkey;

ALTER TABLE public.task_completion_reports
  ADD CONSTRAINT task_completion_reports_task_id_fkey
  FOREIGN KEY (task_id)
  REFERENCES public.tasks(id)
  ON DELETE CASCADE;
