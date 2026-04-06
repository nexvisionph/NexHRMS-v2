-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 039: Fix payroll FK cascade behaviour
--
-- Problem: Deleting payslips or payroll_runs fails when child tables have
-- NOT NULL FK references (loan_deductions, payroll_run_payslips,
-- payroll_adjustments).  Nullable references (loan_balance_history,
-- loan_repayment_schedule, final_pay_computations) also block deletion.
--
-- Fix:
--   • NOT NULL FKs to payslips/runs → ON DELETE CASCADE
--     (when a payslip is deleted, these child records are meaningless)
--   • Nullable FKs to payslips        → ON DELETE SET NULL
--     (preserve the parent row but clear the reference)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── References to payslips ───────────────────────────────────────────────────

-- 1. loan_deductions.payslip_id  (NOT NULL → CASCADE)
ALTER TABLE public.loan_deductions
  DROP CONSTRAINT IF EXISTS fk_ld_payslip,
  ADD  CONSTRAINT fk_ld_payslip
       FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
       ON DELETE CASCADE;

-- 2. payroll_run_payslips.payslip_id  (NOT NULL junction → CASCADE)
ALTER TABLE public.payroll_run_payslips
  DROP CONSTRAINT IF EXISTS payroll_run_payslips_payslip_id_fkey,
  ADD  CONSTRAINT payroll_run_payslips_payslip_id_fkey
       FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
       ON DELETE CASCADE;

-- 3. payroll_adjustments.reference_payslip_id  (NOT NULL → CASCADE)
ALTER TABLE public.payroll_adjustments
  DROP CONSTRAINT IF EXISTS fk_pa_payslip,
  ADD  CONSTRAINT fk_pa_payslip
       FOREIGN KEY (reference_payslip_id) REFERENCES public.payslips(id)
       ON DELETE CASCADE;

-- 4. loan_balance_history.payslip_id  (nullable → SET NULL)
ALTER TABLE public.loan_balance_history
  DROP CONSTRAINT IF EXISTS fk_lbh_payslip,
  ADD  CONSTRAINT fk_lbh_payslip
       FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
       ON DELETE SET NULL;

-- 5. loan_repayment_schedule.payslip_id  (nullable → SET NULL)
ALTER TABLE public.loan_repayment_schedule
  DROP CONSTRAINT IF EXISTS fk_lrs_payslip,
  ADD  CONSTRAINT fk_lrs_payslip
       FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
       ON DELETE SET NULL;

-- 6. final_pay_computations.payslip_id  (nullable → SET NULL)
ALTER TABLE public.final_pay_computations
  DROP CONSTRAINT IF EXISTS fk_fpc_payslip,
  ADD  CONSTRAINT fk_fpc_payslip
       FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
       ON DELETE SET NULL;

-- ── References to payroll_runs ───────────────────────────────────────────────

-- 7. payroll_run_payslips.run_id  (NOT NULL junction → CASCADE)
ALTER TABLE public.payroll_run_payslips
  DROP CONSTRAINT IF EXISTS payroll_run_payslips_run_id_fkey,
  ADD  CONSTRAINT payroll_run_payslips_run_id_fkey
       FOREIGN KEY (run_id) REFERENCES public.payroll_runs(id)
       ON DELETE CASCADE;

-- 8. payroll_adjustments.payroll_run_id  (NOT NULL → CASCADE)
ALTER TABLE public.payroll_adjustments
  DROP CONSTRAINT IF EXISTS fk_pa_run,
  ADD  CONSTRAINT fk_pa_run
       FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id)
       ON DELETE CASCADE;
