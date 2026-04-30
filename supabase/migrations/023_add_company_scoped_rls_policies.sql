-- ============================================================
-- 023: Enable RLS and add company-scoped policies (Phase 3)
-- This migration enables Row Level Security on the companies table
-- and adds company-scoped policies to all business tables.
-- IMPORTANT: This assumes JWT claims include 'company_id'.
-- If using a different claim name, adjust the policies accordingly.
-- ============================================================

-- Enable RLS on companies table
ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;

-- Companies: allow users to see/modify rows for their company
CREATE POLICY IF NOT EXISTS companies_company_scope ON public.companies
  FOR ALL
  USING (id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (id = current_setting('jwt.claims.company_id', true));

-- Allow admins to bypass company scope (optional)
CREATE POLICY IF NOT EXISTS companies_admin_bypass ON public.companies
  FOR ALL
  USING (current_setting('jwt.claims.role', true) = 'admin')
  WITH CHECK (current_setting('jwt.claims.role', true) = 'admin');

-- ============================================================
-- Business Tables - Company-Scoped Policies
-- ============================================================

-- Profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_company_scope ON public.profiles;
CREATE POLICY profiles_company_scope ON public.profiles
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Employees
ALTER TABLE IF EXISTS public.employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employees_company_scope ON public.employees;
CREATE POLICY employees_company_scope ON public.employees
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Projects
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS projects_company_scope ON public.projects;
CREATE POLICY projects_company_scope ON public.projects
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Project assignments
ALTER TABLE IF EXISTS public.project_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_assignments_company_scope ON public.project_assignments;
CREATE POLICY project_assignments_company_scope ON public.project_assignments
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Project verification methods
ALTER TABLE IF EXISTS public.project_verification_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_verification_methods_company_scope ON public.project_verification_methods;
CREATE POLICY project_verification_methods_company_scope ON public.project_verification_methods
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Tasks
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tasks_company_scope ON public.tasks;
CREATE POLICY tasks_company_scope ON public.tasks
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Task groups
ALTER TABLE IF EXISTS public.task_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_groups_company_scope ON public.task_groups;
CREATE POLICY task_groups_company_scope ON public.task_groups
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Task comments
ALTER TABLE IF EXISTS public.task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_comments_company_scope ON public.task_comments;
CREATE POLICY task_comments_company_scope ON public.task_comments
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Task completion reports
ALTER TABLE IF EXISTS public.task_completion_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_completion_reports_company_scope ON public.task_completion_reports;
CREATE POLICY task_completion_reports_company_scope ON public.task_completion_reports
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Announcements
ALTER TABLE IF EXISTS public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS announcements_company_scope ON public.announcements;
CREATE POLICY announcements_company_scope ON public.announcements
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Notification logs
ALTER TABLE IF EXISTS public.notification_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_logs_company_scope ON public.notification_logs;
CREATE POLICY notification_logs_company_scope ON public.notification_logs
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Notification rules
ALTER TABLE IF EXISTS public.notification_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_rules_company_scope ON public.notification_rules;
CREATE POLICY notification_rules_company_scope ON public.notification_rules
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Text channels
ALTER TABLE IF EXISTS public.text_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS text_channels_company_scope ON public.text_channels;
CREATE POLICY text_channels_company_scope ON public.text_channels
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Channel messages
ALTER TABLE IF EXISTS public.channel_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS channel_messages_company_scope ON public.channel_messages;
CREATE POLICY channel_messages_company_scope ON public.channel_messages
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- ============================================================
-- Attendance Tables - Company-Scoped Policies
-- ============================================================

-- Attendance events
ALTER TABLE IF EXISTS public.attendance_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_events_company_scope ON public.attendance_events;
CREATE POLICY attendance_events_company_scope ON public.attendance_events
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Attendance evidence
ALTER TABLE IF EXISTS public.attendance_evidence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_evidence_company_scope ON public.attendance_evidence;
CREATE POLICY attendance_evidence_company_scope ON public.attendance_evidence
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Attendance exceptions
ALTER TABLE IF EXISTS public.attendance_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_exceptions_company_scope ON public.attendance_exceptions;
CREATE POLICY attendance_exceptions_company_scope ON public.attendance_exceptions
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Attendance logs
ALTER TABLE IF EXISTS public.attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_logs_company_scope ON public.attendance_logs;
CREATE POLICY attendance_logs_company_scope ON public.attendance_logs
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Break records
ALTER TABLE IF EXISTS public.break_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS break_records_company_scope ON public.break_records;
CREATE POLICY break_records_company_scope ON public.break_records
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Overtime requests
ALTER TABLE IF EXISTS public.overtime_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS overtime_requests_company_scope ON public.overtime_requests;
CREATE POLICY overtime_requests_company_scope ON public.overtime_requests
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Location pings
ALTER TABLE IF EXISTS public.location_pings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS location_pings_company_scope ON public.location_pings;
CREATE POLICY location_pings_company_scope ON public.location_pings
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Employee shifts
ALTER TABLE IF EXISTS public.employee_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_shifts_company_scope ON public.employee_shifts;
CREATE POLICY employee_shifts_company_scope ON public.employee_shifts
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Penalty records
ALTER TABLE IF EXISTS public.penalty_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS penalty_records_company_scope ON public.penalty_records;
CREATE POLICY penalty_records_company_scope ON public.penalty_records
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Manual checkins
ALTER TABLE IF EXISTS public.manual_checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manual_checkins_company_scope ON public.manual_checkins;
CREATE POLICY manual_checkins_company_scope ON public.manual_checkins
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Site survey photos
ALTER TABLE IF EXISTS public.site_survey_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_survey_photos_company_scope ON public.site_survey_photos;
CREATE POLICY site_survey_photos_company_scope ON public.site_survey_photos
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Timesheets
ALTER TABLE IF EXISTS public.timesheets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS timesheets_company_scope ON public.timesheets;
CREATE POLICY timesheets_company_scope ON public.timesheets
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- ============================================================
-- Leave Tables - Company-Scoped Policies
-- ============================================================

-- Leave requests
ALTER TABLE IF EXISTS public.leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leave_requests_company_scope ON public.leave_requests;
CREATE POLICY leave_requests_company_scope ON public.leave_requests
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Leave balances
ALTER TABLE IF EXISTS public.leave_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leave_balances_company_scope ON public.leave_balances;
CREATE POLICY leave_balances_company_scope ON public.leave_balances
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- ============================================================
-- Payroll Tables - Company-Scoped Policies
-- ============================================================

-- Payroll runs
ALTER TABLE IF EXISTS public.payroll_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_runs_company_scope ON public.payroll_runs;
CREATE POLICY payroll_runs_company_scope ON public.payroll_runs
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Payslips
ALTER TABLE IF EXISTS public.payslips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payslips_company_scope ON public.payslips;
CREATE POLICY payslips_company_scope ON public.payslips
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Payroll run payslips
ALTER TABLE IF EXISTS public.payroll_run_payslips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_run_payslips_company_scope ON public.payroll_run_payslips;
CREATE POLICY payroll_run_payslips_company_scope ON public.payroll_run_payslips
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Payslip line items
ALTER TABLE IF EXISTS public.payslip_line_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payslip_line_items_company_scope ON public.payslip_line_items;
CREATE POLICY payslip_line_items_company_scope ON public.payslip_line_items
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Salary history
ALTER TABLE IF EXISTS public.salary_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS salary_history_company_scope ON public.salary_history;
CREATE POLICY salary_history_company_scope ON public.salary_history
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Salary change requests
ALTER TABLE IF EXISTS public.salary_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS salary_change_requests_company_scope ON public.salary_change_requests;
CREATE POLICY salary_change_requests_company_scope ON public.salary_change_requests
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Final pay computations
ALTER TABLE IF EXISTS public.final_pay_computations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS final_pay_computations_company_scope ON public.final_pay_computations;
CREATE POLICY final_pay_computations_company_scope ON public.final_pay_computations
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Deduction overrides
ALTER TABLE IF EXISTS public.deduction_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deduction_overrides_company_scope ON public.deduction_overrides;
CREATE POLICY deduction_overrides_company_scope ON public.deduction_overrides
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Employee deduction assignments
ALTER TABLE IF EXISTS public.employee_deduction_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_deduction_assignments_company_scope ON public.employee_deduction_assignments;
CREATE POLICY employee_deduction_assignments_company_scope ON public.employee_deduction_assignments
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- ============================================================
-- Loan Tables - Company-Scoped Policies
-- ============================================================

-- Loans
ALTER TABLE IF EXISTS public.loans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loans_company_scope ON public.loans;
CREATE POLICY loans_company_scope ON public.loans
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Loan deductions
ALTER TABLE IF EXISTS public.loan_deductions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loan_deductions_company_scope ON public.loan_deductions;
CREATE POLICY loan_deductions_company_scope ON public.loan_deductions
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Loan balance history
ALTER TABLE IF EXISTS public.loan_balance_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loan_balance_history_company_scope ON public.loan_balance_history;
CREATE POLICY loan_balance_history_company_scope ON public.loan_balance_history
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Loan repayment schedule
ALTER TABLE IF EXISTS public.loan_repayment_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loan_repayment_schedule_company_scope ON public.loan_repayment_schedule;
CREATE POLICY loan_repayment_schedule_company_scope ON public.loan_repayment_schedule
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- ============================================================
-- Other Tables - Company-Scoped Policies
-- ============================================================

-- Employee documents
ALTER TABLE IF EXISTS public.employee_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_documents_company_scope ON public.employee_documents;
CREATE POLICY employee_documents_company_scope ON public.employee_documents
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Push subscriptions
ALTER TABLE IF EXISTS public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscriptions_company_scope ON public.push_subscriptions;
CREATE POLICY push_subscriptions_company_scope ON public.push_subscriptions
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Kiosk devices
ALTER TABLE IF EXISTS public.kiosk_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kiosk_devices_company_scope ON public.kiosk_devices;
CREATE POLICY kiosk_devices_company_scope ON public.kiosk_devices
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Kiosk pins
ALTER TABLE IF EXISTS public.kiosk_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kiosk_pins_company_scope ON public.kiosk_pins;
CREATE POLICY kiosk_pins_company_scope ON public.kiosk_pins
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- QR tokens
ALTER TABLE IF EXISTS public.qr_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS qr_tokens_company_scope ON public.qr_tokens;
CREATE POLICY qr_tokens_company_scope ON public.qr_tokens
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Face enrollments
ALTER TABLE IF EXISTS public.face_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS face_enrollments_company_scope ON public.face_enrollments;
CREATE POLICY face_enrollments_company_scope ON public.face_enrollments
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Dashboard layouts
ALTER TABLE IF EXISTS public.dashboard_layouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dashboard_layouts_company_scope ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_company_scope ON public.dashboard_layouts
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Custom pages
ALTER TABLE IF EXISTS public.custom_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custom_pages_company_scope ON public.custom_pages;
CREATE POLICY custom_pages_company_scope ON public.custom_pages
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Appearance config
ALTER TABLE IF EXISTS public.appearance_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS appearance_config_company_scope ON public.appearance_config;
CREATE POLICY appearance_config_company_scope ON public.appearance_config
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- ============================================================
-- Configuration Tables - Company-Scoped Policies
-- ============================================================

-- Location config
ALTER TABLE IF EXISTS public.location_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS location_config_company_scope ON public.location_config;
CREATE POLICY location_config_company_scope ON public.location_config
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Pay schedule config
ALTER TABLE IF EXISTS public.pay_schedule_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pay_schedule_config_company_scope ON public.pay_schedule_config;
CREATE POLICY pay_schedule_config_company_scope ON public.pay_schedule_config
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Payroll signature config
ALTER TABLE IF EXISTS public.payroll_signature_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payroll_signature_config_company_scope ON public.payroll_signature_config;
CREATE POLICY payroll_signature_config_company_scope ON public.payroll_signature_config
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Deduction global defaults
ALTER TABLE IF EXISTS public.deduction_global_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deduction_global_defaults_company_scope ON public.deduction_global_defaults;
CREATE POLICY deduction_global_defaults_company_scope ON public.deduction_global_defaults
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Deduction templates
ALTER TABLE IF EXISTS public.deduction_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deduction_templates_company_scope ON public.deduction_templates;
CREATE POLICY deduction_templates_company_scope ON public.deduction_templates
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- ============================================================
-- Foundation Tables - Company-Scoped Policies
-- ============================================================

-- Roles custom
ALTER TABLE IF EXISTS public.roles_custom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_custom_company_scope ON public.roles_custom;
CREATE POLICY roles_custom_company_scope ON public.roles_custom
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Job titles
ALTER TABLE IF EXISTS public.job_titles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_titles_company_scope ON public.job_titles;
CREATE POLICY job_titles_company_scope ON public.job_titles
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Departments
ALTER TABLE IF EXISTS public.departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS departments_company_scope ON public.departments;
CREATE POLICY departments_company_scope ON public.departments
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Shift templates
ALTER TABLE IF EXISTS public.shift_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shift_templates_company_scope ON public.shift_templates;
CREATE POLICY shift_templates_company_scope ON public.shift_templates
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Leave policies
ALTER TABLE IF EXISTS public.leave_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS leave_policies_company_scope ON public.leave_policies;
CREATE POLICY leave_policies_company_scope ON public.leave_policies
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Holidays
ALTER TABLE IF EXISTS public.holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS holidays_company_scope ON public.holidays;
CREATE POLICY holidays_company_scope ON public.holidays
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Attendance rule sets
ALTER TABLE IF EXISTS public.attendance_rule_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_rule_sets_company_scope ON public.attendance_rule_sets;
CREATE POLICY attendance_rule_sets_company_scope ON public.attendance_rule_sets
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Task tags
ALTER TABLE IF EXISTS public.task_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_tags_company_scope ON public.task_tags;
CREATE POLICY task_tags_company_scope ON public.task_tags
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Manual checkin reasons
ALTER TABLE IF EXISTS public.manual_checkin_reasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS manual_checkin_reasons_company_scope ON public.manual_checkin_reasons;
CREATE POLICY manual_checkin_reasons_company_scope ON public.manual_checkin_reasons
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Calendar events
ALTER TABLE IF EXISTS public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS calendar_events_company_scope ON public.calendar_events;
CREATE POLICY calendar_events_company_scope ON public.calendar_events
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- Audit logs
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_company_scope ON public.audit_logs;
CREATE POLICY audit_logs_company_scope ON public.audit_logs
  FOR ALL
  USING (company_id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (company_id = current_setting('jwt.claims.company_id', true));

-- ============================================================
-- Notes for Follow-Up
-- ============================================================
-- 1) This migration assumes JWT claims include 'company_id'.
--    If using a different claim name, update the policies accordingly.
-- 2) The policies use DROP POLICY IF EXISTS to handle re-runs safely.
-- 3) Test these policies thoroughly in staging before production deployment.
-- 4) Some tables may require additional policies for service role access (e.g., audit logs).

-- End of migration 023.
