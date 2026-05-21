-- ============================================================
-- APPLY MISSING MIGRATIONS (048, 051, 052, 054, 055, 056, 057, 058, 059, 060)
-- Run this entire script in the Supabase SQL editor.
-- All statements are idempotent (IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 048: Payment proof columns on payslips
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS payment_proof_url text,
  ADD COLUMN IF NOT EXISTS cash_amount numeric;

ALTER TABLE public.payslips
  DROP CONSTRAINT IF EXISTS payslips_payment_method_check;

ALTER TABLE public.payslips
  ADD CONSTRAINT payslips_payment_method_check
  CHECK (payment_method IS NULL OR payment_method = ANY (
    ARRAY['bank_transfer'::text, 'gcash'::text, 'cash'::text, 'check'::text]
  ));

-- ────────────────────────────────────────────────────────────
-- 051: kiosk_config table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kiosk_config (
  id text NOT NULL DEFAULT 'default'::text,
  kiosk_enabled boolean NOT NULL DEFAULT true,
  kiosk_title text NOT NULL DEFAULT 'Attendance Kiosk'::text,
  welcome_message text NOT NULL DEFAULT 'Choose a method to check in or out'::text,
  footer_message text NOT NULL DEFAULT 'Unauthorized access is prohibited'::text,
  check_in_method text NOT NULL DEFAULT 'all'::text,
  enable_pin boolean NOT NULL DEFAULT true,
  enable_qr boolean NOT NULL DEFAULT true,
  enable_face boolean NOT NULL DEFAULT true,
  enable_nfc boolean NOT NULL DEFAULT true,
  allow_check_out boolean NOT NULL DEFAULT true,
  pin_length integer NOT NULL DEFAULT 6,
  max_pin_attempts integer NOT NULL DEFAULT 0,
  lockout_duration integer NOT NULL DEFAULT 60,
  token_refresh_interval integer NOT NULL DEFAULT 30,
  token_length integer NOT NULL DEFAULT 8,
  nfc_simulated_delay integer NOT NULL DEFAULT 1500,
  kiosk_theme text NOT NULL DEFAULT 'auto'::text,
  clock_format text NOT NULL DEFAULT '24h'::text,
  show_clock boolean NOT NULL DEFAULT true,
  show_date boolean NOT NULL DEFAULT true,
  show_logo boolean NOT NULL DEFAULT true,
  show_device_id boolean NOT NULL DEFAULT true,
  show_security_badge boolean NOT NULL DEFAULT true,
  feedback_duration integer NOT NULL DEFAULT 1800,
  warn_off_day boolean NOT NULL DEFAULT true,
  play_sound boolean NOT NULL DEFAULT false,
  idle_timeout integer NOT NULL DEFAULT 0,
  idle_action text NOT NULL DEFAULT 'none'::text,
  require_geofence boolean NOT NULL DEFAULT false,
  selfie_enabled boolean NOT NULL DEFAULT false,
  selfie_required boolean NOT NULL DEFAULT false,
  face_rec_enabled boolean NOT NULL DEFAULT true,
  face_rec_required boolean NOT NULL DEFAULT false,
  face_rec_auto_start boolean NOT NULL DEFAULT true,
  face_rec_countdown integer NOT NULL DEFAULT 3,
  face_rec_position text NOT NULL DEFAULT 'bottom'::text,
  dev_options_penalty_enabled boolean NOT NULL DEFAULT true,
  dev_options_penalty_minutes integer NOT NULL DEFAULT 30,
  dev_options_penalty_apply_to text NOT NULL DEFAULT 'both'::text,
  dev_options_penalty_notify_admin boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kiosk_config_pkey PRIMARY KEY (id)
);
INSERT INTO public.kiosk_config (id) VALUES ('default') ON CONFLICT DO NOTHING;
ALTER TABLE public.kiosk_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read kiosk config" ON public.kiosk_config;
CREATE POLICY "Authenticated users can read kiosk config" ON public.kiosk_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can update kiosk config" ON public.kiosk_config;
CREATE POLICY "Admins can update kiosk config" ON public.kiosk_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can insert kiosk config" ON public.kiosk_config;
CREATE POLICY "Admins can insert kiosk config" ON public.kiosk_config FOR INSERT TO authenticated WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- 052: notification_provider_config table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_provider_config (
  id text NOT NULL DEFAULT 'default'::text,
  sms_provider text NOT NULL DEFAULT 'simulated'::text,
  email_provider text NOT NULL DEFAULT 'simulated'::text,
  sms_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  default_sender_name text NOT NULL DEFAULT 'Soren Data Solutions'::text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_provider_config_pkey PRIMARY KEY (id)
);
INSERT INTO public.notification_provider_config (id) VALUES ('default') ON CONFLICT DO NOTHING;
ALTER TABLE public.notification_provider_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read notification provider config" ON public.notification_provider_config;
CREATE POLICY "Authenticated users can read notification provider config" ON public.notification_provider_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins can update notification provider config" ON public.notification_provider_config;
CREATE POLICY "Admins can update notification provider config" ON public.notification_provider_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can insert notification provider config" ON public.notification_provider_config;
CREATE POLICY "Admins can insert notification provider config" ON public.notification_provider_config FOR INSERT TO authenticated WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- 054: Fix payslips_status_check constraint (add paid + payment_hold)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.payslips DROP CONSTRAINT IF EXISTS payslips_status_check;
UPDATE public.payslips
SET status = 'published'
WHERE status NOT IN ('draft', 'published', 'signed', 'paid', 'payment_hold');
ALTER TABLE public.payslips
  ADD CONSTRAINT payslips_status_check
  CHECK (status IN ('draft', 'published', 'signed', 'paid', 'payment_hold'));

-- ────────────────────────────────────────────────────────────
-- 055: Client feature pack (OT multipliers, period dates, auto-deductions, QR secret)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.attendance_rule_sets
  ADD COLUMN IF NOT EXISTS ot_multiplier_regular         numeric NOT NULL DEFAULT 1.25,
  ADD COLUMN IF NOT EXISTS ot_multiplier_rest_day        numeric NOT NULL DEFAULT 1.30,
  ADD COLUMN IF NOT EXISTS ot_multiplier_special_holiday numeric NOT NULL DEFAULT 1.30,
  ADD COLUMN IF NOT EXISTS ot_multiplier_regular_holiday numeric NOT NULL DEFAULT 2.00,
  ADD COLUMN IF NOT EXISTS ot_multiplier_night_diff      numeric NOT NULL DEFAULT 1.10;

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end   date;

CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON public.payroll_runs(period_start, period_end);

ALTER TABLE public.pay_schedule_config
  ADD COLUMN IF NOT EXISTS auto_deduct_late      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_deduct_absent    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_deduct_undertime boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_add_overtime     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS work_days_per_month   integer NOT NULL DEFAULT 22 CHECK (work_days_per_month BETWEEN 1 AND 31);

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS late_deduction      numeric NOT NULL DEFAULT 0 CHECK (late_deduction      >= 0),
  ADD COLUMN IF NOT EXISTS absent_deduction    numeric NOT NULL DEFAULT 0 CHECK (absent_deduction    >= 0),
  ADD COLUMN IF NOT EXISTS undertime_deduction numeric NOT NULL DEFAULT 0 CHECK (undertime_deduction >= 0),
  ADD COLUMN IF NOT EXISTS overtime_pay        numeric NOT NULL DEFAULT 0 CHECK (overtime_pay        >= 0),
  ADD COLUMN IF NOT EXISTS daily_rate          numeric NOT NULL DEFAULT 0 CHECK (daily_rate          >= 0),
  ADD COLUMN IF NOT EXISTS hourly_rate         numeric NOT NULL DEFAULT 0 CHECK (hourly_rate         >= 0);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS qr_secret  text,
  ADD COLUMN IF NOT EXISTS qr_enabled boolean NOT NULL DEFAULT true;

UPDATE public.projects SET qr_secret = encode(gen_random_bytes(24), 'base64') WHERE qr_secret IS NULL;
ALTER TABLE public.projects ALTER COLUMN qr_secret SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_qr_secret_unique ON public.projects(qr_secret);

-- ────────────────────────────────────────────────────────────
-- 056: BIR compliance foundation
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS tin                       text,
  ADD COLUMN IF NOT EXISTS employment_classification text NOT NULL DEFAULT 'R' CHECK (employment_classification IN ('R','C','CP','S','P','AL')),
  ADD COLUMN IF NOT EXISTS is_mwe                    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mwe_daily_rate            numeric CHECK (mwe_daily_rate IS NULL OR mwe_daily_rate >= 0),
  ADD COLUMN IF NOT EXISTS substituted_filing        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_status                text NOT NULL DEFAULT 'S' CHECK (tax_status IN ('S','M','ME','MX')),
  ADD COLUMN IF NOT EXISTS tax_residency             text NOT NULL DEFAULT 'resident' CHECK (tax_residency IN ('resident','non_resident')),
  ADD COLUMN IF NOT EXISTS separation_date           date,
  ADD COLUMN IF NOT EXISTS separation_type           text CHECK (separation_type IS NULL OR separation_type IN ('resigned','terminated','end_of_contract'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_tin_unique ON public.employees(tin) WHERE tin IS NOT NULL;

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS tax_categories           jsonb,
  ADD COLUMN IF NOT EXISTS taxable_compensation     numeric NOT NULL DEFAULT 0 CHECK (taxable_compensation     >= 0),
  ADD COLUMN IF NOT EXISTS non_taxable_compensation numeric NOT NULL DEFAULT 0 CHECK (non_taxable_compensation >= 0);

CREATE TABLE IF NOT EXISTS public.employee_tax_profiles (
  id                        text NOT NULL DEFAULT ('ETP-' || gen_random_uuid()::text),
  employee_id               text NOT NULL,
  tin                       text,
  employment_classification text NOT NULL DEFAULT 'R' CHECK (employment_classification IN ('R','C','CP','S','P','AL')),
  is_mwe                    boolean NOT NULL DEFAULT false,
  mwe_daily_rate            numeric CHECK (mwe_daily_rate IS NULL OR mwe_daily_rate >= 0),
  substituted_filing        boolean NOT NULL DEFAULT false,
  tax_status                text NOT NULL DEFAULT 'S' CHECK (tax_status IN ('S','M','ME','MX')),
  tax_residency             text NOT NULL DEFAULT 'resident' CHECK (tax_residency IN ('resident','non_resident')),
  prev_employer_tin         text,
  prev_employer_name        text,
  prev_income               numeric CHECK (prev_income IS NULL OR prev_income >= 0),
  prev_tax_withheld         numeric CHECK (prev_tax_withheld IS NULL OR prev_tax_withheld >= 0),
  prev_2316_received        boolean NOT NULL DEFAULT false,
  separation_date           date,
  separation_type           text CHECK (separation_type IS NULL OR separation_type IN ('resigned','terminated','end_of_contract')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_tax_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT employee_tax_profiles_employee_unique UNIQUE (employee_id),
  CONSTRAINT employee_tax_profiles_employee_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_etp_employee ON public.employee_tax_profiles(employee_id);

CREATE TABLE IF NOT EXISTS public.annual_tax_summaries (
  id                     text NOT NULL DEFAULT ('ATS-' || gen_random_uuid()::text),
  employee_id            text NOT NULL,
  year                   integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  total_taxable_comp     numeric NOT NULL DEFAULT 0 CHECK (total_taxable_comp >= 0),
  total_non_taxable_comp numeric NOT NULL DEFAULT 0 CHECK (total_non_taxable_comp >= 0),
  total_de_minimis       numeric NOT NULL DEFAULT 0 CHECK (total_de_minimis >= 0),
  total_sss              numeric NOT NULL DEFAULT 0 CHECK (total_sss >= 0),
  total_philhealth       numeric NOT NULL DEFAULT 0 CHECK (total_philhealth >= 0),
  total_pagibig          numeric NOT NULL DEFAULT 0 CHECK (total_pagibig >= 0),
  total_13th_non_taxable numeric NOT NULL DEFAULT 0 CHECK (total_13th_non_taxable >= 0),
  total_13th_taxable     numeric NOT NULL DEFAULT 0 CHECK (total_13th_taxable >= 0),
  total_other_benefits   numeric NOT NULL DEFAULT 0 CHECK (total_other_benefits >= 0),
  total_tax_withheld     numeric NOT NULL DEFAULT 0 CHECK (total_tax_withheld >= 0),
  prev_employer_income   numeric NOT NULL DEFAULT 0 CHECK (prev_employer_income >= 0),
  prev_employer_tax      numeric NOT NULL DEFAULT 0 CHECK (prev_employer_tax >= 0),
  annual_tax_due         numeric CHECK (annual_tax_due IS NULL OR annual_tax_due >= 0),
  adjustment_type        text CHECK (adjustment_type IS NULL OR adjustment_type IN ('over_withheld','under_withheld','balanced')),
  adjustment_amount      numeric,
  status                 text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reconciled','finalized','exported')),
  finalized_at           timestamptz,
  finalized_by           text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT annual_tax_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT annual_tax_summaries_employee_year_unique UNIQUE (employee_id, year),
  CONSTRAINT annual_tax_summaries_employee_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ats_employee_year ON public.annual_tax_summaries(employee_id, year);

CREATE TABLE IF NOT EXISTS public.previous_employer_records (
  id                 text NOT NULL DEFAULT ('PER-' || gen_random_uuid()::text),
  employee_id        text NOT NULL,
  year               integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  employer_name      text NOT NULL,
  employer_tin       text,
  employer_address   text,
  total_income       numeric NOT NULL DEFAULT 0 CHECK (total_income >= 0),
  total_tax_withheld numeric NOT NULL DEFAULT 0 CHECK (total_tax_withheld >= 0),
  reference_2316     text,
  submitted_at       timestamptz NOT NULL DEFAULT now(),
  submitted_by       text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT previous_employer_records_pkey PRIMARY KEY (id),
  CONSTRAINT previous_employer_records_employee_year_unique UNIQUE (employee_id, year),
  CONSTRAINT previous_employer_records_employee_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.form_2316_records (
  id                     text NOT NULL DEFAULT ('F2316-' || gen_random_uuid()::text),
  employee_id            text NOT NULL,
  year                   integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  annual_summary_id      text,
  generated_at           timestamptz NOT NULL DEFAULT now(),
  generated_by           text,
  employer_signed_at     timestamptz,
  employer_signed_by     text,
  employer_signature_url text,
  employee_signed_at     timestamptz,
  employee_signature_url text,
  pdf_url                text,
  document_hash          text,
  status                 text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','for_signature','released','downloaded','revoked')),
  released_at            timestamptz,
  downloaded_at          timestamptz,
  downloaded_by          text,
  revoked_at             timestamptz,
  revoked_by             text,
  revoke_reason          text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT form_2316_records_pkey PRIMARY KEY (id),
  CONSTRAINT form_2316_records_employee_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  CONSTRAINT form_2316_records_summary_fkey  FOREIGN KEY (annual_summary_id) REFERENCES public.annual_tax_summaries(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.alphalist_exports (
  id                 text NOT NULL DEFAULT ('ALX-' || gen_random_uuid()::text),
  year               integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  schedule_type      text NOT NULL CHECK (schedule_type IN ('schedule_1','schedule_2','both')),
  generated_at       timestamptz NOT NULL DEFAULT now(),
  generated_by       text,
  employee_count     integer NOT NULL DEFAULT 0 CHECK (employee_count >= 0),
  total_taxable_comp numeric NOT NULL DEFAULT 0 CHECK (total_taxable_comp >= 0),
  total_tax_withheld numeric NOT NULL DEFAULT 0 CHECK (total_tax_withheld >= 0),
  validation_status  text NOT NULL DEFAULT 'passed' CHECK (validation_status IN ('passed','has_warnings','has_errors')),
  validation_errors  jsonb,
  export_format      text NOT NULL CHECK (export_format IN ('csv','xlsx','dat')),
  file_url           text,
  efps_status        text NOT NULL DEFAULT 'draft' CHECK (efps_status IN ('draft','validated','ready','submitted','payment_pending','paid','completed')),
  submitted_at       timestamptz,
  submitted_by       text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alphalist_exports_pkey PRIMARY KEY (id)
);

ALTER TABLE public.employee_tax_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_tax_summaries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previous_employer_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_2316_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alphalist_exports         ENABLE ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────
-- 057: Employee 201 files + disciplinary (NTE/NOD)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_201_documents (
  id             text PRIMARY KEY,
  employee_id    text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type  text NOT NULL CHECK (document_type IN (
                   'personal_info','employment_contract','government_id',
                   'resume','application_form','job_offer','medical',
                   'training_certificate','performance_evaluation',
                   'payslip','leave_record','warning','nte','nod',
                   'clearance','resignation_letter','coe',
                   'final_pay_document','other')),
  document_title text NOT NULL,
  file_path      text,
  file_type      text,
  file_size      bigint,
  status         text NOT NULL DEFAULT 'uploaded' CHECK (status IN (
                   'pending_upload','uploaded','for_review','approved',
                   'rejected','expired','archived')),
  visibility     text NOT NULL DEFAULT 'hr_only' CHECK (visibility IN (
                   'hr_only','manager','employee','payroll','admin_only')),
  expiry_date    date,
  remarks        text,
  uploaded_by    text,
  reviewed_by    text,
  reviewed_at    timestamptz,
  case_id        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_201docs_employee ON public.employee_201_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_201docs_emp_type ON public.employee_201_documents(employee_id, document_type);

CREATE TABLE IF NOT EXISTS public.disciplinary_cases (
  id                text PRIMARY KEY,
  case_number       text NOT NULL UNIQUE,
  employee_id       text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  violation_type    text NOT NULL,
  policy_reference  text,
  incident_date     timestamptz NOT NULL,
  incident_location text,
  description       text NOT NULL,
  evidence_urls     jsonb NOT NULL DEFAULT '[]'::jsonb,
  status            text NOT NULL DEFAULT 'open' CHECK (status IN (
                      'open','nte_issued','nte_acknowledged','explanation_submitted',
                      'no_response','under_review','nod_issued','nod_acknowledged',
                      'sanction_active','closed')),
  assigned_hr       text,
  created_by        text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disc_cases_employee ON public.disciplinary_cases(employee_id);
CREATE INDEX IF NOT EXISTS idx_disc_cases_status   ON public.disciplinary_cases(status);

CREATE TABLE IF NOT EXISTS public.nte_records (
  id                       text PRIMARY KEY,
  case_id                  text NOT NULL UNIQUE REFERENCES public.disciplinary_cases(id) ON DELETE CASCADE,
  employee_id              text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  response_deadline        date NOT NULL,
  document_id              text,
  issued_by                text NOT NULL,
  issued_at                timestamptz NOT NULL DEFAULT now(),
  acknowledged_at          timestamptz,
  employee_explanation     text,
  explanation_submitted_at timestamptz,
  status                   text NOT NULL DEFAULT 'issued' CHECK (status IN (
                             'draft','issued','acknowledged','explanation_submitted',
                             'no_response','under_review','closed','moved_to_nod')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nod_records (
  id                  text PRIMARY KEY,
  case_id             text NOT NULL UNIQUE REFERENCES public.disciplinary_cases(id) ON DELETE CASCADE,
  employee_id         text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  decision            text NOT NULL CHECK (decision IN (
                        'no_violation','verbal_warning','written_warning',
                        'final_warning','suspension','termination',
                        'salary_deduction','training_required','pip')),
  sanction_start_date date,
  sanction_end_date   date,
  return_to_work_date date,
  decision_details    text NOT NULL,
  document_id         text,
  issued_by           text NOT NULL,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  acknowledged_at     timestamptz,
  status              text NOT NULL DEFAULT 'issued' CHECK (status IN (
                        'draft','issued','acknowledged','sanction_active','completed','closed')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_201_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_cases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nte_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nod_records            ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('employee-documents','employee-documents',false,26214400,
  ARRAY['application/pdf','image/jpeg','image/png',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'])
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 058: Jobs / Talent Acquisition
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_postings (
  id               text PRIMARY KEY,
  title            text NOT NULL,
  department       text NOT NULL,
  location         text NOT NULL,
  type             text NOT NULL CHECK (type IN ('full_time','part_time','contract','internship','freelance')),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','on_hold','closed')),
  priority         text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  headcount        integer NOT NULL DEFAULT 1 CHECK (headcount >= 1),
  salary_min       numeric(12,2),
  salary_max       numeric(12,2),
  description      text NOT NULL DEFAULT '',
  requirements     text NOT NULL DEFAULT '',
  responsibilities text NOT NULL DEFAULT '',
  deadline         date,
  created_by       text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_salary_range_check CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);
CREATE INDEX IF NOT EXISTS idx_job_postings_status     ON public.job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_department ON public.job_postings(department);

CREATE TABLE IF NOT EXISTS public.job_applications (
  id                   text PRIMARY KEY,
  job_id               text NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  applicant_name       text NOT NULL,
  applicant_email      text NOT NULL,
  applicant_phone      text,
  resume_url           text,
  cover_letter         text,
  source               text NOT NULL DEFAULT 'Other',
  status               text NOT NULL DEFAULT 'applied' CHECK (status IN (
                         'applied','screening','interview','offer','hired','rejected','withdrawn')),
  interview_date       timestamptz,
  offer_salary         numeric(12,2),
  notes                text,
  reviewed_by          text,
  reviewed_at          timestamptz,
  resume_storage_path  text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_apps_job_id ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_apps_status ON public.job_applications(status);

ALTER TABLE public.job_postings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs hr full" ON public.job_postings;
CREATE POLICY "jobs hr full" ON public.job_postings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email')) AND e.role IN ('admin','hr')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email')) AND e.role IN ('admin','hr')));

DROP POLICY IF EXISTS "jobs employee read open" ON public.job_postings;
CREATE POLICY "jobs employee read open" ON public.job_postings FOR SELECT TO authenticated
  USING (status = 'open' AND EXISTS (SELECT 1 FROM public.employees e WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))));

DROP POLICY IF EXISTS "job apps hr full" ON public.job_applications;
CREATE POLICY "job apps hr full" ON public.job_applications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email')) AND e.role IN ('admin','hr')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email')) AND e.role IN ('admin','hr')));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-resumes','job-resumes',false,10485760,
  ARRAY['application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 059: Fix account role sync trigger
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role text;
BEGIN
  requested_role := lower(coalesce(
    nullif(NEW.raw_user_meta_data->>'role', ''),
    nullif(NEW.raw_app_meta_data->>'role', ''),
    'employee'
  ));
  IF requested_role NOT IN ('admin','hr','finance','employee','supervisor','payroll_admin','auditor') THEN
    requested_role := 'employee';
  END IF;
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email, requested_role)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

UPDATE public.profiles p SET role = e.role
FROM public.employees e
WHERE e.profile_id = p.id
  AND e.role IN ('admin','hr','finance','employee','supervisor','payroll_admin','auditor')
  AND p.role IS DISTINCT FROM e.role;

-- ────────────────────────────────────────────────────────────
-- 060: Tasks schema updates (nullable group_id + start_date)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.tasks ALTER COLUMN group_id DROP NOT NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_date date;

-- ============================================================
-- Done. All missing migrations applied.
-- ============================================================
