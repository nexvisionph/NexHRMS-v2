-- ═══════════════════════════════════════════════════════════════
-- Migration 037: Fix RLS policies for deduction override tables
--
-- Issue: FOR ALL USING(...) without WITH CHECK blocks INSERT/UPDATE.
-- Fix: Drop old policies, recreate with both USING + WITH CHECK
--       using get_user_role() helper (consistent with 028, 029).
-- ═══════════════════════════════════════════════════════════════

-- ─── deduction_overrides ────────────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_deduction_overrides" ON public.deduction_overrides;
DROP POLICY IF EXISTS "employee_read_own_overrides" ON public.deduction_overrides;

-- Admin/HR/Finance/Payroll Admin: full CRUD
CREATE POLICY deduction_overrides_admin_all
    ON public.deduction_overrides
    FOR ALL
    USING (
        public.get_user_role() IN ('admin', 'hr', 'finance', 'payroll_admin')
    )
    WITH CHECK (
        public.get_user_role() IN ('admin', 'hr', 'finance', 'payroll_admin')
    );

-- Employees can read their own overrides
CREATE POLICY deduction_overrides_employee_select
    ON public.deduction_overrides
    FOR SELECT
    USING (
        employee_id IN (
            SELECT id FROM public.employees WHERE profile_id = auth.uid()
        )
    );

-- ─── deduction_global_defaults ──────────────────────────────────
DROP POLICY IF EXISTS "admin_manage_deduction_global_defaults" ON public.deduction_global_defaults;

-- Admin/HR/Finance/Payroll Admin: full CRUD
CREATE POLICY deduction_global_defaults_admin_all
    ON public.deduction_global_defaults
    FOR ALL
    USING (
        public.get_user_role() IN ('admin', 'hr', 'finance', 'payroll_admin')
    )
    WITH CHECK (
        public.get_user_role() IN ('admin', 'hr', 'finance', 'payroll_admin')
    );

-- All authenticated users can read global defaults (needed to compute payslips)
CREATE POLICY deduction_global_defaults_read
    ON public.deduction_global_defaults
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
