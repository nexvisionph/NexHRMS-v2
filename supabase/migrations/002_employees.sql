-- ============================================================
-- 002_employees.sql
-- Employees, salary history, change requests, documents
-- ============================================================

CREATE TABLE IF NOT EXISTS public.employees (
    id              text PRIMARY KEY,
    profile_id      uuid UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
    name            text NOT NULL,
    email           text NOT NULL,
    role            text NOT NULL DEFAULT 'Employee',
    department      text NOT NULL DEFAULT '',
    status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','resigned')),
    work_type       text NOT NULL DEFAULT 'WFO'
                    CHECK (work_type IN ('WFH','WFO','HYBRID','ONSITE')),
    salary          numeric NOT NULL DEFAULT 0,
    join_date       date NOT NULL DEFAULT CURRENT_DATE,
    productivity    integer NOT NULL DEFAULT 0,
    location        text NOT NULL DEFAULT '',
    phone           text,
    birthday        date,
    team_leader     text,
    avatar_url      text,
    pin             text,
    nfc_id          text,
    resigned_at     timestamptz,
    shift_id        text,
    pay_frequency   text CHECK (pay_frequency IN ('monthly','semi_monthly','bi_weekly','weekly') OR pay_frequency IS NULL),
    work_days       text[],
    whatsapp_number text,
    preferred_channel text CHECK (preferred_channel IN ('email','whatsapp','sms','in_app') OR preferred_channel IS NULL),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_profile_id ON public.employees(profile_id);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_employees_updated_at ON public.employees;
CREATE TRIGGER set_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Salary Change Requests (HR proposes, Finance approves)
CREATE TABLE IF NOT EXISTS public.salary_change_requests (
    id              text PRIMARY KEY,
    employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    old_salary      numeric NOT NULL,
    proposed_salary numeric NOT NULL,
    effective_date  date NOT NULL,
    reason          text NOT NULL,
    proposed_by     text NOT NULL,
    proposed_at     timestamptz NOT NULL DEFAULT now(),
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
    reviewed_by     text,
    reviewed_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_salary_requests_employee ON public.salary_change_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_requests_status ON public.salary_change_requests(status);

ALTER TABLE public.salary_change_requests ENABLE ROW LEVEL SECURITY;

-- Salary History (immutable audit trail)
CREATE TABLE IF NOT EXISTS public.salary_history (
    id              text PRIMARY KEY,
    employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    monthly_salary  numeric NOT NULL,
    effective_from  date NOT NULL,
    effective_to    date,
    approved_by     text NOT NULL,
    reason          text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_salary_history_employee ON public.salary_history(employee_id);

ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;

-- Employee Documents
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id          text PRIMARY KEY,
    employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    name        text NOT NULL,
    file_url    text,
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_employee_docs_employee ON public.employee_documents(employee_id);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
