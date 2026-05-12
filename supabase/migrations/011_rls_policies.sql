-- ============================================================
-- 011_rls_policies.sql
-- Comprehensive Row Level Security for all tables (002-010)
-- Depends on: get_user_role() and is_admin_or_hr() from 001
-- ============================================================

-- ─── Helper: check if user is the employee (via profiles.id → employees.profile_id) ──
CREATE OR REPLACE FUNCTION public.is_own_employee(emp_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = emp_id AND profile_id = auth.uid()
  );
$$;

-- ════════════════════════════════════════════════════════════
-- EMPLOYEES (002)
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS employees_read_own ON public.employees;
CREATE POLICY employees_read_own ON public.employees
    FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS employees_read_admin ON public.employees;
CREATE POLICY employees_read_admin ON public.employees
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS employees_manage_admin ON public.employees;
CREATE POLICY employees_manage_admin ON public.employees
    FOR ALL USING (public.is_admin_or_hr());

-- Salary Change Requests
DROP POLICY IF EXISTS scr_read_own ON public.salary_change_requests;
CREATE POLICY scr_read_own ON public.salary_change_requests
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS scr_read_admin ON public.salary_change_requests;
CREATE POLICY scr_read_admin ON public.salary_change_requests
    FOR SELECT USING (public.get_user_role() IN ('admin','hr','finance'));

DROP POLICY IF EXISTS scr_manage ON public.salary_change_requests;
CREATE POLICY scr_manage ON public.salary_change_requests
    FOR ALL USING (public.get_user_role() IN ('admin','hr','finance'));

-- Salary History
DROP POLICY IF EXISTS sh_read_own ON public.salary_history;
CREATE POLICY sh_read_own ON public.salary_history
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS sh_read_admin ON public.salary_history;
CREATE POLICY sh_read_admin ON public.salary_history
    FOR SELECT USING (public.get_user_role() IN ('admin','hr','finance','auditor'));

DROP POLICY IF EXISTS sh_manage ON public.salary_history;
CREATE POLICY sh_manage ON public.salary_history
    FOR ALL USING (public.get_user_role() IN ('admin','hr','finance'));

-- Employee Documents
DROP POLICY IF EXISTS ed_read_own ON public.employee_documents;
CREATE POLICY ed_read_own ON public.employee_documents
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS ed_read_admin ON public.employee_documents;
CREATE POLICY ed_read_admin ON public.employee_documents
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS ed_manage ON public.employee_documents;
CREATE POLICY ed_manage ON public.employee_documents
    FOR ALL USING (public.is_admin_or_hr());

-- ════════════════════════════════════════════════════════════
-- ROLES (003)
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS roles_read_all ON public.roles_custom;
CREATE POLICY roles_read_all ON public.roles_custom
    FOR SELECT USING (true);

DROP POLICY IF EXISTS roles_manage_admin ON public.roles_custom;
CREATE POLICY roles_manage_admin ON public.roles_custom
    FOR ALL USING (public.get_user_role() = 'admin');

-- ════════════════════════════════════════════════════════════
-- ATTENDANCE (004)
-- ════════════════════════════════════════════════════════════

-- Events: append-only (insert + read)
DROP POLICY IF EXISTS ae_read_own ON public.attendance_events;
CREATE POLICY ae_read_own ON public.attendance_events
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS ae_read_admin ON public.attendance_events;
CREATE POLICY ae_read_admin ON public.attendance_events
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS ae_insert ON public.attendance_events;
CREATE POLICY ae_insert ON public.attendance_events
    FOR INSERT WITH CHECK (public.is_own_employee(employee_id) OR public.is_admin_or_hr());

-- Evidence
DROP POLICY IF EXISTS aev_read_own ON public.attendance_evidence;
CREATE POLICY aev_read_own ON public.attendance_evidence
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.attendance_events e
            WHERE e.id = attendance_evidence.event_id
            AND public.is_own_employee(e.employee_id)
        )
    );

DROP POLICY IF EXISTS aev_read_admin ON public.attendance_evidence;
CREATE POLICY aev_read_admin ON public.attendance_evidence
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS aev_insert ON public.attendance_evidence;
CREATE POLICY aev_insert ON public.attendance_evidence
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attendance_events e
            WHERE e.id = attendance_evidence.event_id
            AND (public.is_own_employee(e.employee_id) OR public.is_admin_or_hr())
        )
    );

