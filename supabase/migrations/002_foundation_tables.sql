-- ============================================================
-- 002: Independent foundation tables (no FK deps on other app tables)
-- ============================================================

-- Shift templates
CREATE TABLE public.shift_templates (
  id text NOT NULL,
  name text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  grace_period integer NOT NULL DEFAULT 10,
  break_duration integer NOT NULL DEFAULT 60,
  work_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_templates_pkey PRIMARY KEY (id)
);

-- Projects
CREATE TABLE public.projects (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  location_lat double precision,
  location_lng double precision,
  location_radius double precision,
  assigned_employee_ids text[] NOT NULL DEFAULT '{}',
  status text DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active','completed','on_hold'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  verification_method text DEFAULT 'face_or_qr'
    CHECK (verification_method = ANY (ARRAY['face_only','qr_only','face_or_qr','manual_only'])),
  require_geofence boolean DEFAULT true,
  geofence_radius_meters integer DEFAULT 100,
  location_address text,
  CONSTRAINT projects_pkey PRIMARY KEY (id)
);

-- Roles (custom)
CREATE TABLE public.roles_custom (
  id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1',
  icon text NOT NULL DEFAULT 'Shield',
  is_system boolean NOT NULL DEFAULT false,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_custom_pkey PRIMARY KEY (id)
);

-- Holidays
CREATE TABLE public.holidays (
  id text NOT NULL,
  name text NOT NULL,
  date date NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['regular','special_non_working','special_working'])),
  multiplier numeric NOT NULL DEFAULT 1.0,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT holidays_pkey PRIMARY KEY (id)
);

-- Calendar events
CREATE TABLE public.calendar_events (
  id text NOT NULL,
  title text NOT NULL,
  time text NOT NULL,
  date date NOT NULL,
  type text,
  CONSTRAINT calendar_events_pkey PRIMARY KEY (id)
);

-- Attendance rule sets
CREATE TABLE public.attendance_rule_sets (
  id text NOT NULL,
  name text NOT NULL,
  standard_hours_per_day numeric NOT NULL DEFAULT 8,
  grace_minutes integer NOT NULL DEFAULT 15,
  rounding_policy text NOT NULL DEFAULT 'none'
    CHECK (rounding_policy = ANY (ARRAY['none','nearest_15','nearest_30'])),
  overtime_requires_approval boolean NOT NULL DEFAULT true,
  night_diff_start text,
  night_diff_end text,
  holiday_multiplier numeric NOT NULL DEFAULT 1.0,
  CONSTRAINT attendance_rule_sets_pkey PRIMARY KEY (id)
);

-- Gov table versions (for SSS/PhilHealth/PagIBIG/BIR snapshots)
CREATE TABLE public.gov_table_versions (
  id text NOT NULL,
  table_name text NOT NULL
    CHECK (table_name = ANY (ARRAY['sss','philhealth','pagibig','tax'])),
  version text NOT NULL,
  effective_date date NOT NULL,
  snapshot_json text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gov_table_versions_pkey PRIMARY KEY (id)
);

-- Appearance config
CREATE TABLE public.appearance_config (
  id text NOT NULL DEFAULT 'default',
  company_name text NOT NULL DEFAULT 'NexHRMS',
  company_logo text,
  sidebar_color text DEFAULT '#1e293b',
  primary_color text DEFAULT '#3b82f6',
  login_heading text,
  login_sub_heading text,
  login_background text,
  login_logo text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appearance_config_pkey PRIMARY KEY (id)
);

-- Location config
CREATE TABLE public.location_config (
  id text NOT NULL DEFAULT 'default',
  enabled boolean NOT NULL DEFAULT true,
  ping_interval_minutes integer NOT NULL DEFAULT 5,
  require_location boolean NOT NULL DEFAULT true,
  warn_employee_out_of_fence boolean NOT NULL DEFAULT true,
  alert_admin_out_of_fence boolean NOT NULL DEFAULT true,
  alert_admin_location_disabled boolean NOT NULL DEFAULT true,
  track_during_breaks boolean NOT NULL DEFAULT false,
  retain_days integer NOT NULL DEFAULT 90,
  require_selfie boolean NOT NULL DEFAULT false,
  selfie_required_projects text[] DEFAULT '{}',
  selfie_max_age integer NOT NULL DEFAULT 120,
  show_reverse_geocode boolean NOT NULL DEFAULT true,
  selfie_compression_quality numeric NOT NULL DEFAULT 0.7,
  lunch_duration integer NOT NULL DEFAULT 60,
  lunch_geofence_required boolean NOT NULL DEFAULT false,
  lunch_overtime_threshold integer NOT NULL DEFAULT 0,
  alert_admin_on_geofence_violation boolean NOT NULL DEFAULT true,
  allowed_breaks_per_day integer NOT NULL DEFAULT 2,
  break_grace_period integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT location_config_pkey PRIMARY KEY (id)
);

