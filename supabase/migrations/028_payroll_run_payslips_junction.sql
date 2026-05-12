-- ============================================================
-- 028_payroll_run_payslips_junction.sql
-- Replace payroll_runs.payslip_ids text[] with proper junction table.
-- Maintains backward compatibility during transition.
-- ============================================================

-- ─── Junction table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_run_payslips (
    run_id      text NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
    payslip_id  text NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    added_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (run_id, payslip_id)
);

CREATE INDEX IF NOT EXISTS idx_prp_payslip ON public.payroll_run_payslips(payslip_id);

ALTER TABLE public.payroll_run_payslips ENABLE ROW LEVEL SECURITY;

-- RLS: match parent table (payroll_runs) access pattern
CREATE POLICY "payroll_run_payslips_read"
    ON public.payroll_run_payslips
    FOR SELECT
    TO authenticated
    USING (
        public.get_user_role() IN ('admin', 'finance', 'payroll_admin', 'auditor')
    );

CREATE POLICY "payroll_run_payslips_write"
    ON public.payroll_run_payslips
    FOR ALL
    TO authenticated
    USING (
        public.get_user_role() IN ('admin', 'finance', 'payroll_admin')
    )
    WITH CHECK (
        public.get_user_role() IN ('admin', 'finance', 'payroll_admin')
    );

-- ─── Migrate existing data ───────────────────────────────────
-- Move payslip_ids array entries into the junction table.

INSERT INTO public.payroll_run_payslips (run_id, payslip_id)
SELECT pr.id, unnest(pr.payslip_ids)
FROM public.payroll_runs pr
WHERE array_length(pr.payslip_ids, 1) > 0
ON CONFLICT DO NOTHING;

-- ─── Keep the old column but mark it deprecated ──────────────
-- The column will be dropped in a future migration after all code
-- has been migrated to use the junction table.
COMMENT ON COLUMN public.payroll_runs.payslip_ids
    IS 'DEPRECATED — use payroll_run_payslips junction table. Will be removed in a future migration.';
