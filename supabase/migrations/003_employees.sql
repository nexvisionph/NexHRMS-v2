-- ============================================================
-- 003: Employees (depends on profiles, shift_templates)
-- ============================================================

CREATE TABLE public.employees (
  id text NOT NULL,
  profile_id uuid UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'Employee'
    CHECK (role = ANY (ARRAY['admin','hr','finance','employee','supervisor','payroll_admin','auditor'])),
  department text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active','inactive','resigned'])),
  work_type text NOT NULL DEFAULT 'WFO'
    CHECK (work_type = ANY (ARRAY['WFH','WFO','HYBRID','ONSITE'])),
  salary numeric NOT NULL DEFAULT 0,
  join_date date NOT NULL DEFAULT CURRENT_DATE,
  productivity integer NOT NULL DEFAULT 0,
  location text NOT NULL DEFAULT '',
  phone text,
  birthday date,
  team_leader text,
  avatar_url text,
  pin text,
  nfc_id text,
  resigned_at timestamptz,
  shift_id text,
  pay_frequency text
    CHECK (pay_frequency IS NULL OR pay_frequency = ANY (ARRAY['monthly','semi_monthly','bi_weekly','weekly'])),
  work_days text[],
  whatsapp_number text,
  preferred_channel text
    CHECK (preferred_channel IS NULL OR preferred_channel = ANY (ARRAY['email','whatsapp','sms','in_app'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  emergency_contact text,
  address text,
  job_title text,
  deduction_exempt boolean NOT NULL DEFAULT false,
  deduction_exempt_reason text,
  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT employees_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT fk_emp_shift FOREIGN KEY (shift_id) REFERENCES public.shift_templates(id)
);
