-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.announcements (
  id text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app'::text CHECK (channel = ANY (ARRAY['email'::text, 'whatsapp'::text, 'sms'::text, 'in_app'::text])),
  scope text NOT NULL DEFAULT 'all_employees'::text CHECK (scope = ANY (ARRAY['all_employees'::text, 'selected_employees'::text, 'task_group'::text, 'task_assignees'::text])),
  target_employee_ids ARRAY,
  target_group_id text,
  target_task_id text,
  sent_by text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent'::text CHECK (status = ANY (ARRAY['sent'::text, 'delivered'::text, 'read'::text, 'failed'::text, 'simulated'::text])),
  read_by ARRAY NOT NULL DEFAULT '{}'::text[],
  attachment_url text,
  CONSTRAINT announcements_pkey PRIMARY KEY (id)
);
CREATE TABLE public.appearance_config (
  id text NOT NULL DEFAULT 'default'::text,
  company_name text NOT NULL DEFAULT 'NexHRMS'::text,
  company_logo text,
  sidebar_color text DEFAULT '#1e293b'::text,
  primary_color text DEFAULT '#3b82f6'::text,
  login_heading text,
  login_sub_heading text,
  login_background text,
  login_logo text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT appearance_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.attendance_events (
  id text NOT NULL,
  employee_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['IN'::text, 'OUT'::text, 'BREAK_START'::text, 'BREAK_END'::text])),
  timestamp_utc timestamp with time zone NOT NULL,
  project_id text,
  device_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_events_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_ae_project FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.attendance_evidence (
  id text NOT NULL,
  event_id text NOT NULL,
  gps_lat double precision,
  gps_lng double precision,
  gps_accuracy_meters double precision,
  geofence_pass boolean,
  qr_token_id text,
  device_integrity_result text CHECK ((device_integrity_result = ANY (ARRAY['pass'::text, 'fail'::text, 'mock'::text])) OR device_integrity_result IS NULL),
  face_verified boolean,
  mock_location_detected boolean,
  CONSTRAINT attendance_evidence_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_evidence_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.attendance_events(id)
);
CREATE TABLE public.attendance_exceptions (
  id text NOT NULL,
  event_id text,
  employee_id text NOT NULL,
  date date NOT NULL,
  flag text NOT NULL CHECK (flag = ANY (ARRAY['missing_in'::text, 'missing_out'::text, 'out_of_geofence'::text, 'duplicate_scan'::text, 'device_mismatch'::text, 'overtime_without_approval'::text])),
  auto_generated boolean NOT NULL DEFAULT true,
  resolved_at timestamp with time zone,
  resolved_by text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_exceptions_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_exceptions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.attendance_events(id),
  CONSTRAINT attendance_exceptions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.attendance_logs (
  id text NOT NULL,
  employee_id text NOT NULL,
  date date NOT NULL,
  check_in text,
  check_out text,
  hours numeric,
  status text NOT NULL DEFAULT 'absent'::text CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'on_leave'::text])),
  project_id text,
  location_lat double precision,
  location_lng double precision,
  face_verified boolean,
  late_minutes integer,
  shift_id text,
  flags ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT attendance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_al_project FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT fk_al_shift FOREIGN KEY (shift_id) REFERENCES public.shift_templates(id)
);
CREATE TABLE public.attendance_rule_sets (
  id text NOT NULL,
  name text NOT NULL,
  standard_hours_per_day numeric NOT NULL DEFAULT 8,
  grace_minutes integer NOT NULL DEFAULT 15,
  rounding_policy text NOT NULL DEFAULT 'none'::text CHECK (rounding_policy = ANY (ARRAY['none'::text, 'nearest_15'::text, 'nearest_30'::text])),
  overtime_requires_approval boolean NOT NULL DEFAULT true,
  night_diff_start text,
  night_diff_end text,
  holiday_multiplier numeric NOT NULL DEFAULT 1.0,
  CONSTRAINT attendance_rule_sets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.audit_logs (
  id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  performed_by text NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.break_records (
  id text NOT NULL,
  employee_id text NOT NULL,
  date date NOT NULL,
  break_type text NOT NULL DEFAULT 'lunch'::text CHECK (break_type = ANY (ARRAY['lunch'::text, 'other'::text])),
  start_time text NOT NULL,
  end_time text,
  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  end_geofence_pass boolean,
  distance_from_site double precision,
  duration integer,
  overtime boolean DEFAULT false,
  CONSTRAINT break_records_pkey PRIMARY KEY (id),
  CONSTRAINT fk_breaks_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.calendar_events (
  id text NOT NULL,
  title text NOT NULL,
  time text NOT NULL,
  date date NOT NULL,
  type text,
  CONSTRAINT calendar_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.channel_messages (
  id text NOT NULL,
  channel_id text NOT NULL,
  employee_id text NOT NULL,
  message text NOT NULL,
  attachment_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  edited_at timestamp with time zone,
  read_by ARRAY NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT channel_messages_pkey PRIMARY KEY (id),
  CONSTRAINT channel_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.text_channels(id),
  CONSTRAINT fk_cm_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.custom_pages (
  id text NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'file'::text,
  description text,
  allowed_roles ARRAY NOT NULL DEFAULT '{}'::text[],
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  show_in_sidebar boolean NOT NULL DEFAULT true,
  order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT custom_pages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.dashboard_layouts (
  role_id text NOT NULL,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_layouts_pkey PRIMARY KEY (role_id),
  CONSTRAINT dashboard_layouts_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles_custom(id)
);
CREATE TABLE public.deduction_global_defaults (
  id text NOT NULL DEFAULT ('DGD-'::text || (gen_random_uuid())::text),
  deduction_type text NOT NULL UNIQUE CHECK (deduction_type = ANY (ARRAY['sss'::text, 'philhealth'::text, 'pagibig'::text, 'bir'::text])),
  enabled boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'auto'::text CHECK (mode = ANY (ARRAY['auto'::text, 'exempt'::text, 'percentage'::text, 'fixed'::text])),
  percentage numeric CHECK (percentage >= 0::numeric AND percentage <= 100::numeric),
  fixed_amount numeric CHECK (fixed_amount >= 0::numeric),
  notes text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT deduction_global_defaults_pkey PRIMARY KEY (id)
);
CREATE TABLE public.deduction_overrides (
  id text NOT NULL DEFAULT ('DO-'::text || (gen_random_uuid())::text),
  employee_id text NOT NULL,
  deduction_type text NOT NULL CHECK (deduction_type = ANY (ARRAY['sss'::text, 'philhealth'::text, 'pagibig'::text, 'bir'::text])),
  mode text NOT NULL DEFAULT 'auto'::text CHECK (mode = ANY (ARRAY['auto'::text, 'exempt'::text, 'percentage'::text, 'fixed'::text])),
  percentage numeric CHECK (percentage >= 0::numeric AND percentage <= 100::numeric),
  fixed_amount numeric CHECK (fixed_amount >= 0::numeric),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT deduction_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT deduction_overrides_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.departments (
  id text NOT NULL,
  name text NOT NULL UNIQUE,
  description text,
  head_id text,
  color text NOT NULL DEFAULT '#6366f1'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.employee_documents (
  id text NOT NULL,
  employee_id text NOT NULL,
  name text NOT NULL,
  file_url text,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT employee_documents_pkey PRIMARY KEY (id),
  CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.employee_shifts (
  employee_id text NOT NULL,
  shift_id text NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT employee_shifts_pkey PRIMARY KEY (employee_id),
  CONSTRAINT employee_shifts_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shift_templates(id),
  CONSTRAINT employee_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.employees (
  id text NOT NULL,
  profile_id uuid UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'Employee'::text CHECK (role = ANY (ARRAY['admin'::text, 'hr'::text, 'finance'::text, 'employee'::text, 'supervisor'::text, 'payroll_admin'::text, 'auditor'::text])),
  department text NOT NULL DEFAULT ''::text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text, 'resigned'::text])),
  work_type text NOT NULL DEFAULT 'WFO'::text CHECK (work_type = ANY (ARRAY['WFH'::text, 'WFO'::text, 'HYBRID'::text, 'ONSITE'::text])),
  salary numeric NOT NULL DEFAULT 0,
  join_date date NOT NULL DEFAULT CURRENT_DATE,
  productivity integer NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT ''::text,
  phone text,
  birthday date,
  team_leader text,
  avatar_url text,
  pin text,
  nfc_id text,
  resigned_at timestamp with time zone,
  shift_id text,
  pay_frequency text CHECK ((pay_frequency = ANY (ARRAY['monthly'::text, 'semi_monthly'::text, 'bi_weekly'::text, 'weekly'::text])) OR pay_frequency IS NULL),
  work_days ARRAY,
  whatsapp_number text,
  preferred_channel text CHECK ((preferred_channel = ANY (ARRAY['email'::text, 'whatsapp'::text, 'sms'::text, 'in_app'::text])) OR preferred_channel IS NULL),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  emergency_contact text,
  address text,
  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT employees_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT fk_emp_shift FOREIGN KEY (shift_id) REFERENCES public.shift_templates(id)
);
CREATE TABLE public.face_enrollments (
  id text NOT NULL DEFAULT ('FE-'::text || (gen_random_uuid())::text),
  employee_id text NOT NULL UNIQUE,
  face_template_hash text NOT NULL,
  enrollment_date timestamp with time zone NOT NULL DEFAULT now(),
  last_verified timestamp with time zone,
  verification_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  enrolled_by text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  embedding jsonb,
  reference_image text,
  CONSTRAINT face_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT face_enrollments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.final_pay_computations (
  id text NOT NULL,
  employee_id text NOT NULL,
  resigned_at date NOT NULL,
  pro_rated_salary numeric NOT NULL DEFAULT 0,
  unpaid_ot numeric NOT NULL DEFAULT 0,
  leave_payout numeric NOT NULL DEFAULT 0,
  remaining_loan_balance numeric NOT NULL DEFAULT 0,
  gross_final_pay numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  net_final_pay numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'validated'::text, 'locked'::text, 'published'::text, 'paid'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  payslip_id text,
  CONSTRAINT final_pay_computations_pkey PRIMARY KEY (id),
  CONSTRAINT final_pay_computations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_fpc_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
);
CREATE TABLE public.gov_table_versions (
  id text NOT NULL,
  table_name text NOT NULL CHECK (table_name = ANY (ARRAY['sss'::text, 'philhealth'::text, 'pagibig'::text, 'tax'::text])),
  version text NOT NULL,
  effective_date date NOT NULL,
  snapshot_json text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gov_table_versions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.holidays (
  id text NOT NULL,
  name text NOT NULL,
  date date NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['regular'::text, 'special_non_working'::text, 'special_working'::text])),
  multiplier numeric NOT NULL DEFAULT 1.0,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT holidays_pkey PRIMARY KEY (id)
);
CREATE TABLE public.job_titles (
  id text NOT NULL,
  name text NOT NULL UNIQUE,
  description text,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  is_lead boolean NOT NULL DEFAULT false,
  color text NOT NULL DEFAULT '#6366f1'::text,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT job_titles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.kiosk_devices (
  id text NOT NULL,
  name text NOT NULL,
  registered_at timestamp with time zone NOT NULL DEFAULT now(),
  project_id text,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT kiosk_devices_pkey PRIMARY KEY (id),
  CONSTRAINT fk_kd_project FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.kiosk_pins (
  id text NOT NULL DEFAULT ('KP-'::text || (gen_random_uuid())::text),
  kiosk_device_id text UNIQUE,
  pin_hash text NOT NULL,
  created_by text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone,
  is_active boolean DEFAULT true,
  CONSTRAINT kiosk_pins_pkey PRIMARY KEY (id),
  CONSTRAINT kiosk_pins_kiosk_device_id_fkey FOREIGN KEY (kiosk_device_id) REFERENCES public.kiosk_devices(id)
);
CREATE TABLE public.leave_balances (
  id text NOT NULL,
  employee_id text NOT NULL,
  leave_type text NOT NULL,
  year integer NOT NULL,
  entitled numeric NOT NULL DEFAULT 0,
  used numeric NOT NULL DEFAULT 0,
  carried_forward numeric NOT NULL DEFAULT 0,
  remaining numeric NOT NULL DEFAULT 0,
  last_accrued_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_balances_pkey PRIMARY KEY (id),
  CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.leave_policies (
  id text NOT NULL,
  leave_type text NOT NULL CHECK (leave_type = ANY (ARRAY['SL'::text, 'VL'::text, 'EL'::text, 'OTHER'::text, 'ML'::text, 'PL'::text, 'SPL'::text])),
  name text NOT NULL,
  accrual_frequency text NOT NULL DEFAULT 'annual'::text CHECK (accrual_frequency = ANY (ARRAY['monthly'::text, 'annual'::text])),
  annual_entitlement integer NOT NULL DEFAULT 0,
  carry_forward_allowed boolean NOT NULL DEFAULT false,
  max_carry_forward integer NOT NULL DEFAULT 0,
  max_balance integer NOT NULL DEFAULT 0,
  expiry_months integer NOT NULL DEFAULT 0,
  negative_leave_allowed boolean NOT NULL DEFAULT false,
  attachment_required boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_policies_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leave_requests (
  id text NOT NULL,
  employee_id text NOT NULL,
  type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL DEFAULT ''::text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  reviewed_by text,
  reviewed_at timestamp with time zone,
  attachment_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT leave_requests_pkey PRIMARY KEY (id),
  CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.loan_balance_history (
  id text NOT NULL,
  loan_id text NOT NULL,
  date date NOT NULL,
  previous_balance numeric NOT NULL,
  deduction_amount numeric NOT NULL,
  new_balance numeric NOT NULL,
  payslip_id text,
  notes text,
  CONSTRAINT loan_balance_history_pkey PRIMARY KEY (id),
  CONSTRAINT loan_balance_history_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id),
  CONSTRAINT fk_lbh_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
);
CREATE TABLE public.loan_deductions (
  id text NOT NULL,
  loan_id text NOT NULL,
  payslip_id text NOT NULL,
  amount numeric NOT NULL,
  deducted_at timestamp with time zone NOT NULL DEFAULT now(),
  remaining_after numeric NOT NULL,
  CONSTRAINT loan_deductions_pkey PRIMARY KEY (id),
  CONSTRAINT loan_deductions_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id),
  CONSTRAINT fk_ld_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
);
CREATE TABLE public.loan_repayment_schedule (
  id text NOT NULL,
  loan_id text NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  payslip_id text,
  skipped_reason text,
  CONSTRAINT loan_repayment_schedule_pkey PRIMARY KEY (id),
  CONSTRAINT loan_repayment_schedule_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id),
  CONSTRAINT fk_lrs_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
);
CREATE TABLE public.loans (
  id text NOT NULL,
  employee_id text NOT NULL,
  type text NOT NULL DEFAULT 'cash_advance'::text CHECK (type = ANY (ARRAY['cash_advance'::text, 'salary_loan'::text, 'sss'::text, 'pagibig'::text, 'other'::text])),
  amount numeric NOT NULL,
  remaining_balance numeric NOT NULL,
  monthly_deduction numeric NOT NULL,
  deduction_cap_percent numeric NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'settled'::text, 'frozen'::text, 'cancelled'::text])),
  approved_by text NOT NULL,
  created_at date NOT NULL DEFAULT CURRENT_DATE,
  remarks text,
  last_deducted_at timestamp with time zone,
  CONSTRAINT loans_pkey PRIMARY KEY (id),
  CONSTRAINT loans_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.location_config (
  id text NOT NULL DEFAULT 'default'::text,
  enabled boolean NOT NULL DEFAULT true,
  ping_interval_minutes integer NOT NULL DEFAULT 5,
  require_location boolean NOT NULL DEFAULT true,
  warn_employee_out_of_fence boolean NOT NULL DEFAULT true,
  alert_admin_out_of_fence boolean NOT NULL DEFAULT true,
  alert_admin_location_disabled boolean NOT NULL DEFAULT true,
  track_during_breaks boolean NOT NULL DEFAULT false,
  retain_days integer NOT NULL DEFAULT 90,
  require_selfie boolean NOT NULL DEFAULT false,
  selfie_required_projects ARRAY DEFAULT '{}'::text[],
  selfie_max_age integer NOT NULL DEFAULT 120,
  show_reverse_geocode boolean NOT NULL DEFAULT true,
  selfie_compression_quality numeric NOT NULL DEFAULT 0.7,
  lunch_duration integer NOT NULL DEFAULT 60,
  lunch_geofence_required boolean NOT NULL DEFAULT false,
  lunch_overtime_threshold integer NOT NULL DEFAULT 0,
  alert_admin_on_geofence_violation boolean NOT NULL DEFAULT true,
  allowed_breaks_per_day integer NOT NULL DEFAULT 2,
  break_grace_period integer NOT NULL DEFAULT 5,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT location_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.location_pings (
  id text NOT NULL,
  employee_id text NOT NULL,
  timestamp timestamp with time zone NOT NULL DEFAULT now(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy_meters double precision NOT NULL,
  within_geofence boolean NOT NULL DEFAULT true,
  project_id text,
  distance_from_site double precision,
  source text NOT NULL DEFAULT 'auto'::text CHECK (source = ANY (ARRAY['auto'::text, 'manual'::text, 'break_end'::text])),
  CONSTRAINT location_pings_pkey PRIMARY KEY (id),
  CONSTRAINT fk_pings_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.manual_checkin_reasons (
  id text NOT NULL DEFAULT ('MCR-'::text || (gen_random_uuid())::text),
  reason text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT manual_checkin_reasons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.manual_checkins (
  id text NOT NULL DEFAULT ('MCI-'::text || (gen_random_uuid())::text),
  employee_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['IN'::text, 'OUT'::text])),
  reason_id text,
  custom_reason text,
  performed_by text NOT NULL,
  timestamp_utc timestamp with time zone NOT NULL DEFAULT now(),
  project_id text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT manual_checkins_pkey PRIMARY KEY (id),
  CONSTRAINT manual_checkins_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT manual_checkins_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES public.manual_checkin_reasons(id),
  CONSTRAINT manual_checkins_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.employees(id),
  CONSTRAINT manual_checkins_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.notification_logs (
  id text NOT NULL,
  employee_id text NOT NULL,
  type text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app'::text CHECK (channel = ANY (ARRAY['email'::text, 'sms'::text, 'both'::text, 'in_app'::text])),
  subject text NOT NULL,
  body text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent'::text CHECK (status = ANY (ARRAY['sent'::text, 'failed'::text, 'simulated'::text])),
  recipient_email text,
  recipient_phone text,
  error_message text,
  CONSTRAINT notification_logs_pkey PRIMARY KEY (id),
  CONSTRAINT fk_nl_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.notification_rules (
  id text NOT NULL,
  trigger text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  channel text NOT NULL DEFAULT 'in_app'::text CHECK (channel = ANY (ARRAY['email'::text, 'sms'::text, 'both'::text, 'in_app'::text])),
  recipient_roles ARRAY NOT NULL DEFAULT '{}'::text[],
  timing text NOT NULL DEFAULT 'immediate'::text CHECK (timing = ANY (ARRAY['immediate'::text, 'scheduled'::text])),
  schedule_time text,
  reminder_days ARRAY,
  subject_template text NOT NULL,
  body_template text NOT NULL,
  sms_template text,
  CONSTRAINT notification_rules_pkey PRIMARY KEY (id)
);
CREATE TABLE public.overtime_requests (
  id text NOT NULL,
  employee_id text NOT NULL,
  date date NOT NULL,
  hours_requested numeric NOT NULL,
  reason text NOT NULL,
  project_id text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  CONSTRAINT overtime_requests_pkey PRIMARY KEY (id),
  CONSTRAINT overtime_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_ot_project FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.pay_schedule_config (
  id text NOT NULL DEFAULT 'default'::text,
  default_frequency text NOT NULL DEFAULT 'semi_monthly'::text CHECK (default_frequency = ANY (ARRAY['monthly'::text, 'semi_monthly'::text, 'bi_weekly'::text, 'weekly'::text])),
  semi_monthly_first_cutoff integer NOT NULL DEFAULT 15,
  semi_monthly_first_pay_day integer NOT NULL DEFAULT 20,
  semi_monthly_second_pay_day integer NOT NULL DEFAULT 5,
  monthly_pay_day integer NOT NULL DEFAULT 30,
  bi_weekly_start_date date,
  weekly_pay_day integer NOT NULL DEFAULT 5,
  deduct_gov_from text NOT NULL DEFAULT 'second'::text CHECK (deduct_gov_from = ANY (ARRAY['first'::text, 'second'::text, 'both'::text])),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pay_schedule_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payroll_adjustments (
  id text NOT NULL,
  payroll_run_id text NOT NULL,
  employee_id text NOT NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type = ANY (ARRAY['earnings'::text, 'deduction'::text, 'net_correction'::text, 'statutory_correction'::text])),
  reference_payslip_id text NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamp with time zone,
  applied_run_id text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'applied'::text, 'rejected'::text])),
  CONSTRAINT payroll_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT payroll_adjustments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_pa_run FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id),
  CONSTRAINT fk_pa_payslip FOREIGN KEY (reference_payslip_id) REFERENCES public.payslips(id)
);
CREATE TABLE public.payroll_run_payslips (
  run_id text NOT NULL,
  payslip_id text NOT NULL,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payroll_run_payslips_pkey PRIMARY KEY (run_id, payslip_id),
  CONSTRAINT payroll_run_payslips_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.payroll_runs(id),
  CONSTRAINT payroll_run_payslips_payslip_id_fkey FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
);
CREATE TABLE public.payroll_runs (
  id text NOT NULL,
  period_label text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'validated'::text, 'locked'::text, 'published'::text, 'paid'::text])),
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamp with time zone,
  published_at timestamp with time zone,
  paid_at timestamp with time zone,
  payslip_ids ARRAY NOT NULL DEFAULT '{}'::text[],
  policy_snapshot jsonb,
  run_type text DEFAULT 'regular'::text CHECK (run_type = ANY (ARRAY['regular'::text, 'adjustment'::text, '13th_month'::text, 'final_pay'::text])),
  CONSTRAINT payroll_runs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payroll_signature_config (
  id text NOT NULL DEFAULT 'default'::text,
  mode text NOT NULL DEFAULT 'auto'::text CHECK (mode = ANY (ARRAY['auto'::text, 'manual'::text])),
  signatory_name text NOT NULL DEFAULT ''::text,
  signatory_title text NOT NULL DEFAULT ''::text,
  signature_data_url text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payroll_signature_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.payslips (
  id text NOT NULL,
  employee_id text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  pay_frequency text CHECK (pay_frequency = ANY (ARRAY['monthly'::text, 'semi_monthly'::text, 'bi_weekly'::text, 'weekly'::text])),
  gross_pay numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  sss_deduction numeric NOT NULL DEFAULT 0,
  philhealth_deduction numeric NOT NULL DEFAULT 0,
  pagibig_deduction numeric NOT NULL DEFAULT 0,
  tax_deduction numeric NOT NULL DEFAULT 0,
  other_deductions numeric NOT NULL DEFAULT 0,
  loan_deduction numeric NOT NULL DEFAULT 0,
  holiday_pay numeric DEFAULT 0,
  net_pay numeric NOT NULL DEFAULT 0,
  issued_at date NOT NULL,
  status text NOT NULL DEFAULT 'issued'::text CHECK (status = ANY (ARRAY['issued'::text, 'confirmed'::text, 'published'::text, 'paid'::text, 'acknowledged'::text])),
  confirmed_at timestamp with time zone,
  published_at timestamp with time zone,
  paid_at timestamp with time zone,
  payment_method text,
  bank_reference_id text,
  payroll_batch_id text,
  pdf_hash text,
  notes text,
  signed_at timestamp with time zone,
  signature_data_url text,
  ack_text_version text,
  adjustment_ref text,
  acknowledged_at timestamp with time zone,
  acknowledged_by text,
  paid_confirmed_by text,
  paid_confirmed_at timestamp with time zone,
  CONSTRAINT payslips_pkey PRIMARY KEY (id),
  CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.penalty_records (
  id text NOT NULL,
  employee_id text NOT NULL,
  reason text NOT NULL,
  triggered_at timestamp with time zone NOT NULL DEFAULT now(),
  penalty_until timestamp with time zone NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  CONSTRAINT penalty_records_pkey PRIMARY KEY (id),
  CONSTRAINT penalty_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'employee'::text CHECK (role = ANY (ARRAY['admin'::text, 'hr'::text, 'finance'::text, 'employee'::text, 'supervisor'::text, 'payroll_admin'::text, 'auditor'::text])),
  avatar_url text,
  phone text,
  department text,
  birthday date,
  address text,
  emergency_contact text,
  must_change_password boolean NOT NULL DEFAULT true,
  profile_complete boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE TABLE public.project_assignments (
  project_id text NOT NULL,
  employee_id text NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT project_assignments_pkey PRIMARY KEY (project_id, employee_id),
  CONSTRAINT project_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.project_verification_methods (
  id text NOT NULL DEFAULT ('PVM-'::text || (gen_random_uuid())::text),
  project_id text NOT NULL UNIQUE,
  verification_method text NOT NULL CHECK (verification_method = ANY (ARRAY['face_only'::text, 'qr_only'::text, 'face_or_qr'::text, 'manual_only'::text])),
  require_geofence boolean DEFAULT true,
  geofence_radius_meters integer DEFAULT 100,
  allow_manual_override boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT project_verification_methods_pkey PRIMARY KEY (id),
  CONSTRAINT project_verification_methods_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.projects (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  location_lat double precision,
  location_lng double precision,
  location_radius double precision,
  assigned_employee_ids ARRAY NOT NULL DEFAULT '{}'::text[],
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'on_hold'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  verification_method text DEFAULT 'face_or_qr'::text CHECK (verification_method = ANY (ARRAY['face_only'::text, 'qr_only'::text, 'face_or_qr'::text, 'manual_only'::text])),
  require_geofence boolean DEFAULT true,
  geofence_radius_meters integer DEFAULT 100,
  location_address text,
  CONSTRAINT projects_pkey PRIMARY KEY (id)
);
CREATE TABLE public.qr_tokens (
  id text NOT NULL,
  device_id text NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL,
  used boolean NOT NULL DEFAULT false,
  employee_id text,
  used_at timestamp with time zone,
  used_by_kiosk_id text,
  CONSTRAINT qr_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT qr_tokens_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.kiosk_devices(id),
  CONSTRAINT qr_tokens_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.roles_custom (
  id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1'::text,
  icon text NOT NULL DEFAULT 'Shield'::text,
  is_system boolean NOT NULL DEFAULT false,
  permissions ARRAY NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_custom_pkey PRIMARY KEY (id)
);
CREATE TABLE public.salary_change_requests (
  id text NOT NULL,
  employee_id text NOT NULL,
  old_salary numeric NOT NULL,
  proposed_salary numeric NOT NULL,
  effective_date date NOT NULL,
  reason text NOT NULL,
  proposed_by text NOT NULL,
  proposed_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  reviewed_by text,
  reviewed_at timestamp with time zone,
  CONSTRAINT salary_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT salary_change_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.salary_history (
  id text NOT NULL,
  employee_id text NOT NULL,
  monthly_salary numeric NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  approved_by text NOT NULL,
  reason text NOT NULL,
  CONSTRAINT salary_history_pkey PRIMARY KEY (id),
  CONSTRAINT salary_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.shift_templates (
  id text NOT NULL,
  name text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  grace_period integer NOT NULL DEFAULT 10,
  break_duration integer NOT NULL DEFAULT 60,
  work_days ARRAY NOT NULL DEFAULT '{1,2,3,4,5}'::integer[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT shift_templates_pkey PRIMARY KEY (id)
);
CREATE TABLE public.site_survey_photos (
  id text NOT NULL,
  event_id text NOT NULL,
  employee_id text NOT NULL,
  photo_data_url text NOT NULL,
  gps_lat double precision NOT NULL,
  gps_lng double precision NOT NULL,
  gps_accuracy_meters double precision NOT NULL,
  reverse_geo_address text,
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  geofence_pass boolean,
  project_id text,
  CONSTRAINT site_survey_photos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_ssp_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.task_comments (
  id text NOT NULL,
  task_id text NOT NULL,
  employee_id text NOT NULL,
  message text NOT NULL,
  attachment_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT task_comments_pkey PRIMARY KEY (id),
  CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT fk_tc_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.task_completion_reports (
  id text NOT NULL,
  task_id text NOT NULL,
  employee_id text NOT NULL,
  photo_data_url text,
  gps_lat double precision,
  gps_lng double precision,
  gps_accuracy_meters double precision,
  reverse_geo_address text,
  notes text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  verified_by text,
  verified_at timestamp with time zone,
  rejection_reason text,
  CONSTRAINT task_completion_reports_pkey PRIMARY KEY (id),
  CONSTRAINT task_completion_reports_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT fk_tcr_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.task_groups (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  project_id text,
  created_by text NOT NULL,
  member_employee_ids ARRAY NOT NULL DEFAULT '{}'::text[],
  announcement_permission text NOT NULL DEFAULT 'admin_only'::text CHECK (announcement_permission = ANY (ARRAY['admin_only'::text, 'group_leads'::text, 'all_members'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT task_groups_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tg_project FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.task_tags (
  id text NOT NULL,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1'::text,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT task_tags_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tasks (
  id text NOT NULL,
  group_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  priority text NOT NULL DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'submitted'::text, 'verified'::text, 'rejected'::text, 'cancelled'::text])),
  due_date date,
  assigned_to ARRAY NOT NULL DEFAULT '{}'::text[],
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completion_required boolean NOT NULL DEFAULT false,
  tags ARRAY DEFAULT '{}'::text[],
  project_id text,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.task_groups(id),
  CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.text_channels (
  id text NOT NULL,
  name text NOT NULL,
  group_id text,
  member_employee_ids ARRAY NOT NULL DEFAULT '{}'::text[],
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false,
  CONSTRAINT text_channels_pkey PRIMARY KEY (id)
);
CREATE TABLE public.timesheets (
  id text NOT NULL,
  employee_id text NOT NULL,
  date date NOT NULL,
  rule_set_id text,
  shift_id text,
  regular_hours numeric NOT NULL DEFAULT 0,
  overtime_hours numeric NOT NULL DEFAULT 0,
  night_diff_hours numeric NOT NULL DEFAULT 0,
  total_hours numeric NOT NULL DEFAULT 0,
  late_minutes integer NOT NULL DEFAULT 0,
  undertime_minutes integer NOT NULL DEFAULT 0,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'computed'::text CHECK (status = ANY (ARRAY['computed'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])),
  computed_at timestamp with time zone NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamp with time zone,
  CONSTRAINT timesheets_pkey PRIMARY KEY (id),
  CONSTRAINT timesheets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);