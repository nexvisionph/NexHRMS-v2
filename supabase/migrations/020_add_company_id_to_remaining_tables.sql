-- ============================================================
-- 020: Add company_id to remaining attendance, loans, messaging tables
-- This adds nullable company_id to tables not covered in migration 017.
-- ============================================================

-- Attendance-related tables
ALTER TABLE IF EXISTS public.attendance_evidence
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_attendance_evidence_company_id ON public.attendance_evidence(company_id);
UPDATE public.attendance_evidence SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.attendance_exceptions
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_company_id ON public.attendance_exceptions(company_id);
UPDATE public.attendance_exceptions SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.break_records
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_break_records_company_id ON public.break_records(company_id);
UPDATE public.break_records SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.overtime_requests
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_overtime_requests_company_id ON public.overtime_requests(company_id);
UPDATE public.overtime_requests SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.location_pings
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_location_pings_company_id ON public.location_pings(company_id);
UPDATE public.location_pings SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.employee_shifts
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_employee_shifts_company_id ON public.employee_shifts(company_id);
UPDATE public.employee_shifts SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.penalty_records
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_penalty_records_company_id ON public.penalty_records(company_id);
UPDATE public.penalty_records SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.manual_checkins
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_manual_checkins_company_id ON public.manual_checkins(company_id);
UPDATE public.manual_checkins SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.site_survey_photos
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_site_survey_photos_company_id ON public.site_survey_photos(company_id);
UPDATE public.site_survey_photos SET company_id = 'default' WHERE company_id IS NULL;

-- Loan-related tables
ALTER TABLE IF EXISTS public.loan_deductions
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_loan_deductions_company_id ON public.loan_deductions(company_id);
UPDATE public.loan_deductions SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.loan_balance_history
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_loan_balance_history_company_id ON public.loan_balance_history(company_id);
UPDATE public.loan_balance_history SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.loan_repayment_schedule
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_loan_repayment_schedule_company_id ON public.loan_repayment_schedule(company_id);
UPDATE public.loan_repayment_schedule SET company_id = 'default' WHERE company_id IS NULL;

-- Task & Messaging tables
ALTER TABLE IF EXISTS public.task_completion_reports
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_task_completion_reports_company_id ON public.task_completion_reports(company_id);
UPDATE public.task_completion_reports SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.text_channels
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_text_channels_company_id ON public.text_channels(company_id);
UPDATE public.text_channels SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.channel_messages
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_channel_messages_company_id ON public.channel_messages(company_id);
UPDATE public.channel_messages SET company_id = 'default' WHERE company_id IS NULL;

-- Payroll-related tables
ALTER TABLE IF EXISTS public.salary_history
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_salary_history_company_id ON public.salary_history(company_id);
UPDATE public.salary_history SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.salary_change_requests
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_salary_change_requests_company_id ON public.salary_change_requests(company_id);
UPDATE public.salary_change_requests SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.final_pay_computations
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_final_pay_computations_company_id ON public.final_pay_computations(company_id);
UPDATE public.final_pay_computations SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.deduction_overrides
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_deduction_overrides_company_id ON public.deduction_overrides(company_id);
UPDATE public.deduction_overrides SET company_id = 'default' WHERE company_id IS NULL;

ALTER TABLE IF EXISTS public.employee_deduction_assignments
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_employee_deduction_assignments_company_id ON public.employee_deduction_assignments(company_id);
UPDATE public.employee_deduction_assignments SET company_id = 'default' WHERE company_id IS NULL;

-- Audit logs (consider per-company for compliance)
ALTER TABLE IF EXISTS public.audit_logs
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
UPDATE public.audit_logs SET company_id = 'default' WHERE company_id IS NULL;

-- End of migration 020.
