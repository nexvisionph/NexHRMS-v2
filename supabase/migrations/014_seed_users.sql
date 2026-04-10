-- ============================================================
-- 014: Seed demo & test users (auth + profiles + employees)
--
-- Run this in Supabase Dashboard → SQL Editor.
-- Password for ALL accounts: demo1234
--
-- This uses Supabase's internal auth.users table directly so
-- NO service role key is required.
-- ============================================================

-- ─── 1. Create auth.users (idempotent) ─────────────────────────────────────
-- Password hash below is bcrypt of "demo1234" (cost=10)
-- Generated via: https://bcrypt-generator.com  or supabase cli

DO $$
DECLARE
  pwd_hash text := '$2a$10$X1/NoQLGGe8Nvl3nHEKYwuhqVfgcnB.1Vr7KKvbxLJdC8ZzaCLMQm';
  -- ^ bcrypt hash for "demo1234" – matches what Supabase Auth expects

  PROCEDURE upsert_user(
    p_id uuid, p_email text, p_raw_meta jsonb
  ) AS $$
  BEGIN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      aud, role, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new,
      is_super_admin
    ) VALUES (
      p_id,
      '00000000-0000-0000-0000-000000000000',
      p_email,
      pwd_hash,
      now(),
      '{"provider":"email","providers":["email"]}',
      p_raw_meta,
      'authenticated',
      'authenticated',
      now(),
      now(),
      '', '', '',
      false
    )
    ON CONFLICT (id) DO UPDATE
      SET encrypted_password = EXCLUDED.encrypted_password,
          raw_user_meta_data  = EXCLUDED.raw_user_meta_data,
          updated_at          = now();
  END;
  $$;

BEGIN
  -- Core demo accounts
  CALL upsert_user('00000000-0000-0000-0000-000000000001', 'admin@nexhrms.com',
    '{"name":"Alex Rivera","role":"admin"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000002', 'hr@nexhrms.com',
    '{"name":"Jordan Lee","role":"hr"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000003', 'finance@nexhrms.com',
    '{"name":"Morgan Chen","role":"finance"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000004', 'employee@nexhrms.com',
    '{"name":"Sam Torres","role":"employee"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000005', 'supervisor@nexhrms.com',
    '{"name":"Pat Reyes","role":"supervisor"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000006', 'payroll@nexhrms.com',
    '{"name":"Dana Cruz","role":"payroll_admin"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000007', 'auditor@nexhrms.com',
    '{"name":"Rene Santos","role":"auditor"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000008', 'qr@nexhrms.com',
    '{"name":"Jamie Reyes","role":"employee"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000009', 'qr2@nexhrms.com',
    '{"name":"Riley Santos","role":"employee"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000010', 'face@nexhrms.com',
    '{"name":"Alex Reyes","role":"employee"}');

  -- Payroll test accounts
  CALL upsert_user('00000000-0000-0000-0000-000000000011', 'maria.cruz@nexhrms.test',
    '{"name":"Maria Santos Cruz","role":"employee"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000012', 'juan.reyes@nexhrms.test',
    '{"name":"Juan Miguel Reyes","role":"employee"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000013', 'ana.villanueva@nexhrms.test',
    '{"name":"Ana Patricia Villanueva","role":"finance"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000014', 'carlo.gonzales@nexhrms.test',
    '{"name":"Carlo Miguel Gonzales","role":"employee"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000015', 'elena.tan@nexhrms.test',
    '{"name":"Elena Marie Tan","role":"hr"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000016', 'roberto.aquino@nexhrms.test',
    '{"name":"Roberto James Aquino","role":"supervisor"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000017', 'lisa.fernandez@nexhrms.test',
    '{"name":"Lisa Marie Fernandez","role":"employee"}');
  CALL upsert_user('00000000-0000-0000-0000-000000000018', 'mark.delacruz@nexhrms.test',
    '{"name":"Mark Anthony Dela Cruz","role":"employee"}');
END $$;

