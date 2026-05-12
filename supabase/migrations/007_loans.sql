-- ============================================================
-- 007_loans.sql
-- Loans, deductions, repayment schedule, balance history
-- ============================================================

-- Loans
CREATE TABLE IF NOT EXISTS public.loans (
    id                      text PRIMARY KEY,
    employee_id             text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    type                    text NOT NULL DEFAULT 'cash_advance',
    amount                  numeric NOT NULL,
    remaining_balance       numeric NOT NULL,
    monthly_deduction       numeric NOT NULL,
    deduction_cap_percent   numeric NOT NULL DEFAULT 30,
    status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','settled','frozen','cancelled')),
    approved_by             text NOT NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    remarks                 text,
    last_deducted_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_loans_employee ON public.loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- Loan Deductions (history of each payslip deduction)
CREATE TABLE IF NOT EXISTS public.loan_deductions (
    id              text PRIMARY KEY,
    loan_id         text NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    payslip_id      text NOT NULL,
    amount          numeric NOT NULL,
    deducted_at     timestamptz NOT NULL DEFAULT now(),
    remaining_after numeric NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loan_ded_loan ON public.loan_deductions(loan_id);

ALTER TABLE public.loan_deductions ENABLE ROW LEVEL SECURITY;

-- Loan Repayment Schedule
CREATE TABLE IF NOT EXISTS public.loan_repayment_schedule (
    id              text PRIMARY KEY,
    loan_id         text NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    due_date        date NOT NULL,
    amount          numeric NOT NULL,
    paid            boolean NOT NULL DEFAULT false,
    payslip_id      text,
    skipped_reason  text
);

CREATE INDEX IF NOT EXISTS idx_loan_sched_loan ON public.loan_repayment_schedule(loan_id);

ALTER TABLE public.loan_repayment_schedule ENABLE ROW LEVEL SECURITY;

-- Loan Balance History (immutable trail of balance changes)
CREATE TABLE IF NOT EXISTS public.loan_balance_history (
    id                  text PRIMARY KEY,
    loan_id             text NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    date                date NOT NULL,
    previous_balance    numeric NOT NULL,
    deduction_amount    numeric NOT NULL,
    new_balance         numeric NOT NULL,
    payslip_id          text,
    notes               text
);

CREATE INDEX IF NOT EXISTS idx_loan_bh_loan ON public.loan_balance_history(loan_id);

ALTER TABLE public.loan_balance_history ENABLE ROW LEVEL SECURITY;
