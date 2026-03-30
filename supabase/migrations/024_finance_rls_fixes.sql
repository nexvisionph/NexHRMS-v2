-- ============================================================
-- 024_finance_rls_fixes.sql
-- Grant finance and payroll_admin appropriate read/write access:
--   • employees  : read all + manage (salary edits, payroll processing)
--   • leave_balances  : read-only (payroll deduction calculations)
--   • attendance_logs : read-only (payroll hours calculations)
-- Fix channel_messages UPDATE for employees (read-receipt / own-message edits)
-- The write-through layer in sync.service.ts is separately gated
-- to prevent finance from writing leave_balances/attendance_logs.
-- ============================================================

-- ─── Employees: expand read to finance / payroll_admin / auditor ──────────
DROP POLICY IF EXISTS employees_read_admin ON public.employees;
CREATE POLICY employees_read_admin ON public.employees
    FOR SELECT USING (
        public.get_user_role() IN ('admin', 'hr', 'finance', 'payroll_admin', 'auditor')
    );

-- Employees: expand manage (INSERT/UPDATE/DELETE) to finance / payroll_admin
-- Finance legitimately edits salary fields and the finance-view already allows it.
DROP POLICY IF EXISTS employees_manage_admin ON public.employees;
CREATE POLICY employees_manage_admin ON public.employees
    FOR ALL USING (
        public.get_user_role() IN ('admin', 'hr', 'finance', 'payroll_admin')
    );

-- ─── Leave balances: finance / payroll_admin can read (deduction calc) ────
-- Leave them out of lb_manage so they cannot create or modify balances.
DROP POLICY IF EXISTS lb_read_admin ON public.leave_balances;
CREATE POLICY lb_read_admin ON public.leave_balances
    FOR SELECT USING (
        public.get_user_role() IN ('admin', 'hr', 'finance', 'payroll_admin', 'auditor')
    );

-- ─── Attendance logs: finance / payroll_admin can read (hours calc) ───────
-- Leave them out of al_manage so they cannot create or modify logs.
DROP POLICY IF EXISTS al_read_admin ON public.attendance_logs;
CREATE POLICY al_read_admin ON public.attendance_logs
    FOR SELECT USING (
        public.get_user_role() IN ('admin', 'hr', 'finance', 'payroll_admin', 'auditor')
    );

-- ─── Channel messages: allow employees to update their own messages ────────
-- This covers read-receipts (readBy field) and message edits by the sender.
-- cm_insert already allows any member to insert; this adds UPDATE for own rows.
DROP POLICY IF EXISTS cm_update_own ON public.channel_messages;
CREATE POLICY cm_update_own ON public.channel_messages
    FOR UPDATE USING (public.is_own_employee(employee_id))
    WITH CHECK (public.is_own_employee(employee_id));

-- Also allow all channel members to upsert their own messages (INSERT+UPDATE)
-- so the write-through sync layer (upsertMessage) doesn't violate RLS.
DROP POLICY IF EXISTS cm_upsert_member ON public.channel_messages;
CREATE POLICY cm_upsert_member ON public.channel_messages
    FOR ALL USING (
        -- sender can always manage their own messages
        public.is_own_employee(employee_id)
        -- admins/hr can manage any message
        OR public.is_admin_or_hr()
    );

-- ─── Face enrollments: allow employees to self-enroll ─────────────────────
-- Existing policies fe_insert/fe_update are admin-only; add employee self-service.
-- Employees can only insert/update their OWN enrollment row.
DROP POLICY IF EXISTS fe_self_insert ON public.face_enrollments;
CREATE POLICY fe_self_insert ON public.face_enrollments
    FOR INSERT WITH CHECK (
        public.is_own_employee(employee_id) OR public.is_admin_or_hr()
    );

DROP POLICY IF EXISTS fe_self_update ON public.face_enrollments;
CREATE POLICY fe_self_update ON public.face_enrollments
    FOR UPDATE USING (
        public.is_own_employee(employee_id) OR public.is_admin_or_hr()
    )
    WITH CHECK (
        public.is_own_employee(employee_id) OR public.is_admin_or_hr()
    );

-- Drop the old admin-only policies so they don't conflict
DROP POLICY IF EXISTS fe_insert ON public.face_enrollments;
DROP POLICY IF EXISTS fe_update ON public.face_enrollments;
