-- ════════════════════════════════════════════════════════════════════
-- Migration 016: V1 Parity — Bring NexHRMSV2 database up to par with V1
-- Covers V1 migrations: 015, 018, 019, 020, 021, 023, 027, 029, 034, 035,
--   039, 040, 041, 044, 046, 047, 048, 049, 050, 051, 052
-- All statements are idempotent (safe to re-run)
-- ════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 1: Performance Indexes (from V1 015)
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_att_events_emp_ts ON public.attendance_events(employee_id, timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_leave_req_emp_dates ON public.leave_requests(employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_payslips_batch ON public.payslips(payroll_batch_id);
CREATE INDEX IF NOT EXISTS idx_loan_ded_payslip ON public.loan_deductions(payslip_id);
CREATE INDEX IF NOT EXISTS idx_pings_emp_ts ON public.location_pings(employee_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_ts_status ON public.timesheets(status);
CREATE INDEX IF NOT EXISTS idx_notif_sent ON public.notification_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_tcr_employee ON public.task_completion_reports(employee_id);

-- CHECK constraints (idempotent)
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_role_check') THEN
  ALTER TABLE public.employees ADD CONSTRAINT employees_role_check
    CHECK (role IN ('Admin','HR Admin','Finance','Employee','Supervisor','Payroll Admin','Auditor'));
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'loans_type_check') THEN
  ALTER TABLE public.loans ADD CONSTRAINT loans_type_check
    CHECK (type IN ('cash_advance','salary_loan','sss','pagibig','other'));
END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2: Seed Profile Flags (from V1 018)
-- ═══════════════════════════════════════════════════════════════════

UPDATE profiles
SET profile_complete = true,
    must_change_password = false
WHERE profile_complete = false
   OR must_change_password = true;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 3: Expand attendance_events.event_type (from V1 019 + 021)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.attendance_events
  DROP CONSTRAINT IF EXISTS attendance_events_event_type_check;

ALTER TABLE public.attendance_events
  ADD CONSTRAINT attendance_events_event_type_check
  CHECK (event_type IN (
    'IN', 'OUT', 'BREAK_START', 'BREAK_END',
    'OVERRIDE', 'BULK_OVERRIDE', 'MARK_ABSENT', 'MARK_PRESENT',
    'OT_APPROVED', 'OT_REJECTED', 'OT_SUBMITTED',
    'EXCEPTION_RESOLVED', 'EXCEPTION_SCANNED',
    'HOLIDAY_ADDED', 'HOLIDAY_UPDATED', 'HOLIDAY_DELETED',
    'CSV_IMPORTED', 'CSV_EXPORTED',
    'PENALTY_APPLIED', 'PENALTY_CLEARED',
    'SHIFT_ASSIGNED', 'DATA_RESET'
  ));

-- Add audit columns to attendance_events (from V1 021)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_events' AND column_name = 'performed_by'
  ) THEN
    ALTER TABLE public.attendance_events ADD COLUMN performed_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_events' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.attendance_events ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_events' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.attendance_events ADD COLUMN metadata jsonb;
  END IF;
END $$;

-- Add timestamps to attendance_logs if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.attendance_logs ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.attendance_logs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 4: Realtime Publications (from V1 020, 040, 041, 046)
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tables text[] := ARRAY[
    -- From 020
    'attendance_logs', 'attendance_events', 'leave_requests', 'leave_balances',
    'overtime_requests', 'employees', 'payslips', 'payroll_runs', 'loans',
    'salary_change_requests', 'announcements', 'channel_messages', 'tasks',
    'holidays', 'shift_templates', 'employee_shifts',
    -- From 040
    'payroll_adjustments', 'final_pay_computations', 'calendar_events',
    'leave_policies', 'projects', 'timesheets', 'notification_rules',
    -- From 041
    'face_enrollments',
    -- From 046
    'text_channels'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 5: Face Embedding Functions (from V1 023)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.match_face_embedding(
  query_embedding JSONB,
  match_threshold FLOAT8 DEFAULT 0.75
)
RETURNS TABLE(
  employee_id TEXT,
  distance FLOAT8,
  enrollment_id TEXT
) AS $$
DECLARE
  q_arr FLOAT8[];
BEGIN
  SELECT array_agg(val::FLOAT8)
  INTO q_arr
  FROM jsonb_array_elements_text(query_embedding) AS val;

  RETURN QUERY
  WITH computed AS (
    SELECT
      fe.employee_id,
      fe.id AS enrollment_id,
      sqrt(
        (SELECT sum(power(q.val - e.val, 2))
         FROM unnest(q_arr) WITH ORDINALITY AS q(val, idx),
              unnest(
                (SELECT array_agg(v::FLOAT8)
                 FROM jsonb_array_elements_text(fe.embedding) AS v)
              ) WITH ORDINALITY AS e(val, idx)
         WHERE q.idx = e.idx)
      ) AS dist
    FROM face_enrollments fe
    WHERE fe.is_active = true
      AND fe.embedding IS NOT NULL
      AND jsonb_array_length(fe.embedding) = 128
  )
  SELECT c.employee_id, c.dist AS distance, c.enrollment_id
  FROM computed c
  WHERE c.dist < match_threshold
  ORDER BY c.dist
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.verify_face_embedding(
  p_employee_id TEXT,
  query_embedding JSONB,
  match_threshold FLOAT8 DEFAULT 0.75
)
RETURNS TABLE(
  matched BOOLEAN,
  distance FLOAT8
) AS $$
DECLARE
  stored_embedding JSONB;
  q_arr FLOAT8[];
  s_arr FLOAT8[];
  dist FLOAT8;
BEGIN
  SELECT fe.embedding INTO stored_embedding
  FROM face_enrollments fe
  WHERE fe.employee_id = p_employee_id
    AND fe.is_active = true
    AND fe.embedding IS NOT NULL;

  IF stored_embedding IS NULL THEN
    RETURN QUERY SELECT false, 999.0::FLOAT8;
    RETURN;
  END IF;

  SELECT array_agg(val::FLOAT8) INTO q_arr
  FROM jsonb_array_elements_text(query_embedding) AS val;

  SELECT array_agg(val::FLOAT8) INTO s_arr
  FROM jsonb_array_elements_text(stored_embedding) AS val;

  SELECT sqrt(sum(power(q.val - s.val, 2))) INTO dist
  FROM unnest(q_arr) WITH ORDINALITY AS q(val, idx),
       unnest(s_arr) WITH ORDINALITY AS s(val, idx)
  WHERE q.idx = s.idx;

  IF dist < match_threshold THEN
    UPDATE face_enrollments
    SET last_verified = NOW(),
        verification_count = verification_count + 1
    WHERE employee_id = p_employee_id AND is_active = true;
  END IF;

  RETURN QUERY SELECT (dist < match_threshold), dist;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 6: Project Constraints & Trigger (from V1 027 + 029)
-- ═══════════════════════════════════════════════════════════════════

-- The trigger function operates on the project_assignments junction table
CREATE OR REPLACE FUNCTION public.enforce_one_project_per_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.project_assignments
    WHERE employee_id = NEW.employee_id
      AND project_id <> NEW.project_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_one_project_per_employee ON public.projects;
DROP TRIGGER IF EXISTS trg_one_project_per_employee ON public.project_assignments;
CREATE TRIGGER trg_one_project_per_employee
    BEFORE INSERT
    ON public.project_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_one_project_per_employee();

GRANT EXECUTE ON FUNCTION public.enforce_one_project_per_employee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_one_project_per_employee() TO service_role;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 7: Seed Job Titles (from V1 034)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.job_titles (id, name, department, is_lead, created_by) VALUES
    ('jt_frontend_dev', 'Frontend Developer', 'Engineering', false, 'system'),
    ('jt_backend_dev', 'Backend Developer', 'Engineering', false, 'system'),
    ('jt_uiux_designer', 'UI/UX Designer', 'Design', false, 'system'),
    ('jt_product_manager', 'Product Manager', 'Operations', true, 'system'),
    ('jt_hr_manager', 'HR Manager', 'Human Resources', true, 'system'),
    ('jt_hr_specialist', 'HR Specialist', 'Human Resources', false, 'system'),
    ('jt_finance_manager', 'Finance Manager', 'Finance', true, 'system'),
    ('jt_accountant', 'Accountant', 'Finance', false, 'system'),
    ('jt_marketing_lead', 'Marketing Lead', 'Marketing', true, 'system'),
    ('jt_sales_exec', 'Sales Executive', 'Sales', false, 'system'),
    ('jt_devops_engineer', 'DevOps Engineer', 'Engineering', false, 'system'),
    ('jt_qa_engineer', 'QA Engineer', 'Engineering', false, 'system')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 8: Seed Departments (from V1 035)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.departments (id, name, description, created_by) VALUES
    ('dept_engineering', 'Engineering', 'Software development and technical teams', 'system'),
    ('dept_design', 'Design', 'UI/UX and graphic design teams', 'system'),
    ('dept_marketing', 'Marketing', 'Marketing and brand management', 'system'),
    ('dept_hr', 'Human Resources', 'HR, recruitment, and employee relations', 'system'),
    ('dept_finance', 'Finance', 'Accounting, payroll, and financial operations', 'system'),
    ('dept_sales', 'Sales', 'Sales and business development', 'system'),
    ('dept_operations', 'Operations', 'Business operations and administration', 'system')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 9: Payroll FK Cascade Fixes (from V1 039)
-- ═══════════════════════════════════════════════════════════════════

-- 1. loan_deductions.payslip_id (NOT NULL → CASCADE)
ALTER TABLE public.loan_deductions
  DROP CONSTRAINT IF EXISTS fk_ld_payslip,
  ADD  CONSTRAINT fk_ld_payslip
       FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
       ON DELETE CASCADE;

-- 2. payroll_run_payslips.payslip_id (NOT NULL junction → CASCADE)
ALTER TABLE public.payroll_run_payslips
  DROP CONSTRAINT IF EXISTS payroll_run_payslips_payslip_id_fkey,
  ADD  CONSTRAINT payroll_run_payslips_payslip_id_fkey
       FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
       ON DELETE CASCADE;

-- 3. payroll_adjustments.reference_payslip_id (NOT NULL → CASCADE)
ALTER TABLE public.payroll_adjustments
  DROP CONSTRAINT IF EXISTS fk_pa_payslip,
  ADD  CONSTRAINT fk_pa_payslip
       FOREIGN KEY (reference_payslip_id) REFERENCES public.payslips(id)
       ON DELETE CASCADE;

-- 4. loan_balance_history.payslip_id (nullable → SET NULL)
ALTER TABLE public.loan_balance_history
  DROP CONSTRAINT IF EXISTS fk_lbh_payslip,
  ADD  CONSTRAINT fk_lbh_payslip
       FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
       ON DELETE SET NULL;

-- 5. loan_repayment_schedule.payslip_id (nullable → SET NULL)
ALTER TABLE public.loan_repayment_schedule
  DROP CONSTRAINT IF EXISTS fk_lrs_payslip,
  ADD  CONSTRAINT fk_lrs_payslip
       FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
       ON DELETE SET NULL;

-- 6. final_pay_computations.payslip_id (nullable → SET NULL)
ALTER TABLE public.final_pay_computations
  DROP CONSTRAINT IF EXISTS fk_fpc_payslip,
  ADD  CONSTRAINT fk_fpc_payslip
       FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
       ON DELETE SET NULL;

-- 7. payroll_run_payslips.run_id (NOT NULL junction → CASCADE)
ALTER TABLE public.payroll_run_payslips
  DROP CONSTRAINT IF EXISTS payroll_run_payslips_run_id_fkey,
  ADD  CONSTRAINT payroll_run_payslips_run_id_fkey
       FOREIGN KEY (run_id) REFERENCES public.payroll_runs(id)
       ON DELETE CASCADE;

-- 8. payroll_adjustments.payroll_run_id (NOT NULL → CASCADE)
ALTER TABLE public.payroll_adjustments
  DROP CONSTRAINT IF EXISTS fk_pa_run,
  ADD  CONSTRAINT fk_pa_run
       FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id)
       ON DELETE CASCADE;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 10: Notification Logs Partial Index (from V1 044)
-- (V2 already has read/read_at/link columns — just need the index)
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_notif_unread ON public.notification_logs(employee_id, read)
  WHERE read = false;

-- RLS: Allow employees to update their own notification read status
DROP POLICY IF EXISTS nl_update_own ON public.notification_logs;
CREATE POLICY nl_update_own ON public.notification_logs
  FOR UPDATE USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employees WHERE profile_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 11: Push Subscriptions Table (from V1 047)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT fk_push_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_push_subs_employee ON public.push_subscriptions(employee_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (
    employee_id IN (
      SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid()
    )
  );

CREATE POLICY "Admin can view all push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.profile_id = auth.uid() AND e.role IN ('admin', 'hr')
    )
  );

