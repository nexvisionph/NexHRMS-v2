-- ============================================================
-- 012_seed_data.sql
-- Seed default data: admin user, defaults, PH holidays, etc.
-- ============================================================

-- ─── Default Pay Schedule ─────────────────────────────────
INSERT INTO public.pay_schedule_config (id, default_frequency, semi_monthly_first_cutoff, semi_monthly_first_pay_day, semi_monthly_second_pay_day, monthly_pay_day, bi_weekly_start_date, weekly_pay_day, deduct_gov_from)
VALUES ('default', 'semi_monthly', 15, 20, 5, 30, '2026-01-05', 5, 'second')
ON CONFLICT (id) DO NOTHING;

-- ─── Default Location Config ──────────────────────────────
INSERT INTO public.location_config (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ─── Default Appearance Config ────────────────────────────
INSERT INTO public.appearance_config (id, company_name) VALUES ('default', 'NexHRMS')
ON CONFLICT (id) DO NOTHING;

-- ─── Default Shift Template ──────────────────────────────
INSERT INTO public.shift_templates (id, name, start_time, end_time, grace_period, break_duration, work_days)
VALUES ('shift-default', 'Default (9-6)', '09:00', '18:00', 15, 60, ARRAY[1,2,3,4,5])
ON CONFLICT (id) DO NOTHING;

-- ─── Default Attendance Rule Set ──────────────────────────
INSERT INTO public.attendance_rule_sets (id, name, standard_hours_per_day, grace_minutes, rounding_policy, overtime_requires_approval, holiday_multiplier)
VALUES ('rules-default', 'Standard', 8, 15, 'none', true, 1.0)
ON CONFLICT (id) DO NOTHING;

-- ─── Default Leave Policies (PH standard) ─────────────────
INSERT INTO public.leave_policies (id, leave_type, name, accrual_frequency, annual_entitlement, carry_forward_allowed, max_carry_forward, max_balance, expiry_months, negative_leave_allowed, attachment_required) VALUES
    ('LP-SL', 'SL', 'Sick Leave', 'annual', 15, true, 5, 20, 12, false, true),
    ('LP-VL', 'VL', 'Vacation Leave', 'annual', 15, true, 5, 20, 12, false, false),
    ('LP-EL', 'EL', 'Emergency Leave', 'annual', 5, false, 0, 5, 0, false, false),
    ('LP-ML', 'ML', 'Maternity Leave', 'annual', 105, false, 0, 105, 0, false, true),
    ('LP-PL', 'PL', 'Paternity Leave', 'annual', 7, false, 0, 7, 0, false, true),
    ('LP-SPL', 'SPL', 'Solo Parent Leave', 'annual', 7, false, 0, 7, 0, false, true)
ON CONFLICT (id) DO NOTHING;

-- ─── 2026 PH Holidays ────────────────────────────────────
INSERT INTO public.holidays (id, name, date, type, multiplier) VALUES
    ('HOL-2026-01', 'New Year''s Day',            '2026-01-01', 'regular', 2.0),
    ('HOL-2026-02', 'Araw ng Kagitingan',         '2026-04-09', 'regular', 2.0),
    ('HOL-2026-03', 'Maundy Thursday',            '2026-04-02', 'regular', 2.0),
    ('HOL-2026-04', 'Good Friday',                '2026-04-03', 'regular', 2.0),
    ('HOL-2026-05', 'Black Saturday',             '2026-04-04', 'special', 1.3),
    ('HOL-2026-06', 'Labor Day',                  '2026-05-01', 'regular', 2.0),
    ('HOL-2026-07', 'Independence Day',           '2026-06-12', 'regular', 2.0),
    ('HOL-2026-08', 'Ninoy Aquino Day',           '2026-08-21', 'special', 1.3),
    ('HOL-2026-09', 'National Heroes Day',        '2026-08-31', 'regular', 2.0),
    ('HOL-2026-10', 'Bonifacio Day',              '2026-11-30', 'regular', 2.0),
    ('HOL-2026-11', 'Christmas Day',              '2026-12-25', 'regular', 2.0),
    ('HOL-2026-12', 'Rizal Day',                  '2026-12-30', 'regular', 2.0),
    ('HOL-2026-13', 'Last Day of the Year',       '2026-12-31', 'special', 1.3),
    ('HOL-2026-14', 'Chinese New Year',           '2026-02-17', 'special', 1.3),
    ('HOL-2026-15', 'EDSA Anniversary',           '2026-02-25', 'special', 1.3),
    ('HOL-2026-16', 'All Saints'' Day',           '2026-11-01', 'special', 1.3),
    ('HOL-2026-17', 'Immaculate Conception',      '2026-12-08', 'special', 1.3)
ON CONFLICT (id) DO NOTHING;

-- ─── NOTE: Admin user must be created via Supabase Auth ──
-- After running this migration:
--   1. Use Supabase Dashboard -> Authentication -> Users -> "Add user"
--      OR use the admin API with service_role key:
--
--        const { data, error } = await supabase.auth.admin.createUser({
--          email: 'admin@nexhrms.com',
--          password: '<secure-password>',
--          email_confirm: true,
--          user_metadata: { name: 'System Admin', role: 'admin' }
--        });
--
--   2. The handle_new_user trigger will auto-create a profile row.
--   3. Then create the employee record linked to that profile:
--
--        INSERT INTO employees (id, profile_id, name, email, role, department, status, work_type, salary, join_date, productivity, location)
--        VALUES ('EMP001', '<auth-user-uuid>', 'System Admin', 'admin@nexhrms.com', 'admin', 'Management', 'active', 'WFO', 0, CURRENT_DATE, 100, 'Head Office');
