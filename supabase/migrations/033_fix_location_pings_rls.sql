-- ============================================================
-- 033_fix_location_pings_rls.sql
-- Fixes INSERT/UPSERT RLS on location-related tables so that
-- both the owning employee AND admin/HR can write records.
--
-- Root cause: lp_insert / ssp_insert / br_manage only allowed
-- one side (employee-only or admin-only). The sync write-through
-- subscriber runs under the currently authenticated user's JWT,
-- which may be an admin who is also tracked, or an employee
-- whose profile_id link was not yet established — causing
-- "new row violates row-level security policy" on inserts.
-- ============================================================

-- ─── location_pings ──────────────────────────────────────────
-- Allow the owning employee OR any admin/HR member to insert.
DROP POLICY IF EXISTS lp_insert ON public.location_pings;
CREATE POLICY lp_insert ON public.location_pings
    FOR INSERT WITH CHECK (
        public.is_own_employee(employee_id) OR public.is_admin_or_hr()
    );

-- ─── site_survey_photos ──────────────────────────────────────
-- Same pattern — selfies are submitted by employees but an
-- admin may also need to write on their behalf.
DROP POLICY IF EXISTS ssp_insert ON public.site_survey_photos;
CREATE POLICY ssp_insert ON public.site_survey_photos
    FOR INSERT WITH CHECK (
        public.is_own_employee(employee_id) OR public.is_admin_or_hr()
    );

-- ─── break_records ───────────────────────────────────────────
-- Previous br_manage (FOR ALL) only covered admin.
-- Add separate employee-scoped INSERT and UPDATE policies so
-- employees can create and close their own break records.
DROP POLICY IF EXISTS br_insert_own ON public.break_records;
CREATE POLICY br_insert_own ON public.break_records
    FOR INSERT WITH CHECK (
        public.is_own_employee(employee_id) OR public.is_admin_or_hr()
    );

DROP POLICY IF EXISTS br_update_own ON public.break_records;
CREATE POLICY br_update_own ON public.break_records
    FOR UPDATE
    USING  (public.is_own_employee(employee_id) OR public.is_admin_or_hr())
    WITH CHECK (public.is_own_employee(employee_id) OR public.is_admin_or_hr());
