-- ═══════════════════════════════════════════════════════════════
-- Migration 036: Government Deduction Overrides (Philippine Standard)
-- 
-- Stores per-employee override settings for SSS, PhilHealth,
-- Pag-IBIG, and BIR withholding tax. Supports: auto (standard PH
-- calculation), exempt (₱0), percentage (% of gross), or fixed (₱).
-- ═══════════════════════════════════════════════════════════════

-- Per-employee, per-deduction-type overrides
CREATE TABLE IF NOT EXISTS public.deduction_overrides (
    id text NOT NULL DEFAULT ('DO-' || gen_random_uuid()::text),
    employee_id text NOT NULL,
    deduction_type text NOT NULL CHECK (deduction_type IN ('sss', 'philhealth', 'pagibig', 'bir')),
    mode text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'exempt', 'percentage', 'fixed')),
    percentage numeric CHECK (percentage >= 0 AND percentage <= 100),
    fixed_amount numeric CHECK (fixed_amount >= 0),
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT deduction_overrides_pkey PRIMARY KEY (id),
    CONSTRAINT deduction_overrides_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
    CONSTRAINT deduction_overrides_unique UNIQUE (employee_id, deduction_type)
);

-- Global default overrides (company-wide; employee_id = 'global')
-- e.g., "All employees SSS at 4.5%" — per-employee overrides take precedence
CREATE TABLE IF NOT EXISTS public.deduction_global_defaults (
    id text NOT NULL DEFAULT ('DGD-' || gen_random_uuid()::text),
    deduction_type text NOT NULL CHECK (deduction_type IN ('sss', 'philhealth', 'pagibig', 'bir')),
    enabled boolean NOT NULL DEFAULT true,
    mode text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'exempt', 'percentage', 'fixed')),
    percentage numeric CHECK (percentage >= 0 AND percentage <= 100),
    fixed_amount numeric CHECK (fixed_amount >= 0),
    notes text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by text,
    CONSTRAINT deduction_global_defaults_pkey PRIMARY KEY (id),
    CONSTRAINT deduction_global_defaults_unique UNIQUE (deduction_type)
);

-- Seed global defaults (all auto by default)
INSERT INTO public.deduction_global_defaults (id, deduction_type, enabled, mode, notes)
VALUES
    ('DGD-SSS',   'sss',        true, 'auto', 'SSS 2026 table — RA 11199'),
    ('DGD-PH',    'philhealth', true, 'auto', 'PhilHealth 5% — RA 11223 UHC Act'),
    ('DGD-PI',    'pagibig',    true, 'auto', 'Pag-IBIG ₱100 cap — RA 9679'),
    ('DGD-BIR',   'bir',        true, 'auto', 'BIR TRAIN Law — RA 10963')
ON CONFLICT (deduction_type) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deduction_overrides_employee ON public.deduction_overrides(employee_id);
CREATE INDEX IF NOT EXISTS idx_deduction_overrides_type ON public.deduction_overrides(deduction_type);

-- RLS
ALTER TABLE public.deduction_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deduction_global_defaults ENABLE ROW LEVEL SECURITY;

-- Admin/HR/Finance/Payroll Admin can manage overrides
CREATE POLICY "admin_manage_deduction_overrides" ON public.deduction_overrides
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
            AND e.role IN ('admin', 'hr', 'finance', 'payroll_admin')
        )
    );

CREATE POLICY "admin_manage_deduction_global_defaults" ON public.deduction_global_defaults
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
            AND e.role IN ('admin', 'hr', 'finance', 'payroll_admin')
        )
    );

-- Employees can read their own overrides
CREATE POLICY "employee_read_own_overrides" ON public.deduction_overrides
    FOR SELECT
    USING (
        employee_id IN (
            SELECT id FROM public.employees WHERE profile_id = auth.uid()
        )
    );
