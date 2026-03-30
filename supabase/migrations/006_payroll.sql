-- ============================================================
-- 006_payroll.sql
-- Payslips, payroll runs, adjustments, final pay, pay schedule
-- ============================================================

-- Pay Schedule Config (singleton-ish — one active row)
CREATE TABLE IF NOT EXISTS public.pay_schedule_config (
    id                          text PRIMARY KEY DEFAULT 'default',
    default_frequency           text NOT NULL DEFAULT 'semi_monthly'
                                CHECK (default_frequency IN ('monthly','semi_monthly','bi_weekly','weekly')),
    semi_monthly_first_cutoff   integer NOT NULL DEFAULT 15,
    semi_monthly_first_pay_day  integer NOT NULL DEFAULT 20,
    semi_monthly_second_pay_day integer NOT NULL DEFAULT 5,
    monthly_pay_day             integer NOT NULL DEFAULT 30,
    bi_weekly_start_date        date,
    weekly_pay_day              integer NOT NULL DEFAULT 5,
    deduct_gov_from             text NOT NULL DEFAULT 'second'
                                CHECK (deduct_gov_from IN ('first','second','both')),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pay_schedule_config ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_pay_schedule_config_updated_at ON public.pay_schedule_config;
CREATE TRIGGER set_pay_schedule_config_updated_at
    BEFORE UPDATE ON public.pay_schedule_config
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Payroll Runs
CREATE TABLE IF NOT EXISTS public.payroll_runs (
    id                text PRIMARY KEY,
    period_label      text NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','validated','locked','published','paid')),
    locked            boolean NOT NULL DEFAULT false,
    locked_at         timestamptz,
    published_at      timestamptz,
    paid_at           timestamptz,
    payslip_ids       text[] NOT NULL DEFAULT '{}',
    policy_snapshot   jsonb,
    run_type          text DEFAULT 'regular'
                      CHECK (run_type IN ('regular','adjustment','13th_month','final_pay'))
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON public.payroll_runs(status);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

-- Payslips
CREATE TABLE IF NOT EXISTS public.payslips (
    id                      text PRIMARY KEY,
    employee_id             text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    period_start            date NOT NULL,
    period_end              date NOT NULL,
    pay_frequency           text CHECK (pay_frequency IN ('monthly','semi_monthly','bi_weekly','weekly')),
    gross_pay               numeric NOT NULL DEFAULT 0,
    allowances              numeric NOT NULL DEFAULT 0,
    sss_deduction           numeric NOT NULL DEFAULT 0,
    philhealth_deduction    numeric NOT NULL DEFAULT 0,
    pagibig_deduction       numeric NOT NULL DEFAULT 0,
    tax_deduction           numeric NOT NULL DEFAULT 0,
    other_deductions        numeric NOT NULL DEFAULT 0,
    loan_deduction          numeric NOT NULL DEFAULT 0,
    holiday_pay             numeric DEFAULT 0,
    net_pay                 numeric NOT NULL DEFAULT 0,
    issued_at               date NOT NULL,
    status                  text NOT NULL DEFAULT 'issued'
                            CHECK (status IN ('issued','confirmed','published','paid','acknowledged')),
    confirmed_at            timestamptz,
    published_at            timestamptz,
    paid_at                 timestamptz,
    payment_method          text,
    bank_reference_id       text,
    payroll_batch_id        text,
    pdf_hash                text,
    notes                   text,
    signed_at               timestamptz,
    signature_data_url      text,
    ack_text_version        text,
    adjustment_ref          text,
    acknowledged_at         timestamptz,
    acknowledged_by         text,
    paid_confirmed_by       text,
    paid_confirmed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payslips_employee ON public.payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_status ON public.payslips(status);
CREATE INDEX IF NOT EXISTS idx_payslips_period ON public.payslips(period_start, period_end);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- Payroll Adjustments
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
    id                  text PRIMARY KEY,
    payroll_run_id      text NOT NULL,
    employee_id         text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    adjustment_type     text NOT NULL CHECK (adjustment_type IN ('earnings','deduction','net_correction','statutory_correction')),
    reference_payslip_id text NOT NULL,
    amount              numeric NOT NULL,
    reason              text NOT NULL,
    created_by          text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    approved_by         text,
    approved_at         timestamptz,
    applied_run_id      text,
    status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','applied','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_adj_employee ON public.payroll_adjustments(employee_id);
CREATE INDEX IF NOT EXISTS idx_adj_run ON public.payroll_adjustments(payroll_run_id);

ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

-- Final Pay Computations
CREATE TABLE IF NOT EXISTS public.final_pay_computations (
    id                      text PRIMARY KEY,
    employee_id             text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    resigned_at             date NOT NULL,
    pro_rated_salary        numeric NOT NULL DEFAULT 0,
    unpaid_ot               numeric NOT NULL DEFAULT 0,
    leave_payout            numeric NOT NULL DEFAULT 0,
    remaining_loan_balance  numeric NOT NULL DEFAULT 0,
    gross_final_pay         numeric NOT NULL DEFAULT 0,
    deductions              numeric NOT NULL DEFAULT 0,
    net_final_pay           numeric NOT NULL DEFAULT 0,
    status                  text NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','validated','locked','published','paid')),
    created_at              timestamptz NOT NULL DEFAULT now(),
    payslip_id              text
);

CREATE INDEX IF NOT EXISTS idx_final_pay_employee ON public.final_pay_computations(employee_id);

ALTER TABLE public.final_pay_computations ENABLE ROW LEVEL SECURITY;