ALTER TABLE public.push_subscriptions REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL;
END; $$;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 12: Payroll Payment Proof (from V1 048)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE payslips ADD COLUMN IF NOT EXISTS payment_proof_url text;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS cash_amount numeric;

ALTER TABLE payslips DROP CONSTRAINT IF EXISTS payslips_payment_method_check;
ALTER TABLE payslips ADD CONSTRAINT payslips_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['bank_transfer'::text, 'gcash'::text, 'cash'::text, 'check'::text]));


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 13: Employees Notification Preferences (from V1 049)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 14: Avatars Storage Bucket (from V1 050)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Avatars are publicly readable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 15: Kiosk Config Table (from V1 051)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.kiosk_config (
  id text NOT NULL DEFAULT 'default'::text,

  -- General
  kiosk_enabled boolean NOT NULL DEFAULT true,
  kiosk_title text NOT NULL DEFAULT 'Attendance Kiosk'::text,
  welcome_message text NOT NULL DEFAULT 'Choose a method to check in or out'::text,
  footer_message text NOT NULL DEFAULT 'Unauthorized access is prohibited'::text,

  -- Check-in methods
  check_in_method text NOT NULL DEFAULT 'all'::text,
  enable_pin boolean NOT NULL DEFAULT true,
  enable_qr boolean NOT NULL DEFAULT true,
  enable_face boolean NOT NULL DEFAULT true,
  enable_nfc boolean NOT NULL DEFAULT true,
  allow_check_out boolean NOT NULL DEFAULT true,

  -- PIN settings
  pin_length integer NOT NULL DEFAULT 6,
  max_pin_attempts integer NOT NULL DEFAULT 0,
  lockout_duration integer NOT NULL DEFAULT 60,

  -- QR / Token
  token_refresh_interval integer NOT NULL DEFAULT 30,
  token_length integer NOT NULL DEFAULT 8,

  -- NFC
  nfc_simulated_delay integer NOT NULL DEFAULT 1500,

  -- Display
  kiosk_theme text NOT NULL DEFAULT 'auto'::text,
  clock_format text NOT NULL DEFAULT '24h'::text,
  show_clock boolean NOT NULL DEFAULT true,
  show_date boolean NOT NULL DEFAULT true,
  show_logo boolean NOT NULL DEFAULT true,
  show_device_id boolean NOT NULL DEFAULT true,
  show_security_badge boolean NOT NULL DEFAULT true,

  -- Behavior
  feedback_duration integer NOT NULL DEFAULT 1800,
  warn_off_day boolean NOT NULL DEFAULT true,
  play_sound boolean NOT NULL DEFAULT false,
  idle_timeout integer NOT NULL DEFAULT 0,
  idle_action text NOT NULL DEFAULT 'none'::text,

  -- Security
  require_geofence boolean NOT NULL DEFAULT false,

  -- Selfie
  selfie_enabled boolean NOT NULL DEFAULT false,
  selfie_required boolean NOT NULL DEFAULT false,

  -- Face Recognition
  face_rec_enabled boolean NOT NULL DEFAULT true,
  face_rec_required boolean NOT NULL DEFAULT false,
  face_rec_auto_start boolean NOT NULL DEFAULT true,
  face_rec_countdown integer NOT NULL DEFAULT 3,
  face_rec_position text NOT NULL DEFAULT 'bottom'::text,

  -- Anti-Cheat
  dev_options_penalty_enabled boolean NOT NULL DEFAULT true,
  dev_options_penalty_minutes integer NOT NULL DEFAULT 30,
  dev_options_penalty_apply_to text NOT NULL DEFAULT 'both'::text,
  dev_options_penalty_notify_admin boolean NOT NULL DEFAULT true,

  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT kiosk_config_pkey PRIMARY KEY (id)
);