-- ─── 2. Upsert profiles (trigger may already handle this, belt-and-suspenders) ──
INSERT INTO public.profiles (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@nexhrms.com',             'Alex Rivera',             'admin'),
  ('00000000-0000-0000-0000-000000000002', 'hr@nexhrms.com',                'Jordan Lee',              'hr'),
  ('00000000-0000-0000-0000-000000000003', 'finance@nexhrms.com',           'Morgan Chen',             'finance'),
  ('00000000-0000-0000-0000-000000000004', 'employee@nexhrms.com',          'Sam Torres',              'employee'),
  ('00000000-0000-0000-0000-000000000005', 'supervisor@nexhrms.com',        'Pat Reyes',               'supervisor'),
  ('00000000-0000-0000-0000-000000000006', 'payroll@nexhrms.com',           'Dana Cruz',               'payroll_admin'),
  ('00000000-0000-0000-0000-000000000007', 'auditor@nexhrms.com',           'Rene Santos',             'auditor'),
  ('00000000-0000-0000-0000-000000000008', 'qr@nexhrms.com',                'Jamie Reyes',             'employee'),
  ('00000000-0000-0000-0000-000000000009', 'qr2@nexhrms.com',               'Riley Santos',            'employee'),
  ('00000000-0000-0000-0000-000000000010', 'face@nexhrms.com',              'Alex Reyes',              'employee'),
  ('00000000-0000-0000-0000-000000000011', 'maria.cruz@nexhrms.test',       'Maria Santos Cruz',       'employee'),
  ('00000000-0000-0000-0000-000000000012', 'juan.reyes@nexhrms.test',       'Juan Miguel Reyes',       'employee'),
  ('00000000-0000-0000-0000-000000000013', 'ana.villanueva@nexhrms.test',   'Ana Patricia Villanueva', 'finance'),
  ('00000000-0000-0000-0000-000000000014', 'carlo.gonzales@nexhrms.test',   'Carlo Miguel Gonzales',   'employee'),
  ('00000000-0000-0000-0000-000000000015', 'elena.tan@nexhrms.test',        'Elena Marie Tan',         'hr'),
  ('00000000-0000-0000-0000-000000000016', 'roberto.aquino@nexhrms.test',   'Roberto James Aquino',    'supervisor'),
  ('00000000-0000-0000-0000-000000000017', 'lisa.fernandez@nexhrms.test',   'Lisa Marie Fernandez',    'employee'),
  ('00000000-0000-0000-0000-000000000018', 'mark.delacruz@nexhrms.test',    'Mark Anthony Dela Cruz',  'employee')
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = EXCLUDED.name,
      role = EXCLUDED.role;

-- ─── 3. Upsert employees for accounts that map to employees ─────────────────
INSERT INTO public.employees (
  id, profile_id, name, email, role, department, status,
  work_type, salary, join_date, productivity, location, phone, birthday,
  job_title, pin, work_days, pay_frequency, address, emergency_contact
) VALUES
  -- Core demo employees
  ('EMP026', '00000000-0000-0000-0000-000000000004', 'Sam Torres',   'employee@nexhrms.com',
    'employee', 'Engineering',   'active', 'WFO',    88000, '2024-01-10', 82, 'Manila',
    '+63-555-0126', '1995-04-20', 'Frontend Developer', '666666',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'semi_monthly',
    '88 Rizal Avenue, Malate, Manila', 'Maria Torres (Mother) - +63-918-5550001'),

  ('EMP027', '00000000-0000-0000-0000-000000000008', 'Jamie Reyes',  'qr@nexhrms.com',
    'employee', 'Operations',    'active', 'ONSITE', 45000, '2025-03-15', 88, 'Marikina, Metro Manila',
    '+63-917-1234567', '1998-05-22', 'Field Technician', '',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'semi_monthly',
    '123 Shoe Ave, Marikina City, Metro Manila', 'Maria Reyes - +63-918-7654321'),

  ('EMP028', '00000000-0000-0000-0000-000000000009', 'Riley Santos', 'qr2@nexhrms.com',
    'employee', 'Operations',    'active', 'ONSITE', 42000, '2025-06-01', 82, 'Quezon City, Metro Manila',
    '+63-918-9876543', '1999-11-08', 'Field Technician', '',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'semi_monthly',
    '456 Commonwealth Ave, Quezon City, Metro Manila', 'Carlos Santos - +63-919-1112222'),

  ('EMP029', '00000000-0000-0000-0000-000000000010', 'Alex Reyes',   'face@nexhrms.com',
    'employee', 'Operations',    'active', 'ONSITE', 52000, '2025-01-15', 90, 'Makati, Metro Manila',
    '+63-917-5550029', '1993-07-14', 'Security Officer', '290290',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'semi_monthly',
    '29 Dela Rosa Street, Legazpi Village, Makati City', 'Rosa Reyes (Mother) - +63-918-5550029'),

  -- Payroll test employees
  ('EMP-PAY-001', '00000000-0000-0000-0000-000000000011', 'Maria Santos Cruz',       'maria.cruz@nexhrms.test',
    'employee', 'Engineering',   'active', 'HYBRID', 85000, '2023-01-15', 92, 'Makati City',
    '+63 917 555 0001', '1990-08-15', 'Senior Software Engineer', '100100',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'semi_monthly',
    'Unit 1205 The Residences, Ayala Avenue, Makati City 1226', 'Juan Cruz (Husband) - +63 918 555 0001'),

  ('EMP-PAY-002', '00000000-0000-0000-0000-000000000012', 'Juan Miguel Reyes',       'juan.reyes@nexhrms.test',
    'employee', 'Engineering',   'active', 'WFH',    65000, '2023-06-01', 88, 'Quezon City',
    '+63 918 555 0002', '1992-03-22', 'Full Stack Developer', '200200',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'semi_monthly',
    '123 Kalayaan Avenue, Diliman, Quezon City 1101', 'Rosa Reyes (Mother) - +63 919 555 0002'),

  ('EMP-PAY-003', '00000000-0000-0000-0000-000000000013', 'Ana Patricia Villanueva', 'ana.villanueva@nexhrms.test',
    'finance',  'Finance',       'active', 'WFO',    55000, '2022-09-15', 95, 'Ortigas Center',
    '+63 917 555 0003', '1988-11-30', 'Senior Accountant', '300300',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'semi_monthly',
    'Block 5 Lot 12, Greenwoods Executive Village, Pasig City 1600', 'Pedro Villanueva (Father) - +63 920 555 0003'),

  ('EMP-PAY-004', '00000000-0000-0000-0000-000000000014', 'Carlo Miguel Gonzales',   'carlo.gonzales@nexhrms.test',
    'employee', 'Operations',    'active', 'ONSITE', 28000, '2024-01-10', 85, 'Parañaque City',
    '+63 919 555 0004', '1995-05-18', 'Field Technician', '400400',
    '{"Mon","Tue","Wed","Thu","Fri","Sat"}', 'semi_monthly',
    '456 Don Bosco Street, BF Homes, Parañaque City 1720', 'Lucia Gonzales (Wife) - +63 921 555 0004'),

  ('EMP-PAY-005', '00000000-0000-0000-0000-000000000015', 'Elena Marie Tan',         'elena.tan@nexhrms.test',
    'hr',       'Human Resources','active', 'HYBRID', 75000, '2021-03-01', 90, 'BGC Taguig',
    '+63 917 555 0005', '1985-12-08', 'HR Manager', '500500',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'semi_monthly',
    '8th Avenue corner 26th Street, BGC, Taguig City 1634', 'Michael Tan (Brother) - +63 922 555 0005'),

  ('EMP-PAY-006', '00000000-0000-0000-0000-000000000016', 'Roberto James Aquino',    'roberto.aquino@nexhrms.test',
    'supervisor','Engineering',  'active', 'HYBRID', 120000,'2020-06-15', 94, 'Makati City',
    '+63 918 555 0006', '1983-07-25', 'Engineering Lead', '600600',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'monthly',
    'Tower 2, Greenbelt Residences, Makati City 1223', 'Cristina Aquino (Wife) - +63 923 555 0006'),

  ('EMP-PAY-007', '00000000-0000-0000-0000-000000000017', 'Lisa Marie Fernandez',    'lisa.fernandez@nexhrms.test',
    'employee', 'Marketing',     'active', 'WFH',    45000, '2023-11-01', 82, 'Cebu City',
    '+63 917 555 0007', '1994-09-14', 'Marketing Specialist', '700700',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'semi_monthly',
    'Unit 502 IT Park Tower, Lahug, Cebu City 6000', 'Carmen Fernandez (Mother) - +63 924 555 0007'),

  ('EMP-PAY-008', '00000000-0000-0000-0000-000000000018', 'Mark Anthony Dela Cruz',  'mark.delacruz@nexhrms.test',
    'employee', 'Sales',         'active', 'ONSITE', 35000, '2024-03-15', 78, 'Alabang',
    '+63 920 555 0008', '1996-02-29', 'Sales Executive', '800800',
    '{"Mon","Tue","Wed","Thu","Fri"}', 'semi_monthly',
    'Phase 2 Camella Homes, Munting Ilog, Muntinlupa City 1773', 'Patricia Dela Cruz (Mother) - +63 925 555 0008')

ON CONFLICT (id) DO UPDATE
  SET profile_id        = EXCLUDED.profile_id,
      name              = EXCLUDED.name,
      email             = EXCLUDED.email,
      role              = EXCLUDED.role,
      department        = EXCLUDED.department,
      status            = EXCLUDED.status,
      work_type         = EXCLUDED.work_type,
      salary            = EXCLUDED.salary,
      join_date         = EXCLUDED.join_date,
      productivity      = EXCLUDED.productivity,
      location          = EXCLUDED.location,
      phone             = EXCLUDED.phone,
      birthday          = EXCLUDED.birthday,
      job_title         = EXCLUDED.job_title,
      pin               = EXCLUDED.pin,
      work_days         = EXCLUDED.work_days,
      pay_frequency     = EXCLUDED.pay_frequency,
      address           = EXCLUDED.address,
      emergency_contact = EXCLUDED.emergency_contact;
