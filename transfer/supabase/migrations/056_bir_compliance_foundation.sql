-- =====================================================
-- Migration 056: BIR Compliance Engine Foundation
-- =====================================================
-- Adds the database foundation for the NexHRMS BIR Compliance Engine
-- per bir_alphalist.md plan:
--
--   1. Adds BIR-specific columns to employees & payslips
--   2. Creates 5 new tables:
--      - employee_tax_profiles
--      - annual_tax_summaries
--      - previous_employer_records
--      - form_2316_records
--      - alphalist_exports
--   3. Adds RLS policies (employees see own; payroll/finance/admin manage all)
--
-- Style: 100% additive, idempotent (IF NOT EXISTS), reversible-safe.
-- =====================================================

BEGIN;

-- ──────────────────────────────────────────────────────
-- STEP 0: Pre-flight
-- ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees') THEN
    RAISE EXCEPTION '[056] ABORTED: public.employees missing. Run migration 002 first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='payslips') THEN
    RAISE EXCEPTION '[056] ABORTED: public.payslips missing. Run migration 006 first.';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────
-- STEP 1: Extend employees table with BIR fields
-- ──────────────────────────────────────────────────────
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS tin                       text,
  ADD COLUMN IF NOT EXISTS employment_classification text NOT NULL DEFAULT 'R'
    CHECK (employment_classification IN ('R','C','CP','S','P','AL')),
  ADD COLUMN IF NOT EXISTS is_mwe                    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mwe_daily_rate            numeric CHECK (mwe_daily_rate IS NULL OR mwe_daily_rate >= 0),
  ADD COLUMN IF NOT EXISTS substituted_filing        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_status                text NOT NULL DEFAULT 'S'
    CHECK (tax_status IN ('S','M','ME','MX')),
  ADD COLUMN IF NOT EXISTS tax_residency             text NOT NULL DEFAULT 'resident'
    CHECK (tax_residency IN ('resident','non_resident')),
  ADD COLUMN IF NOT EXISTS separation_date           date,
  ADD COLUMN IF NOT EXISTS separation_type           text
    CHECK (separation_type IS NULL OR separation_type IN ('resigned','terminated','end_of_contract'));

-- Unique TIN (only when set)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_tin_unique
  ON public.employees(tin) WHERE tin IS NOT NULL;

COMMENT ON COLUMN public.employees.tin                       IS 'BIR Taxpayer Identification Number (12 digits NNN-NNN-NNN-NNN)';
COMMENT ON COLUMN public.employees.employment_classification IS 'BIR classification: R=Regular, C=Casual, CP=Contractual/Project, S=Seasonal, P=Probationary, AL=Apprentices/Learners';
COMMENT ON COLUMN public.employees.is_mwe                    IS 'Minimum Wage Earner flag — exempts basic, OT, holiday, night-diff, hazard pay from withholding';
COMMENT ON COLUMN public.employees.mwe_daily_rate            IS 'Region-specific MWE daily rate (used to validate MWE classification)';
COMMENT ON COLUMN public.employees.substituted_filing        IS 'True when employer files BIR return on employee behalf (Form 2316 in lieu of 1700)';
COMMENT ON COLUMN public.employees.tax_status                IS 'BIR tax status: S=Single, M=Married, ME=Married w/ Employed Spouse, MX=Married w/ Multiple Exemptions';
COMMENT ON COLUMN public.employees.tax_residency             IS 'Tax residency: resident or non_resident alien';

-- ──────────────────────────────────────────────────────
-- STEP 2: Extend payslips table with BIR category breakdown
-- ──────────────────────────────────────────────────────
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS tax_categories            jsonb,
  ADD COLUMN IF NOT EXISTS taxable_compensation      numeric NOT NULL DEFAULT 0 CHECK (taxable_compensation     >= 0),
  ADD COLUMN IF NOT EXISTS non_taxable_compensation  numeric NOT NULL DEFAULT 0 CHECK (non_taxable_compensation >= 0);

COMMENT ON COLUMN public.payslips.tax_categories           IS 'BIR earnings breakdown (TaxCategoryBreakdown JSON)';
COMMENT ON COLUMN public.payslips.taxable_compensation     IS 'Total taxable compensation in this payslip period';
COMMENT ON COLUMN public.payslips.non_taxable_compensation IS 'Total non-taxable compensation (de minimis + MWE exempt + government contributions + 13th month within ceiling)';

