-- ============================================================
-- 005: Leave system (depends on employees)
-- ============================================================

-- Leave requests
CREATE TABLE public.leave_requests (
  id text NOT NULL,
  employee_id text NOT NULL,
  type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending','approved','rejected'])),
  reviewed_by text,
  reviewed_at timestamptz,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  duration text NOT NULL DEFAULT 'full_day'
    CHECK (duration = ANY (ARRAY['full_day','half_day_am','half_day_pm','hourly'])),
  hours numeric,
  CONSTRAINT leave_requests_pkey PRIMARY KEY (id),
  CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Leave balances
CREATE TABLE public.leave_balances (
  id text NOT NULL,
  employee_id text NOT NULL,
  leave_type text NOT NULL,
  year integer NOT NULL,
  entitled numeric NOT NULL DEFAULT 0,
  used numeric NOT NULL DEFAULT 0,
  carried_forward numeric NOT NULL DEFAULT 0,
  remaining numeric NOT NULL DEFAULT 0,
  last_accrued_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leave_balances_pkey PRIMARY KEY (id),
  CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
