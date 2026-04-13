-- Migration 015: Add unique constraint on attendance_logs(employee_id, date)
--
-- The upsert logic in db.service.ts uses ON CONFLICT (employee_id, date) to
-- prevent duplicate attendance records for the same employee on the same day.
-- This requires a corresponding unique constraint in Postgres.
--
-- Step 1: Remove any duplicate (employee_id, date) rows, keeping the most
--         recently updated one per pair so the constraint can be created safely.
DELETE FROM public.attendance_logs
WHERE id NOT IN (
  SELECT DISTINCT ON (employee_id, date) id
  FROM public.attendance_logs
  ORDER BY employee_id, date, updated_at DESC NULLS LAST
);

-- Step 2: Add the unique constraint that backs the ON CONFLICT clause.
ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_employee_id_date_key UNIQUE (employee_id, date);
