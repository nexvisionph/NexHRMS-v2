-- ============================================================
-- 013: Seed data (default config rows)
-- ============================================================

-- Default appearance
INSERT INTO public.appearance_config (id, company_name, sidebar_color, primary_color)
VALUES ('default', 'NexHRMS', '#1e293b', '#3b82f6')
ON CONFLICT (id) DO NOTHING;

-- Default location config
INSERT INTO public.location_config (id, enabled, ping_interval_minutes, require_location, warn_employee_out_of_fence, alert_admin_out_of_fence, alert_admin_location_disabled, track_during_breaks, retain_days, require_selfie, selfie_max_age, show_reverse_geocode, selfie_compression_quality, lunch_duration, lunch_geofence_required, lunch_overtime_threshold, alert_admin_on_geofence_violation, allowed_breaks_per_day, break_grace_period)
VALUES ('default', true, 5, true, true, true, true, false, 90, false, 120, true, 0.7, 60, false, 0, true, 2, 5)
ON CONFLICT (id) DO NOTHING;

-- Default pay schedule config
INSERT INTO public.pay_schedule_config (id, default_frequency, semi_monthly_first_cutoff, semi_monthly_first_pay_day, semi_monthly_second_pay_day, monthly_pay_day, weekly_pay_day, deduct_gov_from)
VALUES ('default', 'semi_monthly', 15, 20, 5, 30, 5, 'second')
ON CONFLICT (id) DO NOTHING;

-- Government table version snapshots (table_name CHECK: sss|philhealth|pagibig|tax)
INSERT INTO public.gov_table_versions (id, table_name, version, effective_date, snapshot_json)
VALUES
  ('sss-2025',        'sss',        '2025', '2025-01-01', '{"note":"Philippine SSS 2025 contribution schedule – update as needed"}'),
  ('philhealth-2025', 'philhealth', '2025', '2025-01-01', '{"note":"PhilHealth 2025 premium rate – update as needed"}'),
  ('pagibig-2025',    'pagibig',    '2025', '2025-01-01', '{"note":"Pag-IBIG 2025 contribution schedule – update as needed"}'),
  ('tax-2025',        'tax',        '2025', '2025-01-01', '{"note":"BIR 2025 withholding tax table – update as needed"}')
ON CONFLICT (id) DO NOTHING;

-- Default roles (permissions is text[], slug must be unique)
INSERT INTO public.roles_custom (id, name, slug, color, icon, is_system, permissions)
VALUES
  ('role-admin',      'Admin',                 'admin',      '#ef4444', 'Shield',      true, '{}'),
  ('role-hr',         'HR Manager',            'hr',         '#8b5cf6', 'Users',       true, '{}'),
  ('role-finance',    'Finance / Payroll Admin','finance',    '#f59e0b', 'DollarSign',  true, '{}'),
  ('role-supervisor', 'Supervisor',            'supervisor', '#10b981', 'UserCheck',   true, '{}'),
  ('role-employee',   'Employee',              'employee',   '#6366f1', 'User',        true, '{}')
ON CONFLICT (id) DO NOTHING;

-- Default shift template (break_duration, grace_period, work_days array)
INSERT INTO public.shift_templates (id, name, start_time, end_time, break_duration, grace_period, work_days)
VALUES ('shift-default', 'Regular (8AM-5PM)', '08:00', '17:00', 60, 15, '{1,2,3,4,5}')
ON CONFLICT (id) DO NOTHING;

-- Default payroll signature config (mode + single signatory)
INSERT INTO public.payroll_signature_config (id, mode, signatory_name, signatory_title)
VALUES ('default', 'auto', '', 'HR Manager')
ON CONFLICT (id) DO NOTHING;

-- Default deduction global defaults (one row per deduction type)
INSERT INTO public.deduction_global_defaults (id, deduction_type, enabled, mode)
VALUES
  ('DGD-sss',        'sss',        true, 'auto'),
  ('DGD-philhealth', 'philhealth', true, 'auto'),
  ('DGD-pagibig',    'pagibig',    true, 'auto'),
  ('DGD-bir',        'bir',        true, 'auto')
ON CONFLICT (id) DO NOTHING;