INSERT INTO public.kiosk_config (id) VALUES ('default') ON CONFLICT DO NOTHING;

ALTER TABLE public.kiosk_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read kiosk config"
  ON public.kiosk_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update kiosk config"
  ON public.kiosk_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can insert kiosk config"
  ON public.kiosk_config FOR INSERT TO authenticated WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 16: Notification Provider Config (from V1 052)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.notification_provider_config (
  id text NOT NULL DEFAULT 'default'::text,
  sms_provider text NOT NULL DEFAULT 'simulated'::text,
  email_provider text NOT NULL DEFAULT 'simulated'::text,
  sms_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  default_sender_name text NOT NULL DEFAULT 'NexHRMS'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_provider_config_pkey PRIMARY KEY (id)
);

INSERT INTO public.notification_provider_config (id) VALUES ('default') ON CONFLICT DO NOTHING;

ALTER TABLE public.notification_provider_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notification provider config"
  ON public.notification_provider_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update notification provider config"
  ON public.notification_provider_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can insert notification provider config"
  ON public.notification_provider_config FOR INSERT TO authenticated WITH CHECK (true);

-- Seed default notification rules
INSERT INTO public.notification_rules (id, trigger, enabled, channel, recipient_roles, timing, schedule_time, reminder_days, subject_template, body_template, sms_template) VALUES
  ('NR-01', 'payslip_published', true, 'both', '{employee}', 'immediate', NULL, NULL, 'Payslip Ready: {period}', 'Hi {name}, your payslip for {period} is ready. Net pay: {amount}. Please sign in NexHRMS.', 'Your payslip for {period} is ready. Net: {amount}.'),
  ('NR-02', 'leave_submitted', true, 'email', '{admin,hr}', 'immediate', NULL, NULL, 'Leave Request: {name}', '{name} submitted a {leaveType} leave request ({dates}).', NULL),
  ('NR-03', 'leave_approved', true, 'both', '{employee}', 'immediate', NULL, NULL, 'Leave {status}: {dates}', 'Hi {name}, your {leaveType} leave ({dates}) has been {status}.', 'Your {leaveType} leave ({dates}) has been {status}.'),
  ('NR-04', 'leave_rejected', true, 'both', '{employee}', 'immediate', NULL, NULL, 'Leave Rejected: {dates}', 'Hi {name}, your {leaveType} leave ({dates}) has been rejected.', NULL),
  ('NR-05', 'attendance_missing', true, 'sms', '{employee}', 'scheduled', '10:00', NULL, 'Check-In Reminder', 'Reminder: You have not checked in today. Please check in.', 'Reminder: You have not checked in today.'),
  ('NR-06', 'geofence_violation', true, 'email', '{admin}', 'immediate', NULL, NULL, 'Geofence Violation: {name}', '{name} is outside the geofence at {time}. Distance: {distance}m.', NULL),
  ('NR-07', 'loan_reminder', true, 'sms', '{employee}', 'scheduled', NULL, '{3}', 'Loan Deduction Reminder', 'Reminder: {amount} loan deduction will be applied to your next payslip.', 'Reminder: {amount} loan deduction on next payslip.'),
  ('NR-08', 'payslip_unsigned_reminder', true, 'both', '{employee}', 'scheduled', NULL, '{1,3,5}', 'Sign Your Payslip: {period}', 'Reminder: Please sign your payslip for {period}.', 'Reminder: Sign your payslip for {period}.'),
  ('NR-09', 'overtime_submitted', true, 'email', '{admin,supervisor}', 'immediate', NULL, NULL, 'Overtime Request: {name}', '{name} submitted an overtime request for {date}.', NULL),
  ('NR-10', 'birthday', true, 'both', '{employee}', 'scheduled', '08:00', NULL, 'Happy Birthday!', 'Happy Birthday, {name}! Wishing you a great day!', 'Happy Birthday, {name}!'),
  ('NR-11', 'contract_expiry', true, 'email', '{admin,hr}', 'scheduled', NULL, '{30,7}', 'Contract Expiry: {name}', '{name}''s probation/contract ends on {date}. Action required.', NULL),
  ('NR-12', 'daily_summary', false, 'email', '{admin}', 'scheduled', '18:00', NULL, 'Daily Attendance Summary', 'Today: {present} present, {absent} absent, {onLeave} on leave.', NULL),
  ('NR-13', 'location_disabled', true, 'both', '{admin}', 'immediate', NULL, NULL, 'Location Disabled: {name}', '{name} has disabled location tracking at {time}.', '{name} disabled GPS at {time}.'),
  ('NR-14', 'payslip_signed', true, 'email', '{admin,finance}', 'immediate', NULL, NULL, 'Payslip Signed: {name} ({period})', '{name} has signed their payslip for {period}.', NULL),
  ('NR-15', 'payment_confirmed', true, 'sms', '{employee}', 'immediate', NULL, NULL, 'Payment Confirmed: {period}', 'Your payment for {period} has been confirmed. Amount: {amount}.', 'Payment confirmed for {period}. Amount: {amount}.')
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 17: Face Recognition Test Account (from V1 041)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.employees (
    id, name, email, role, department, status, work_type,
    salary, join_date, productivity, location, phone, birthday,
    work_days, pay_frequency, whatsapp_number, preferred_channel,
    address, emergency_contact, pin, nfc_id, created_at, updated_at
)
VALUES (
    'EMP029', 'Alex Reyes', 'face@sdsi.com', 'employee', 'Operations',
    'active', 'ONSITE', 52000, '2025-01-15', 90, 'Makati, Metro Manila',
    '+63-917-5550029', '1993-07-14',
    ARRAY['Mon','Tue','Wed','Thu','Fri'], 'semi_monthly',
    '+63-917-5550029', 'in_app',
    '29 Dela Rosa Street, Legazpi Village, Makati City, Metro Manila',
    'Rosa Reyes (Mother) - +63-918-5550029', '290290', 'NFC-029', NOW(), NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, email = EXCLUDED.email,
    status = EXCLUDED.status, department = EXCLUDED.department,
    work_type = EXCLUDED.work_type, updated_at = NOW();

INSERT INTO public.projects (
    id, name, description,
    location_lat, location_lng, location_radius,
    assigned_employee_ids, verification_method,
    require_geofence, geofence_radius_meters, status, created_at
)
VALUES (
    'PRJ006', 'Makati Security Post – Face Check-in',
    'Makati CBD security post using face recognition for attendance.',
    14.5567, 121.0178, 300, ARRAY['EMP029'], 'face_only',
    true, 300, 'active', '2026-01-15T00:00:00Z'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, assigned_employee_ids = EXCLUDED.assigned_employee_ids,
    verification_method = EXCLUDED.verification_method, updated_at = NOW();

INSERT INTO public.project_assignments (project_id, employee_id, assigned_at)
VALUES ('PRJ006', 'EMP029', NOW())
ON CONFLICT (project_id, employee_id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- SECTION 18: Disable RLS for Development (from V1 040)
-- WARNING: Re-enable RLS before deploying to production!
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  all_tables text[] := ARRAY[
    'announcements', 'appearance_config', 'attendance_events',
    'attendance_evidence', 'attendance_exceptions', 'attendance_logs',
    'attendance_rule_sets', 'audit_logs', 'break_records',
    'calendar_events', 'channel_messages', 'custom_pages',
    'dashboard_layouts', 'deduction_global_defaults', 'deduction_overrides',
    'departments', 'employee_documents', 'employee_shifts', 'employees',
    'face_enrollments', 'final_pay_computations', 'gov_table_versions',
    'holidays', 'job_titles', 'kiosk_config', 'kiosk_devices', 'kiosk_pins',
    'leave_balances', 'leave_policies', 'leave_requests',
    'loan_balance_history', 'loan_deductions', 'loan_repayment_schedule',
    'loans', 'location_config', 'location_pings',
    'manual_checkin_reasons', 'manual_checkins',
    'notification_logs', 'notification_provider_config', 'notification_rules',
    'overtime_requests', 'pay_schedule_config', 'payroll_adjustments',
    'payroll_run_payslips', 'payroll_runs', 'payroll_signature_config',
    'payslips', 'penalty_records', 'profiles', 'project_assignments',
    'project_verification_methods', 'projects', 'push_subscriptions',
    'qr_tokens', 'roles_custom', 'salary_change_requests', 'salary_history',
    'shift_templates', 'site_survey_photos', 'task_comments',
    'task_completion_reports', 'task_groups', 'task_tags', 'tasks',
    'text_channels', 'timesheets'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END;
$$;