-- Exceptions
DROP POLICY IF EXISTS aex_read_own ON public.attendance_exceptions;
CREATE POLICY aex_read_own ON public.attendance_exceptions
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS aex_read_admin ON public.attendance_exceptions;
CREATE POLICY aex_read_admin ON public.attendance_exceptions
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS aex_manage ON public.attendance_exceptions;
CREATE POLICY aex_manage ON public.attendance_exceptions
    FOR ALL USING (public.is_admin_or_hr());

-- Attendance Logs
DROP POLICY IF EXISTS al_read_own ON public.attendance_logs;
CREATE POLICY al_read_own ON public.attendance_logs
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS al_read_admin ON public.attendance_logs;
CREATE POLICY al_read_admin ON public.attendance_logs
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS al_manage ON public.attendance_logs;
CREATE POLICY al_manage ON public.attendance_logs
    FOR ALL USING (public.is_admin_or_hr());

-- Shift Templates
DROP POLICY IF EXISTS st_read_all ON public.shift_templates;
CREATE POLICY st_read_all ON public.shift_templates
    FOR SELECT USING (true);

DROP POLICY IF EXISTS st_manage ON public.shift_templates;
CREATE POLICY st_manage ON public.shift_templates
    FOR ALL USING (public.is_admin_or_hr());

-- Employee Shifts
DROP POLICY IF EXISTS es_read_own ON public.employee_shifts;
CREATE POLICY es_read_own ON public.employee_shifts
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS es_read_admin ON public.employee_shifts;
CREATE POLICY es_read_admin ON public.employee_shifts
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS es_manage ON public.employee_shifts;
CREATE POLICY es_manage ON public.employee_shifts
    FOR ALL USING (public.is_admin_or_hr());

-- Holidays
DROP POLICY IF EXISTS hol_read_all ON public.holidays;
CREATE POLICY hol_read_all ON public.holidays
    FOR SELECT USING (true);

DROP POLICY IF EXISTS hol_manage ON public.holidays;
CREATE POLICY hol_manage ON public.holidays
    FOR ALL USING (public.is_admin_or_hr());

