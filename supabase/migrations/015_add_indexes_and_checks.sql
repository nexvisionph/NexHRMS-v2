-- ════════════════════════════════════════════════════════════════════
-- 015: Add missing indexes and CHECK constraints
-- Idempotent: IF NOT EXISTS for indexes, DO blocks for constraints
-- ════════════════════════════════════════════════════════════════════

-- ═══ Composite indexes for common query patterns ═══
CREATE INDEX IF NOT EXISTS idx_att_events_emp_ts ON public.attendance_events(employee_id, timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_leave_req_emp_dates ON public.leave_requests(employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payslips_batch ON public.payslips(payroll_batch_id);
CREATE INDEX IF NOT EXISTS idx_loan_ded_payslip ON public.loan_deductions(payslip_id);
CREATE INDEX IF NOT EXISTS idx_pings_emp_ts ON public.location_pings(employee_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_ts_status ON public.timesheets(status);
CREATE INDEX IF NOT EXISTS idx_notif_sent ON public.notification_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_tcr_employee ON public.task_completion_reports(employee_id);

-- ═══ CHECK constraints ═══

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_role_check') THEN
  ALTER TABLE public.employees ADD CONSTRAINT employees_role_check
    CHECK (role IN ('Admin','HR Admin','Finance','Employee','Supervisor','Payroll Admin','Auditor'));
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loans_type_check') THEN
  ALTER TABLE public.loans ADD CONSTRAINT loans_type_check
    CHECK (type IN ('cash_advance','salary_loan','sss','pagibig','other'));
END IF;
END $$;
