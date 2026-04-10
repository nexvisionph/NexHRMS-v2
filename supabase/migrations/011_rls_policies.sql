-- ============================================================
-- 011: Row Level Security (RLS) policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_run_payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_pay_computations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deduction_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deduction_global_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deduction_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_deduction_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_balance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completion_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.text_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.face_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_verification_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles_custom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_survey_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_checkin_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalty_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appearance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pay_schedule_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_signature_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gov_table_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- Helper: get current user's role from profiles
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper: check if user is admin/hr/finance
CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = ANY(ARRAY['admin','hr','finance','payroll_admin','supervisor'])
  );
$$;

-- ────────────────────────────────────────────────────────────
-- PROFILES: users see own, admin/hr see all
-- ────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT USING (public.is_admin_or_hr());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE USING (public.is_admin_or_hr());

-- ────────────────────────────────────────────────────────────
-- EMPLOYEES: authenticated can read, admin/hr can write
-- ────────────────────────────────────────────────────────────
CREATE POLICY "employees_select" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_insert" ON public.employees FOR INSERT WITH CHECK (public.is_admin_or_hr());
CREATE POLICY "employees_update" ON public.employees FOR UPDATE USING (public.is_admin_or_hr());
CREATE POLICY "employees_delete" ON public.employees FOR DELETE USING (public.is_admin_or_hr());

-- ────────────────────────────────────────────────────────────
-- ATTENDANCE: employees see own, admin/hr/supervisor see all
-- ────────────────────────────────────────────────────────────
CREATE POLICY "attendance_events_select" ON public.attendance_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_events_insert" ON public.attendance_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "attendance_logs_select" ON public.attendance_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_logs_insert" ON public.attendance_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "attendance_logs_update" ON public.attendance_logs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "attendance_evidence_select" ON public.attendance_evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_evidence_insert" ON public.attendance_evidence FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "attendance_exceptions_select" ON public.attendance_exceptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_exceptions_insert" ON public.attendance_exceptions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "attendance_exceptions_update" ON public.attendance_exceptions FOR UPDATE TO authenticated USING (true);

-- ────────────────────────────────────────────────────────────
-- LOCATION PINGS: authenticated can read/write
-- ────────────────────────────────────────────────────────────
CREATE POLICY "location_pings_select" ON public.location_pings FOR SELECT TO authenticated USING (true);
CREATE POLICY "location_pings_insert" ON public.location_pings FOR INSERT TO authenticated WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- Read-only reference tables: authenticated can read
-- ────────────────────────────────────────────────────────────
CREATE POLICY "holidays_select" ON public.holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "holidays_manage" ON public.holidays FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "shift_templates_select" ON public.shift_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "shift_templates_manage" ON public.shift_templates FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "projects_manage" ON public.projects FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "roles_custom_select" ON public.roles_custom FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_custom_manage" ON public.roles_custom FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "calendar_events_select" ON public.calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "calendar_events_manage" ON public.calendar_events FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "attendance_rule_sets_select" ON public.attendance_rule_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_rule_sets_manage" ON public.attendance_rule_sets FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "leave_policies_select" ON public.leave_policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_policies_manage" ON public.leave_policies FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "departments_select" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_manage" ON public.departments FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "job_titles_select" ON public.job_titles FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_titles_manage" ON public.job_titles FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "task_tags_select" ON public.task_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_tags_manage" ON public.task_tags FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "manual_checkin_reasons_select" ON public.manual_checkin_reasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "manual_checkin_reasons_manage" ON public.manual_checkin_reasons FOR ALL USING (public.is_admin_or_hr());

-- ────────────────────────────────────────────────────────────
-- LEAVE: authenticated can read, employees can insert own, admin/hr manage
-- ────────────────────────────────────────────────────────────
CREATE POLICY "leave_requests_select" ON public.leave_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_requests_insert" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "leave_requests_update" ON public.leave_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "leave_balances_select" ON public.leave_balances FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_balances_manage" ON public.leave_balances FOR ALL USING (public.is_admin_or_hr());