-- Overtime Requests
DROP POLICY IF EXISTS otr_read_own ON public.overtime_requests;
CREATE POLICY otr_read_own ON public.overtime_requests
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS otr_read_admin ON public.overtime_requests;
CREATE POLICY otr_read_admin ON public.overtime_requests
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS otr_insert_own ON public.overtime_requests;
CREATE POLICY otr_insert_own ON public.overtime_requests
    FOR INSERT WITH CHECK (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS otr_manage ON public.overtime_requests;
CREATE POLICY otr_manage ON public.overtime_requests
    FOR ALL USING (public.is_admin_or_hr());

-- Penalty Records
DROP POLICY IF EXISTS pr_read_own ON public.penalty_records;
CREATE POLICY pr_read_own ON public.penalty_records
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS pr_read_admin ON public.penalty_records;
CREATE POLICY pr_read_admin ON public.penalty_records
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS pr_manage ON public.penalty_records;
CREATE POLICY pr_manage ON public.penalty_records
    FOR ALL USING (public.is_admin_or_hr());

-- ════════════════════════════════════════════════════════════
-- LEAVE (005)
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS lp_read_all ON public.leave_policies;
CREATE POLICY lp_read_all ON public.leave_policies
    FOR SELECT USING (true);

DROP POLICY IF EXISTS lp_manage ON public.leave_policies;
CREATE POLICY lp_manage ON public.leave_policies
    FOR ALL USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS lb_read_own ON public.leave_balances;
CREATE POLICY lb_read_own ON public.leave_balances
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS lb_read_admin ON public.leave_balances;
CREATE POLICY lb_read_admin ON public.leave_balances
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS lb_manage ON public.leave_balances;
CREATE POLICY lb_manage ON public.leave_balances
    FOR ALL USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS lr_read_own ON public.leave_requests;
CREATE POLICY lr_read_own ON public.leave_requests
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS lr_read_admin ON public.leave_requests;
CREATE POLICY lr_read_admin ON public.leave_requests
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS lr_insert_own ON public.leave_requests;
CREATE POLICY lr_insert_own ON public.leave_requests
    FOR INSERT WITH CHECK (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS lr_manage ON public.leave_requests;
CREATE POLICY lr_manage ON public.leave_requests
    FOR ALL USING (public.is_admin_or_hr());

-- ════════════════════════════════════════════════════════════
-- PAYROLL (006)
-- ════════════════════════════════════════════════════════════

-- Pay Schedule Config
DROP POLICY IF EXISTS psc_read_all ON public.pay_schedule_config;
CREATE POLICY psc_read_all ON public.pay_schedule_config
    FOR SELECT USING (true);

DROP POLICY IF EXISTS psc_manage ON public.pay_schedule_config;
CREATE POLICY psc_manage ON public.pay_schedule_config
    FOR ALL USING (public.get_user_role() IN ('admin','finance','payroll_admin'));

-- Payroll Runs
DROP POLICY IF EXISTS prun_read ON public.payroll_runs;
CREATE POLICY prun_read ON public.payroll_runs
    FOR SELECT USING (public.get_user_role() IN ('admin','finance','payroll_admin','auditor'));

DROP POLICY IF EXISTS prun_manage ON public.payroll_runs;
CREATE POLICY prun_manage ON public.payroll_runs
    FOR ALL USING (public.get_user_role() IN ('admin','finance','payroll_admin'));

-- Payslips
DROP POLICY IF EXISTS ps_read_own ON public.payslips;
CREATE POLICY ps_read_own ON public.payslips
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS ps_read_admin ON public.payslips;
CREATE POLICY ps_read_admin ON public.payslips
    FOR SELECT USING (public.get_user_role() IN ('admin','finance','payroll_admin','hr','auditor'));

DROP POLICY IF EXISTS ps_manage ON public.payslips;
CREATE POLICY ps_manage ON public.payslips
    FOR ALL USING (public.get_user_role() IN ('admin','finance','payroll_admin'));

-- Payroll Adjustments
DROP POLICY IF EXISTS pa_read ON public.payroll_adjustments;
CREATE POLICY pa_read ON public.payroll_adjustments
    FOR SELECT USING (public.get_user_role() IN ('admin','finance','payroll_admin','auditor'));

DROP POLICY IF EXISTS pa_manage ON public.payroll_adjustments;
CREATE POLICY pa_manage ON public.payroll_adjustments
    FOR ALL USING (public.get_user_role() IN ('admin','finance','payroll_admin'));

-- Final Pay
DROP POLICY IF EXISTS fp_read_own ON public.final_pay_computations;
CREATE POLICY fp_read_own ON public.final_pay_computations
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS fp_read_admin ON public.final_pay_computations;
CREATE POLICY fp_read_admin ON public.final_pay_computations
    FOR SELECT USING (public.get_user_role() IN ('admin','finance','payroll_admin','hr','auditor'));

DROP POLICY IF EXISTS fp_manage ON public.final_pay_computations;
CREATE POLICY fp_manage ON public.final_pay_computations
    FOR ALL USING (public.get_user_role() IN ('admin','finance','payroll_admin'));

-- ════════════════════════════════════════════════════════════
-- LOANS (007)
-- ════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS loan_read_own ON public.loans;
CREATE POLICY loan_read_own ON public.loans
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS loan_read_admin ON public.loans;
CREATE POLICY loan_read_admin ON public.loans
    FOR SELECT USING (public.get_user_role() IN ('admin','finance','payroll_admin','hr','auditor'));

DROP POLICY IF EXISTS loan_manage ON public.loans;
CREATE POLICY loan_manage ON public.loans
    FOR ALL USING (public.get_user_role() IN ('admin','finance','payroll_admin'));

DROP POLICY IF EXISTS ld_read_own ON public.loan_deductions;
CREATE POLICY ld_read_own ON public.loan_deductions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_deductions.loan_id AND public.is_own_employee(l.employee_id))
    );

DROP POLICY IF EXISTS ld_read_admin ON public.loan_deductions;
CREATE POLICY ld_read_admin ON public.loan_deductions
    FOR SELECT USING (public.get_user_role() IN ('admin','finance','payroll_admin','auditor'));

DROP POLICY IF EXISTS ld_manage ON public.loan_deductions;
CREATE POLICY ld_manage ON public.loan_deductions
    FOR ALL USING (public.get_user_role() IN ('admin','finance','payroll_admin'));

DROP POLICY IF EXISTS lrs_read ON public.loan_repayment_schedule;
CREATE POLICY lrs_read ON public.loan_repayment_schedule
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_repayment_schedule.loan_id AND (public.is_own_employee(l.employee_id) OR public.get_user_role() IN ('admin','finance','payroll_admin','auditor')))
    );

