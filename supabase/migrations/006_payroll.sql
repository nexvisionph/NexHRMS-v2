-- ============================================================
-- 006: Payroll system (depends on employees)
-- ============================================================

-- Payroll runs
CREATE TABLE public.payroll_runs (
  id text NOT NULL,
  period_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft','locked','completed'])),
  locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  published_at timestamptz,
  paid_at timestamptz,
  payslip_ids text[] NOT NULL DEFAULT '{}',
  policy_snapshot jsonb,
  run_type text DEFAULT 'regular'
    CHECK (run_type = ANY (ARRAY['regular','adjustment','13th_month','final_pay'])),
  completed_at timestamptz,
  CONSTRAINT payroll_runs_pkey PRIMARY KEY (id)
);

-- Payslips
CREATE TABLE public.payslips (
  id text NOT NULL,
  employee_id text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  pay_frequency text
    CHECK (pay_frequency = ANY (ARRAY['monthly','semi_monthly','bi_weekly','weekly'])),
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
  status text NOT NULL DEFAULT 'issued'
    CHECK (status = ANY (ARRAY['draft','published','signed'])),
  confirmed_at timestamptz,
  published_at timestamptz,
  paid_at timestamptz,
  payment_method text,
  bank_reference_id text,
  payroll_batch_id text,
  pdf_hash text,
  notes text,
  signed_at timestamptz,
  signature_data_url text,
  ack_text_version text,
  adjustment_ref text,
  acknowledged_at timestamptz,
  acknowledged_by text,
  paid_confirmed_by text,
  paid_confirmed_at timestamptz,
  custom_deductions numeric NOT NULL DEFAULT 0,
  line_items_json jsonb,
  CONSTRAINT payslips_pkey PRIMARY KEY (id),
  CONSTRAINT payslips_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Payroll run ↔ payslips junction
CREATE TABLE public.payroll_run_payslips (
  run_id text NOT NULL,
  payslip_id text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payroll_run_payslips_pkey PRIMARY KEY (run_id, payslip_id),
  CONSTRAINT payroll_run_payslips_payslip_id_fkey FOREIGN KEY (payslip_id) REFERENCES public.payslips(id),
  CONSTRAINT payroll_run_payslips_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.payroll_runs(id)
);

-- Payslip line items
CREATE TABLE public.payslip_line_items (
  id text NOT NULL DEFAULT ('PLI-' || gen_random_uuid()::text),
  payslip_id text NOT NULL,
  label text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['earning','deduction','government','loan'])),
  amount numeric NOT NULL,
  template_id text,
  calculation_detail text,
  CONSTRAINT payslip_line_items_pkey PRIMARY KEY (id),
  CONSTRAINT pli_payslip_fk FOREIGN KEY (payslip_id) REFERENCES public.payslips(id),
  CONSTRAINT pli_template_fk FOREIGN KEY (template_id) REFERENCES public.deduction_templates(id)
);

-- Payroll adjustments
CREATE TABLE public.payroll_adjustments (
  id text NOT NULL,
  payroll_run_id text NOT NULL,
  employee_id text NOT NULL,
  adjustment_type text NOT NULL
    CHECK (adjustment_type = ANY (ARRAY['earnings','deduction','net_correction','statutory_correction'])),
  reference_payslip_id text NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  applied_run_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending','approved','applied','rejected'])),
  CONSTRAINT payroll_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT payroll_adjustments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_pa_payslip FOREIGN KEY (reference_payslip_id) REFERENCES public.payslips(id),
  CONSTRAINT fk_pa_run FOREIGN KEY (payroll_run_id) REFERENCES public.payroll_runs(id)
);

-- Salary history
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

-- Salary change requests
CREATE TABLE public.salary_change_requests (
  id text NOT NULL,
  employee_id text NOT NULL,
  old_salary numeric NOT NULL,
  proposed_salary numeric NOT NULL,
  effective_date date NOT NULL,
  reason text NOT NULL,
  proposed_by text NOT NULL,
  proposed_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending','approved','rejected'])),
  reviewed_by text,
  reviewed_at timestamptz,
  CONSTRAINT salary_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT salary_change_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Final pay computations
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
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft','validated','locked','published','paid'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  payslip_id text,
  CONSTRAINT final_pay_computations_pkey PRIMARY KEY (id),
  CONSTRAINT final_pay_computations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_fpc_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
);

-- Deduction overrides (per-employee)
CREATE TABLE public.deduction_overrides (
  id text NOT NULL DEFAULT ('DO-' || gen_random_uuid()::text),
  employee_id text NOT NULL,
  deduction_type text NOT NULL
    CHECK (deduction_type = ANY (ARRAY['sss','philhealth','pagibig','bir'])),
  mode text NOT NULL DEFAULT 'auto'
    CHECK (mode = ANY (ARRAY['auto','exempt','percentage','fixed'])),
  percentage numeric CHECK (percentage >= 0 AND percentage <= 100),
  fixed_amount numeric CHECK (fixed_amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT deduction_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT deduction_overrides_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Employee deduction assignments
CREATE TABLE public.employee_deduction_assignments (
  id text NOT NULL DEFAULT ('EDA-' || gen_random_uuid()::text),
  employee_id text NOT NULL,
  template_id text NOT NULL,
  override_value numeric,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  is_active boolean NOT NULL DEFAULT true,
  assigned_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_deduction_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT eda_template_fk FOREIGN KEY (template_id) REFERENCES public.deduction_templates(id),
  CONSTRAINT eda_employee_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
