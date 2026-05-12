-- ─── Notification provider configuration singleton ─────────────────────────
-- Stores SMS/email provider settings (one row with id = 'default')

CREATE TABLE IF NOT EXISTS public.notification_provider_config (
  id text NOT NULL DEFAULT 'default'::text,
  sms_provider text NOT NULL DEFAULT 'simulated'::text,
  email_provider text NOT NULL DEFAULT 'simulated'::text,
  sms_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  default_sender_name text NOT NULL DEFAULT 'Soren Data Solutions'::text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_provider_config_pkey PRIMARY KEY (id)
);

-- Seed default row
INSERT INTO public.notification_provider_config (id) VALUES ('default') ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.notification_provider_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notification provider config"
  ON public.notification_provider_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update notification provider config"
  ON public.notification_provider_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can insert notification provider config"
  ON public.notification_provider_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ─── Seed default notification rules if table is empty ─────────────────────
-- The notification_rules table already exists; ensure it has the default rows.
INSERT INTO public.notification_rules (id, trigger, enabled, channel, recipient_roles, timing, schedule_time, reminder_days, subject_template, body_template, sms_template) VALUES
  ('NR-01', 'payslip_published', true, 'both', '{employee}', 'immediate', NULL, NULL, 'Payslip Ready: {period}', 'Hi {name}, your payslip for {period} is ready. Net pay: {amount}. Please sign in Soren Data Solutions.', 'Your payslip for {period} is ready. Net: {amount}.'),
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
