-- ============================================================
-- 007: Loans (depends on employees, payslips)
-- ============================================================

CREATE TABLE public.loans (
  id text NOT NULL,
  employee_id text NOT NULL,
  type text NOT NULL DEFAULT 'cash_advance'
    CHECK (type = ANY (ARRAY['cash_advance','salary_loan','sss','pagibig','other'])),
  amount numeric NOT NULL,
  remaining_balance numeric NOT NULL,
  monthly_deduction numeric NOT NULL,
  deduction_cap_percent numeric NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active','settled','frozen','cancelled'])),
  approved_by text NOT NULL,
  created_at date NOT NULL DEFAULT CURRENT_DATE,
  remarks text,
  last_deducted_at timestamptz,
  CONSTRAINT loans_pkey PRIMARY KEY (id),
  CONSTRAINT loans_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

CREATE TABLE public.loan_deductions (
  id text NOT NULL,
  loan_id text NOT NULL,
  payslip_id text NOT NULL,
  amount numeric NOT NULL,
  deducted_at timestamptz NOT NULL DEFAULT now(),
  remaining_after numeric NOT NULL,
  CONSTRAINT loan_deductions_pkey PRIMARY KEY (id),
  CONSTRAINT loan_deductions_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id),
  CONSTRAINT fk_ld_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
);

CREATE TABLE public.loan_balance_history (
  id text NOT NULL,
  loan_id text NOT NULL,
  date date NOT NULL,
  previous_balance numeric NOT NULL,
  deduction_amount numeric NOT NULL,
  new_balance numeric NOT NULL,
  payslip_id text,
  notes text,
  CONSTRAINT loan_balance_history_pkey PRIMARY KEY (id),
  CONSTRAINT loan_balance_history_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id),
  CONSTRAINT fk_lbh_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
);

CREATE TABLE public.loan_repayment_schedule (
  id text NOT NULL,
  loan_id text NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL,
  paid boolean NOT NULL DEFAULT false,
  payslip_id text,
  skipped_reason text,
  CONSTRAINT loan_repayment_schedule_pkey PRIMARY KEY (id),
  CONSTRAINT loan_repayment_schedule_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id),
  CONSTRAINT fk_lrs_payslip FOREIGN KEY (payslip_id) REFERENCES public.payslips(id)
);