DROP POLICY IF EXISTS lrs_manage ON public.loan_repayment_schedule;
CREATE POLICY lrs_manage ON public.loan_repayment_schedule
    FOR ALL USING (public.get_user_role() IN ('admin','finance','payroll_admin'));

DROP POLICY IF EXISTS lbh_read ON public.loan_balance_history;
CREATE POLICY lbh_read ON public.loan_balance_history
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.loans l WHERE l.id = loan_balance_history.loan_id AND (public.is_own_employee(l.employee_id) OR public.get_user_role() IN ('admin','finance','payroll_admin','auditor')))
    );

DROP POLICY IF EXISTS lbh_manage ON public.loan_balance_history;
CREATE POLICY lbh_manage ON public.loan_balance_history
    FOR ALL USING (public.get_user_role() IN ('admin','finance','payroll_admin'));

-- ════════════════════════════════════════════════════════════
-- TASKS & MESSAGING (008)
-- ════════════════════════════════════════════════════════════

-- Task Groups: members can read, admin/hr/supervisor can manage
DROP POLICY IF EXISTS tg_read_member ON public.task_groups;
CREATE POLICY tg_read_member ON public.task_groups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
            AND e.id = ANY(task_groups.member_employee_ids)
        )
        OR public.is_admin_or_hr()
    );

DROP POLICY IF EXISTS tg_manage ON public.task_groups;
CREATE POLICY tg_manage ON public.task_groups
    FOR ALL USING (public.get_user_role() IN ('admin','hr','supervisor'));

-- Tasks: assigned members or group members can read
DROP POLICY IF EXISTS tasks_read ON public.tasks;
CREATE POLICY tasks_read ON public.tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
            AND (e.id = ANY(tasks.assigned_to))
        )
        OR EXISTS (
            SELECT 1 FROM public.task_groups tg
            JOIN public.employees e ON e.profile_id = auth.uid()
            WHERE tg.id = tasks.group_id
            AND e.id = ANY(tg.member_employee_ids)
        )
        OR public.is_admin_or_hr()
    );

DROP POLICY IF EXISTS tasks_manage ON public.tasks;
CREATE POLICY tasks_manage ON public.tasks
    FOR ALL USING (public.get_user_role() IN ('admin','hr','supervisor'));

-- Task Completion Reports
DROP POLICY IF EXISTS tcr_read ON public.task_completion_reports;
CREATE POLICY tcr_read ON public.task_completion_reports
    FOR SELECT USING (
        public.is_own_employee(employee_id)
        OR public.is_admin_or_hr()
        OR public.get_user_role() = 'supervisor'
    );

DROP POLICY IF EXISTS tcr_insert_own ON public.task_completion_reports;
CREATE POLICY tcr_insert_own ON public.task_completion_reports
    FOR INSERT WITH CHECK (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS tcr_manage ON public.task_completion_reports;
CREATE POLICY tcr_manage ON public.task_completion_reports
    FOR ALL USING (public.get_user_role() IN ('admin','hr','supervisor'));

-- Task Comments
DROP POLICY IF EXISTS tc_read ON public.task_comments;
CREATE POLICY tc_read ON public.task_comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tasks t
            JOIN public.task_groups tg ON tg.id = t.group_id
            JOIN public.employees e ON e.profile_id = auth.uid()
            WHERE t.id = task_comments.task_id
            AND e.id = ANY(tg.member_employee_ids)
        )
        OR public.is_admin_or_hr()
    );

DROP POLICY IF EXISTS tc_insert ON public.task_comments;
CREATE POLICY tc_insert ON public.task_comments
    FOR INSERT WITH CHECK (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS tc_manage ON public.task_comments;
CREATE POLICY tc_manage ON public.task_comments
    FOR ALL USING (public.get_user_role() IN ('admin','hr','supervisor'));

-- Announcements: everyone can read, restricted create
DROP POLICY IF EXISTS ann_read ON public.announcements;
CREATE POLICY ann_read ON public.announcements
    FOR SELECT USING (
        status IN ('sent','delivered','read')
        OR public.get_user_role() IN ('admin','hr','supervisor')
    );

DROP POLICY IF EXISTS ann_manage ON public.announcements;
CREATE POLICY ann_manage ON public.announcements
    FOR ALL USING (public.get_user_role() IN ('admin','hr','supervisor'));

-- Text Channels: members only
DROP POLICY IF EXISTS tch_read ON public.text_channels;
CREATE POLICY tch_read ON public.text_channels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
            AND e.id = ANY(text_channels.member_employee_ids)
        )
        OR public.is_admin_or_hr()
    );

