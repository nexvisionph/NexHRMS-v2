-- ============================================================
-- 010: Indexes for performance
-- ============================================================

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_events_employee ON public.attendance_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_events_ts ON public.attendance_events(timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_date ON public.attendance_logs(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_employee ON public.attendance_exceptions(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_location_pings_employee ON public.location_pings(employee_id, timestamp);

-- Payroll
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON public.payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_period ON public.payslips(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_run ON public.payroll_adjustments(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payslip_line_items_payslip ON public.payslip_line_items(payslip_id);

-- Loans
CREATE INDEX IF NOT EXISTS idx_loans_employee ON public.loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_loan_deductions_loan ON public.loan_deductions(loan_id);

-- Leave
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON public.leave_balances(employee_id, year);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_group ON public.tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_reports_task ON public.task_completion_reports(task_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notification_logs_employee ON public.notification_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Employees
CREATE INDEX IF NOT EXISTS idx_employees_profile ON public.employees(profile_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);

-- Timesheets
CREATE INDEX IF NOT EXISTS idx_timesheets_employee_date ON public.timesheets(employee_id, date);

-- Break records
CREATE INDEX IF NOT EXISTS idx_break_records_employee_date ON public.break_records(employee_id, date);

-- QR tokens
CREATE INDEX IF NOT EXISTS idx_qr_tokens_device ON public.qr_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON public.qr_tokens(token);
