-- ════════════════════════════════════════════════════════════════════
-- 014: Add missing foreign key constraints
-- Idempotent: uses DO blocks to check before adding
-- ════════════════════════════════════════════════════════════════════

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pings_employee') THEN
  ALTER TABLE public.location_pings
    ADD CONSTRAINT fk_pings_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_breaks_employee') THEN
  ALTER TABLE public.break_records
    ADD CONSTRAINT fk_breaks_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ssp_employee') THEN
  ALTER TABLE public.site_survey_photos
    ADD CONSTRAINT fk_ssp_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tcr_employee') THEN
  ALTER TABLE public.task_completion_reports
    ADD CONSTRAINT fk_tcr_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tc_employee') THEN
  ALTER TABLE public.task_comments
    ADD CONSTRAINT fk_tc_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cm_employee') THEN
  ALTER TABLE public.channel_messages
    ADD CONSTRAINT fk_cm_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_nl_employee') THEN
  ALTER TABLE public.notification_logs
    ADD CONSTRAINT fk_nl_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
END IF;
END $$;

-- ═══ Project ID references (SET NULL on delete) ═══

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ae_project') THEN
  ALTER TABLE public.attendance_events
    ADD CONSTRAINT fk_ae_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_al_project') THEN
  ALTER TABLE public.attendance_logs
    ADD CONSTRAINT fk_al_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ot_project') THEN
  ALTER TABLE public.overtime_requests
    ADD CONSTRAINT fk_ot_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_kd_project') THEN
  ALTER TABLE public.kiosk_devices
    ADD CONSTRAINT fk_kd_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_tg_project') THEN
  ALTER TABLE public.task_groups
    ADD CONSTRAINT fk_tg_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
END IF;
END $$;

-- ═══ Payslip references (SET NULL on delete) ═══

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ld_payslip') THEN
  ALTER TABLE public.loan_deductions
    ADD CONSTRAINT fk_ld_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id) ON DELETE SET NULL;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lrs_payslip') THEN
  ALTER TABLE public.loan_repayment_schedule
    ADD CONSTRAINT fk_lrs_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id) ON DELETE SET NULL;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_lbh_payslip') THEN
  ALTER TABLE public.loan_balance_history
    ADD CONSTRAINT fk_lbh_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id) ON DELETE SET NULL;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fpc_payslip') THEN
  ALTER TABLE public.final_pay_computations
    ADD CONSTRAINT fk_fpc_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id) ON DELETE SET NULL;
END IF;
END $$;

-- ═══ Payroll run references ═══

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pa_run') THEN
  ALTER TABLE public.payroll_adjustments
    ADD CONSTRAINT fk_pa_run FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id) ON DELETE CASCADE;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pa_payslip') THEN
  ALTER TABLE public.payroll_adjustments
    ADD CONSTRAINT fk_pa_payslip FOREIGN KEY (reference_payslip_id) REFERENCES public.payslips(id) ON DELETE CASCADE;
END IF;
END $$;

-- ═══ Shift/Employee references ═══

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_emp_shift') THEN
  ALTER TABLE public.employees
    ADD CONSTRAINT fk_emp_shift FOREIGN KEY (shift_id) REFERENCES public.shift_templates(id) ON DELETE SET NULL;
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_al_shift') THEN
  ALTER TABLE public.attendance_logs
    ADD CONSTRAINT fk_al_shift FOREIGN KEY (shift_id) REFERENCES public.shift_templates(id) ON DELETE SET NULL;
END IF;
END $$;