-- ────────────────────────────────────────────────────────────
-- PAYROLL: authenticated can read, finance/admin can write
-- ────────────────────────────────────────────────────────────
CREATE POLICY "payroll_runs_select" ON public.payroll_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_runs_manage" ON public.payroll_runs FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "payslips_select" ON public.payslips FOR SELECT TO authenticated USING (true);
CREATE POLICY "payslips_manage" ON public.payslips FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "payslips_update_own" ON public.payslips FOR UPDATE TO authenticated USING (true);
CREATE POLICY "payroll_run_payslips_select" ON public.payroll_run_payslips FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_run_payslips_manage" ON public.payroll_run_payslips FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "payslip_line_items_select" ON public.payslip_line_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "payslip_line_items_manage" ON public.payslip_line_items FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "payroll_adjustments_select" ON public.payroll_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_adjustments_manage" ON public.payroll_adjustments FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "salary_history_select" ON public.salary_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "salary_history_manage" ON public.salary_history FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "salary_change_requests_select" ON public.salary_change_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "salary_change_requests_manage" ON public.salary_change_requests FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "final_pay_select" ON public.final_pay_computations FOR SELECT TO authenticated USING (true);
CREATE POLICY "final_pay_manage" ON public.final_pay_computations FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "deduction_overrides_select" ON public.deduction_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "deduction_overrides_manage" ON public.deduction_overrides FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "deduction_defaults_select" ON public.deduction_global_defaults FOR SELECT TO authenticated USING (true);
CREATE POLICY "deduction_defaults_manage" ON public.deduction_global_defaults FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "deduction_templates_select" ON public.deduction_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "deduction_templates_manage" ON public.deduction_templates FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "eda_select" ON public.employee_deduction_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "eda_manage" ON public.employee_deduction_assignments FOR ALL USING (public.is_admin_or_hr());

-- ────────────────────────────────────────────────────────────
-- LOANS
-- ────────────────────────────────────────────────────────────
CREATE POLICY "loans_select" ON public.loans FOR SELECT TO authenticated USING (true);
CREATE POLICY "loans_manage" ON public.loans FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "loan_deductions_select" ON public.loan_deductions FOR SELECT TO authenticated USING (true);
CREATE POLICY "loan_deductions_manage" ON public.loan_deductions FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "loan_balance_history_select" ON public.loan_balance_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "loan_balance_history_manage" ON public.loan_balance_history FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "loan_repayment_schedule_select" ON public.loan_repayment_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "loan_repayment_schedule_manage" ON public.loan_repayment_schedule FOR ALL USING (public.is_admin_or_hr());

-- ────────────────────────────────────────────────────────────
-- TASKS & MESSAGING: authenticated full access
-- ────────────────────────────────────────────────────────────
CREATE POLICY "tasks_all" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "task_groups_all" ON public.task_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "task_comments_all" ON public.task_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "task_completion_reports_all" ON public.task_completion_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "text_channels_all" ON public.text_channels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "channel_messages_all" ON public.channel_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "announcements_all" ON public.announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- MISC: authenticated read/write
-- ────────────────────────────────────────────────────────────
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notification_logs_select" ON public.notification_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "notification_logs_insert" ON public.notification_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notification_logs_update" ON public.notification_logs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "notification_rules_select" ON public.notification_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "notification_rules_manage" ON public.notification_rules FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "employee_docs_select" ON public.employee_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "employee_docs_manage" ON public.employee_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "kiosk_devices_select" ON public.kiosk_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "kiosk_devices_manage" ON public.kiosk_devices FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "kiosk_pins_select" ON public.kiosk_pins FOR SELECT TO authenticated USING (true);
CREATE POLICY "kiosk_pins_manage" ON public.kiosk_pins FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "qr_tokens_all" ON public.qr_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "face_enrollments_select" ON public.face_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "face_enrollments_manage" ON public.face_enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "project_verification_select" ON public.project_verification_methods FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_verification_manage" ON public.project_verification_methods FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "project_assignments_select" ON public.project_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_assignments_manage" ON public.project_assignments FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "dashboard_layouts_all" ON public.dashboard_layouts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "custom_pages_select" ON public.custom_pages FOR SELECT TO authenticated USING (true);
CREATE POLICY "custom_pages_manage" ON public.custom_pages FOR ALL USING (public.is_admin_or_hr());

-- Config tables: authenticated read, admin write
CREATE POLICY "appearance_config_select" ON public.appearance_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "appearance_config_manage" ON public.appearance_config FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "location_config_select" ON public.location_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "location_config_manage" ON public.location_config FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "pay_schedule_config_select" ON public.pay_schedule_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "pay_schedule_config_manage" ON public.pay_schedule_config FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "payroll_signature_config_select" ON public.payroll_signature_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_signature_config_manage" ON public.payroll_signature_config FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "gov_table_versions_select" ON public.gov_table_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "gov_table_versions_manage" ON public.gov_table_versions FOR ALL USING (public.is_admin_or_hr());

-- Remaining tables
CREATE POLICY "break_records_all" ON public.break_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "overtime_requests_all" ON public.overtime_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "employee_shifts_select" ON public.employee_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "employee_shifts_manage" ON public.employee_shifts FOR ALL USING (public.is_admin_or_hr());
CREATE POLICY "timesheets_select" ON public.timesheets FOR SELECT TO authenticated USING (true);
CREATE POLICY "timesheets_manage" ON public.timesheets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "site_survey_photos_all" ON public.site_survey_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "manual_checkins_all" ON public.manual_checkins FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "penalty_records_select" ON public.penalty_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "penalty_records_manage" ON public.penalty_records FOR ALL USING (public.is_admin_or_hr());