DROP POLICY IF EXISTS tch_manage ON public.text_channels;
CREATE POLICY tch_manage ON public.text_channels
    FOR ALL USING (public.get_user_role() IN ('admin','hr','supervisor'));

-- Channel Messages
DROP POLICY IF EXISTS cm_read ON public.channel_messages;
CREATE POLICY cm_read ON public.channel_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.text_channels tc
            JOIN public.employees e ON e.profile_id = auth.uid()
            WHERE tc.id = channel_messages.channel_id
            AND e.id = ANY(tc.member_employee_ids)
        )
        OR public.is_admin_or_hr()
    );

DROP POLICY IF EXISTS cm_insert ON public.channel_messages;
CREATE POLICY cm_insert ON public.channel_messages
    FOR INSERT WITH CHECK (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS cm_manage ON public.channel_messages;
CREATE POLICY cm_manage ON public.channel_messages
    FOR ALL USING (public.is_admin_or_hr());

-- ════════════════════════════════════════════════════════════
-- AUDIT & NOTIFICATIONS (009)
-- ════════════════════════════════════════════════════════════

-- Audit: only admin/auditor can read, insert via service role
DROP POLICY IF EXISTS audit_read ON public.audit_logs;
CREATE POLICY audit_read ON public.audit_logs
    FOR SELECT USING (public.get_user_role() IN ('admin','auditor'));

DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert ON public.audit_logs
    FOR INSERT WITH CHECK (public.get_user_role() IN ('admin','hr','auditor'));

-- Notification Logs
DROP POLICY IF EXISTS nl_read_own ON public.notification_logs;
CREATE POLICY nl_read_own ON public.notification_logs
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS nl_read_admin ON public.notification_logs;
CREATE POLICY nl_read_admin ON public.notification_logs
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS nl_insert ON public.notification_logs;
CREATE POLICY nl_insert ON public.notification_logs
    FOR INSERT WITH CHECK (public.is_own_employee(employee_id) OR public.is_admin_or_hr());

-- Notification Rules: admin only
DROP POLICY IF EXISTS nr_read ON public.notification_rules;
CREATE POLICY nr_read ON public.notification_rules
    FOR SELECT USING (public.get_user_role() IN ('admin','hr'));

DROP POLICY IF EXISTS nr_manage ON public.notification_rules;
CREATE POLICY nr_manage ON public.notification_rules
    FOR ALL USING (public.get_user_role() = 'admin');

-- ════════════════════════════════════════════════════════════
-- PROJECTS / TIMESHEETS / SETTINGS (010)
-- ════════════════════════════════════════════════════════════

-- Projects
DROP POLICY IF EXISTS proj_read ON public.projects;
CREATE POLICY proj_read ON public.projects
    FOR SELECT USING (true);

DROP POLICY IF EXISTS proj_manage ON public.projects;
CREATE POLICY proj_manage ON public.projects
    FOR ALL USING (public.get_user_role() IN ('admin','hr','supervisor'));

-- Attendance Rule Sets
DROP POLICY IF EXISTS ars_read ON public.attendance_rule_sets;
CREATE POLICY ars_read ON public.attendance_rule_sets
    FOR SELECT USING (true);

DROP POLICY IF EXISTS ars_manage ON public.attendance_rule_sets;
CREATE POLICY ars_manage ON public.attendance_rule_sets
    FOR ALL USING (public.is_admin_or_hr());

-- Timesheets
DROP POLICY IF EXISTS ts_read_own ON public.timesheets;
CREATE POLICY ts_read_own ON public.timesheets
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS ts_read_admin ON public.timesheets;
CREATE POLICY ts_read_admin ON public.timesheets
    FOR SELECT USING (public.get_user_role() IN ('admin','hr','payroll_admin','supervisor','auditor'));

DROP POLICY IF EXISTS ts_manage ON public.timesheets;
CREATE POLICY ts_manage ON public.timesheets
    FOR ALL USING (public.get_user_role() IN ('admin','hr','payroll_admin'));

-- Calendar Events
DROP POLICY IF EXISTS ce_read ON public.calendar_events;
CREATE POLICY ce_read ON public.calendar_events
    FOR SELECT USING (true);

DROP POLICY IF EXISTS ce_manage ON public.calendar_events;
CREATE POLICY ce_manage ON public.calendar_events
    FOR ALL USING (public.is_admin_or_hr());

-- Kiosk Devices
DROP POLICY IF EXISTS kd_read ON public.kiosk_devices;
CREATE POLICY kd_read ON public.kiosk_devices
    FOR SELECT USING (true);

DROP POLICY IF EXISTS kd_manage ON public.kiosk_devices;
CREATE POLICY kd_manage ON public.kiosk_devices
    FOR ALL USING (public.is_admin_or_hr());

-- QR Tokens
DROP POLICY IF EXISTS qr_read ON public.qr_tokens;
CREATE POLICY qr_read ON public.qr_tokens
    FOR SELECT USING (true);

DROP POLICY IF EXISTS qr_manage ON public.qr_tokens;
CREATE POLICY qr_manage ON public.qr_tokens
    FOR ALL USING (public.is_admin_or_hr());

-- Location Config
DROP POLICY IF EXISTS lc_read ON public.location_config;
CREATE POLICY lc_read ON public.location_config
    FOR SELECT USING (true);

DROP POLICY IF EXISTS lc_manage ON public.location_config;
CREATE POLICY lc_manage ON public.location_config
    FOR ALL USING (public.get_user_role() = 'admin');

-- Location Pings
DROP POLICY IF EXISTS lp_read_own ON public.location_pings;
CREATE POLICY lp_read_own ON public.location_pings
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS lp_read_admin ON public.location_pings;
CREATE POLICY lp_read_admin ON public.location_pings
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS lp_insert ON public.location_pings;
CREATE POLICY lp_insert ON public.location_pings
    FOR INSERT WITH CHECK (public.is_own_employee(employee_id));

-- Site Survey Photos
DROP POLICY IF EXISTS ssp_read_own ON public.site_survey_photos;
CREATE POLICY ssp_read_own ON public.site_survey_photos
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS ssp_read_admin ON public.site_survey_photos;
CREATE POLICY ssp_read_admin ON public.site_survey_photos
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS ssp_insert ON public.site_survey_photos;
CREATE POLICY ssp_insert ON public.site_survey_photos
    FOR INSERT WITH CHECK (public.is_own_employee(employee_id));

-- Break Records
DROP POLICY IF EXISTS br_read_own ON public.break_records;
CREATE POLICY br_read_own ON public.break_records
    FOR SELECT USING (public.is_own_employee(employee_id));

DROP POLICY IF EXISTS br_read_admin ON public.break_records;
CREATE POLICY br_read_admin ON public.break_records
    FOR SELECT USING (public.is_admin_or_hr());

DROP POLICY IF EXISTS br_manage ON public.break_records;
CREATE POLICY br_manage ON public.break_records
    FOR ALL USING (public.is_admin_or_hr());

-- Appearance Config
DROP POLICY IF EXISTS ac_read ON public.appearance_config;
CREATE POLICY ac_read ON public.appearance_config
    FOR SELECT USING (true);

DROP POLICY IF EXISTS ac_manage ON public.appearance_config;
CREATE POLICY ac_manage ON public.appearance_config
    FOR ALL USING (public.get_user_role() = 'admin');

-- Gov Table Versions
DROP POLICY IF EXISTS gtv_read ON public.gov_table_versions;
CREATE POLICY gtv_read ON public.gov_table_versions
    FOR SELECT USING (public.get_user_role() IN ('admin','finance','payroll_admin','auditor'));

DROP POLICY IF EXISTS gtv_manage ON public.gov_table_versions;
CREATE POLICY gtv_manage ON public.gov_table_versions
    FOR ALL USING (public.get_user_role() IN ('admin','finance','payroll_admin'));

-- Dashboard Layouts
DROP POLICY IF EXISTS dl_read ON public.dashboard_layouts;
CREATE POLICY dl_read ON public.dashboard_layouts
    FOR SELECT USING (true);

DROP POLICY IF EXISTS dl_manage ON public.dashboard_layouts;
CREATE POLICY dl_manage ON public.dashboard_layouts
    FOR ALL USING (public.get_user_role() = 'admin');

-- Custom Pages
DROP POLICY IF EXISTS cp_read ON public.custom_pages;
CREATE POLICY cp_read ON public.custom_pages
    FOR SELECT USING (true);

DROP POLICY IF EXISTS cp_manage ON public.custom_pages;
CREATE POLICY cp_manage ON public.custom_pages
    FOR ALL USING (public.get_user_role() = 'admin');
