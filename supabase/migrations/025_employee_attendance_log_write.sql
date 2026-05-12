-- Migration 025: Allow employees to upsert their own attendance logs
-- ─────────────────────────────────────────────────────────────────────────────
-- Context: The write-through sync layer (sync.service.ts) now lets employees
-- upsert their own attendance_logs rows on check-in/check-out.  Without an
-- INSERT policy the upsert silently fails and the log is lost on hard refresh.
--
-- Policies added:
--   al_insert_own  — employees can INSERT a log for themselves
--   al_update_own  — employees can UPDATE a log that belongs to themselves
-- ─────────────────────────────────────────────────────────────────────────────

-- Insert: employee may create a log where employee_id resolves to their own record
DROP POLICY IF EXISTS al_insert_own ON public.attendance_logs;
CREATE POLICY al_insert_own ON public.attendance_logs
    FOR INSERT WITH CHECK (public.is_own_employee(employee_id));

-- Update: employee may update a log that already belongs to them
DROP POLICY IF EXISTS al_update_own ON public.attendance_logs;
CREATE POLICY al_update_own ON public.attendance_logs
    FOR UPDATE USING (public.is_own_employee(employee_id))
    WITH CHECK (public.is_own_employee(employee_id));