-- Pay schedule config
CREATE TABLE public.pay_schedule_config (
  id text NOT NULL DEFAULT 'default',
  default_frequency text NOT NULL DEFAULT 'semi_monthly'
    CHECK (default_frequency = ANY (ARRAY['monthly','semi_monthly','bi_weekly','weekly'])),
  semi_monthly_first_cutoff integer NOT NULL DEFAULT 15,
  semi_monthly_first_pay_day integer NOT NULL DEFAULT 20,
  semi_monthly_second_pay_day integer NOT NULL DEFAULT 5,
  monthly_pay_day integer NOT NULL DEFAULT 30,
  bi_weekly_start_date date,
  weekly_pay_day integer NOT NULL DEFAULT 5,
  deduct_gov_from text NOT NULL DEFAULT 'second'
    CHECK (deduct_gov_from = ANY (ARRAY['first','second','both'])),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pay_schedule_config_pkey PRIMARY KEY (id)
);

-- Payroll signature config
CREATE TABLE public.payroll_signature_config (
  id text NOT NULL DEFAULT 'default',
  mode text NOT NULL DEFAULT 'auto'
    CHECK (mode = ANY (ARRAY['auto','manual'])),
  signatory_name text NOT NULL DEFAULT '',
  signatory_title text NOT NULL DEFAULT '',
  signature_data_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_signature_config_pkey PRIMARY KEY (id)
);

-- Deduction global defaults
CREATE TABLE public.deduction_global_defaults (
  id text NOT NULL DEFAULT ('DGD-' || gen_random_uuid()::text),
  deduction_type text NOT NULL UNIQUE
    CHECK (deduction_type = ANY (ARRAY['sss','philhealth','pagibig','bir'])),
  enabled boolean NOT NULL DEFAULT true,
  mode text NOT NULL DEFAULT 'auto'
    CHECK (mode = ANY (ARRAY['auto','exempt','percentage','fixed'])),
  percentage numeric CHECK (percentage >= 0 AND percentage <= 100),
  fixed_amount numeric CHECK (fixed_amount >= 0),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT deduction_global_defaults_pkey PRIMARY KEY (id)
);

-- Deduction templates
CREATE TABLE public.deduction_templates (
  id text NOT NULL DEFAULT ('DT-' || gen_random_uuid()::text),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'deduction'
    CHECK (type = ANY (ARRAY['deduction','allowance'])),
  calculation_mode text NOT NULL DEFAULT 'fixed'
    CHECK (calculation_mode = ANY (ARRAY['fixed','percentage','daily','hourly'])),
  value numeric NOT NULL DEFAULT 0 CHECK (value >= 0),
  conditions jsonb,
  applies_to_all boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deduction_templates_pkey PRIMARY KEY (id)
);

-- Job titles
CREATE TABLE public.job_titles (
  id text NOT NULL,
  name text NOT NULL UNIQUE,
  description text,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  is_lead boolean NOT NULL DEFAULT false,
  color text NOT NULL DEFAULT '#6366f1',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_titles_pkey PRIMARY KEY (id)
);

-- Departments
CREATE TABLE public.departments (
  id text NOT NULL,
  name text NOT NULL UNIQUE,
  description text,
  head_id text,
  color text NOT NULL DEFAULT '#6366f1',
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);

-- Notification rules
CREATE TABLE public.notification_rules (
  id text NOT NULL,
  trigger text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  channel text NOT NULL DEFAULT 'in_app'
    CHECK (channel = ANY (ARRAY['email','sms','both','in_app'])),
  recipient_roles text[] NOT NULL DEFAULT '{}',
  timing text NOT NULL DEFAULT 'immediate'
    CHECK (timing = ANY (ARRAY['immediate','scheduled'])),
  schedule_time text,
  reminder_days integer[],
  subject_template text NOT NULL,
  body_template text NOT NULL,
  sms_template text,
  CONSTRAINT notification_rules_pkey PRIMARY KEY (id)
);

-- Leave policies
CREATE TABLE public.leave_policies (
  id text NOT NULL,
  leave_type text NOT NULL
    CHECK (leave_type = ANY (ARRAY['SL','VL','EL','OTHER','ML','PL','SPL'])),
  name text NOT NULL,
  accrual_frequency text NOT NULL DEFAULT 'annual'
    CHECK (accrual_frequency = ANY (ARRAY['monthly','annual'])),
  annual_entitlement integer NOT NULL DEFAULT 0,
  carry_forward_allowed boolean NOT NULL DEFAULT false,
  max_carry_forward integer NOT NULL DEFAULT 0,
  max_balance integer NOT NULL DEFAULT 0,
  expiry_months integer NOT NULL DEFAULT 0,
  negative_leave_allowed boolean NOT NULL DEFAULT false,
  attachment_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_policies_pkey PRIMARY KEY (id)
);

-- Manual checkin reasons
CREATE TABLE public.manual_checkin_reasons (
  id text NOT NULL DEFAULT ('MCR-' || gen_random_uuid()::text),
  reason text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT manual_checkin_reasons_pkey PRIMARY KEY (id)
);

-- Task tags
CREATE TABLE public.task_tags (
  id text NOT NULL,
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_tags_pkey PRIMARY KEY (id)
);
