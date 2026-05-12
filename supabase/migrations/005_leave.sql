-- ============================================================
-- 005_leave.sql
-- Leave policies, balances, requests
-- ============================================================

-- Leave Policies (per leave type — company-level config)
CREATE TABLE IF NOT EXISTS public.leave_policies (
    id                      text PRIMARY KEY,
    leave_type              text NOT NULL CHECK (leave_type IN ('SL','VL','EL','OTHER','ML','PL','SPL')),
    name                    text NOT NULL,
    accrual_frequency       text NOT NULL DEFAULT 'annual'
                            CHECK (accrual_frequency IN ('monthly','annual')),
    annual_entitlement      integer NOT NULL DEFAULT 0,
    carry_forward_allowed   boolean NOT NULL DEFAULT false,
    max_carry_forward       integer NOT NULL DEFAULT 0,
    max_balance             integer NOT NULL DEFAULT 0,
    expiry_months           integer NOT NULL DEFAULT 0,
    negative_leave_allowed  boolean NOT NULL DEFAULT false,
    attachment_required     boolean NOT NULL DEFAULT false,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_leave_policies_updated_at ON public.leave_policies;
CREATE TRIGGER set_leave_policies_updated_at
    BEFORE UPDATE ON public.leave_policies
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Leave Balances (per employee per leave type per year)
CREATE TABLE IF NOT EXISTS public.leave_balances (
    id              text PRIMARY KEY,
    employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    leave_type      text NOT NULL,
    year            integer NOT NULL,
    entitled        numeric NOT NULL DEFAULT 0,
    used            numeric NOT NULL DEFAULT 0,
    carried_forward numeric NOT NULL DEFAULT 0,
    remaining       numeric NOT NULL DEFAULT 0,
    last_accrued_at timestamptz,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (employee_id, leave_type, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_bal_employee ON public.leave_balances(employee_id);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_leave_balances_updated_at ON public.leave_balances;
CREATE TRIGGER set_leave_balances_updated_at
    BEFORE UPDATE ON public.leave_balances
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Leave Requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id              text PRIMARY KEY,
    employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    type            text NOT NULL,
    start_date      date NOT NULL,
    end_date        date NOT NULL,
    duration        text NOT NULL DEFAULT 'full_day'
                    CHECK (duration IN ('full_day','half_day_am','half_day_pm','hourly')),
    hours           numeric,
    reason          text NOT NULL DEFAULT '',
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
    reviewed_by     text,
    reviewed_at     timestamptz,
    attachment_url  text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_req_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_req_status ON public.leave_requests(status);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER set_leave_requests_updated_at
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