-- ──────────────────────────────────────────────────────
-- STEP 3: employee_tax_profiles
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_tax_profiles (
  id                        text NOT NULL DEFAULT ('ETP-' || gen_random_uuid()::text),
  employee_id               text NOT NULL,
  tin                       text,
  employment_classification text NOT NULL DEFAULT 'R'
    CHECK (employment_classification IN ('R','C','CP','S','P','AL')),
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
CREATE INDEX IF NOT EXISTS idx_etp_tin      ON public.employee_tax_profiles(tin) WHERE tin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_etp_mwe      ON public.employee_tax_profiles(is_mwe) WHERE is_mwe = true;

-- ──────────────────────────────────────────────────────
-- STEP 4: annual_tax_summaries
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.annual_tax_summaries (
  id                       text NOT NULL DEFAULT ('ATS-' || gen_random_uuid()::text),
  employee_id              text NOT NULL,
  year                     integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  total_taxable_comp       numeric NOT NULL DEFAULT 0 CHECK (total_taxable_comp >= 0),
  total_non_taxable_comp   numeric NOT NULL DEFAULT 0 CHECK (total_non_taxable_comp >= 0),
  total_de_minimis         numeric NOT NULL DEFAULT 0 CHECK (total_de_minimis >= 0),
  total_sss                numeric NOT NULL DEFAULT 0 CHECK (total_sss >= 0),
  total_philhealth         numeric NOT NULL DEFAULT 0 CHECK (total_philhealth >= 0),
  total_pagibig            numeric NOT NULL DEFAULT 0 CHECK (total_pagibig >= 0),
  total_13th_non_taxable   numeric NOT NULL DEFAULT 0 CHECK (total_13th_non_taxable >= 0),
  total_13th_taxable       numeric NOT NULL DEFAULT 0 CHECK (total_13th_taxable >= 0),
  total_other_benefits     numeric NOT NULL DEFAULT 0 CHECK (total_other_benefits >= 0),
  total_tax_withheld       numeric NOT NULL DEFAULT 0 CHECK (total_tax_withheld >= 0),
  prev_employer_income     numeric NOT NULL DEFAULT 0 CHECK (prev_employer_income >= 0),
  prev_employer_tax        numeric NOT NULL DEFAULT 0 CHECK (prev_employer_tax >= 0),
  annual_tax_due           numeric CHECK (annual_tax_due IS NULL OR annual_tax_due >= 0),
  adjustment_type          text CHECK (adjustment_type IS NULL OR adjustment_type IN ('over_withheld','under_withheld','balanced')),
  adjustment_amount        numeric,
  status                   text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reconciled','finalized','exported')),
  finalized_at             timestamptz,
  finalized_by             text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT annual_tax_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT annual_tax_summaries_employee_year_unique UNIQUE (employee_id, year),
  CONSTRAINT annual_tax_summaries_employee_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ats_employee_year ON public.annual_tax_summaries(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_ats_year_status   ON public.annual_tax_summaries(year, status);

-- ──────────────────────────────────────────────────────
-- STEP 5: previous_employer_records
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.previous_employer_records (
  id                  text NOT NULL DEFAULT ('PER-' || gen_random_uuid()::text),
  employee_id         text NOT NULL,
  year                integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  employer_name       text NOT NULL,
  employer_tin        text,
  employer_address    text,
  total_income        numeric NOT NULL DEFAULT 0 CHECK (total_income >= 0),
  total_tax_withheld  numeric NOT NULL DEFAULT 0 CHECK (total_tax_withheld >= 0),
  reference_2316      text,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  submitted_by        text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT previous_employer_records_pkey PRIMARY KEY (id),
  CONSTRAINT previous_employer_records_employee_year_unique UNIQUE (employee_id, year),
  CONSTRAINT previous_employer_records_employee_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_per_employee_year ON public.previous_employer_records(employee_id, year);

-- ──────────────────────────────────────────────────────
-- STEP 6: form_2316_records
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.form_2316_records (
  id                       text NOT NULL DEFAULT ('F2316-' || gen_random_uuid()::text),
  employee_id              text NOT NULL,
  year                     integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  annual_summary_id        text,
  generated_at             timestamptz NOT NULL DEFAULT now(),
  generated_by             text,
  employer_signed_at       timestamptz,
  employer_signed_by       text,
  employer_signature_url   text,
  employee_signed_at       timestamptz,
  employee_signature_url   text,
  pdf_url                  text,
  document_hash            text,
  status                   text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','for_signature','released','downloaded','revoked')),
  released_at              timestamptz,
  downloaded_at            timestamptz,
  downloaded_by            text,
  revoked_at               timestamptz,
  revoked_by               text,
  revoke_reason            text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT form_2316_records_pkey PRIMARY KEY (id),
  CONSTRAINT form_2316_records_employee_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE,
  CONSTRAINT form_2316_records_summary_fkey  FOREIGN KEY (annual_summary_id) REFERENCES public.annual_tax_summaries(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_f2316_employee_year ON public.form_2316_records(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_f2316_status        ON public.form_2316_records(status);

-- ──────────────────────────────────────────────────────
-- STEP 7: alphalist_exports
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alphalist_exports (
  id                  text NOT NULL DEFAULT ('ALX-' || gen_random_uuid()::text),
  year                integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  schedule_type       text NOT NULL CHECK (schedule_type IN ('schedule_1','schedule_2','both')),
  generated_at        timestamptz NOT NULL DEFAULT now(),
  generated_by        text,
  employee_count      integer NOT NULL DEFAULT 0 CHECK (employee_count >= 0),
  total_taxable_comp  numeric NOT NULL DEFAULT 0 CHECK (total_taxable_comp >= 0),
  total_tax_withheld  numeric NOT NULL DEFAULT 0 CHECK (total_tax_withheld >= 0),
  validation_status   text NOT NULL DEFAULT 'passed'
    CHECK (validation_status IN ('passed','has_warnings','has_errors')),
  validation_errors   jsonb,
  export_format       text NOT NULL CHECK (export_format IN ('csv','xlsx','dat')),
  file_url            text,
  efps_status         text NOT NULL DEFAULT 'draft'
    CHECK (efps_status IN ('draft','validated','ready','submitted','payment_pending','paid','completed')),
  submitted_at        timestamptz,
  submitted_by        text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alphalist_exports_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_alx_year_schedule ON public.alphalist_exports(year, schedule_type);
CREATE INDEX IF NOT EXISTS idx_alx_efps_status   ON public.alphalist_exports(efps_status);

-- ──────────────────────────────────────────────────────
-- STEP 8: Row-Level Security
-- ──────────────────────────────────────────────────────
ALTER TABLE public.employee_tax_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_tax_summaries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previous_employer_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_2316_records        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alphalist_exports        ENABLE ROW LEVEL SECURITY;

-- Helper macro: payroll/finance/admin role check
-- (inlined for clarity since CREATE POLICY can't reference a function from this DDL safely in all environments)

-- employee_tax_profiles
DROP POLICY IF EXISTS etp_employee_read_own  ON public.employee_tax_profiles;
DROP POLICY IF EXISTS etp_admin_manage_all   ON public.employee_tax_profiles;
CREATE POLICY etp_employee_read_own ON public.employee_tax_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_tax_profiles.employee_id AND e.profile_id = auth.uid())
  );
CREATE POLICY etp_admin_manage_all ON public.employee_tax_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
              AND e.role IN ('admin','hr','finance','payroll_admin'))
  );

-- annual_tax_summaries
DROP POLICY IF EXISTS ats_employee_read_own ON public.annual_tax_summaries;
DROP POLICY IF EXISTS ats_admin_manage_all  ON public.annual_tax_summaries;
CREATE POLICY ats_employee_read_own ON public.annual_tax_summaries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = annual_tax_summaries.employee_id AND e.profile_id = auth.uid())
  );
CREATE POLICY ats_admin_manage_all ON public.annual_tax_summaries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
              AND e.role IN ('admin','finance','payroll_admin'))
  );

-- previous_employer_records
DROP POLICY IF EXISTS per_employee_read_own ON public.previous_employer_records;
DROP POLICY IF EXISTS per_admin_manage_all  ON public.previous_employer_records;
CREATE POLICY per_employee_read_own ON public.previous_employer_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = previous_employer_records.employee_id AND e.profile_id = auth.uid())
  );
CREATE POLICY per_admin_manage_all ON public.previous_employer_records
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
              AND e.role IN ('admin','hr','finance','payroll_admin'))
  );

-- form_2316_records
DROP POLICY IF EXISTS f2316_employee_read_own ON public.form_2316_records;
DROP POLICY IF EXISTS f2316_admin_manage_all  ON public.form_2316_records;
CREATE POLICY f2316_employee_read_own ON public.form_2316_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = form_2316_records.employee_id AND e.profile_id = auth.uid())
      AND status IN ('released','downloaded')
  );
CREATE POLICY f2316_admin_manage_all ON public.form_2316_records
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
              AND e.role IN ('admin','finance','payroll_admin'))
  );

-- alphalist_exports — admin only
DROP POLICY IF EXISTS alx_admin_manage_all ON public.alphalist_exports;
CREATE POLICY alx_admin_manage_all ON public.alphalist_exports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
              AND e.role IN ('admin','finance','payroll_admin'))
  );

COMMIT;

-- =====================================================
-- Migration 056 — done
-- =====================================================
