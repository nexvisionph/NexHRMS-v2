-- ============================================================
-- 025: Performance Management Module
-- ============================================================

-- Ensure the shared company table exists when this migration is run standalone.
CREATE TABLE IF NOT EXISTS public.companies (
  id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);

ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_company_scope ON public.companies;
CREATE POLICY companies_company_scope ON public.companies
  FOR ALL
  USING (id = current_setting('jwt.claims.company_id', true))
  WITH CHECK (id = current_setting('jwt.claims.company_id', true));

DROP POLICY IF EXISTS companies_admin_bypass ON public.companies;
CREATE POLICY companies_admin_bypass ON public.companies
  FOR ALL
  USING (current_setting('jwt.claims.role', true) = 'admin')
  WITH CHECK (current_setting('jwt.claims.role', true) = 'admin');

-- Performance Cycles (Quarterly/Annual Review cycles)
CREATE TABLE public.performance_cycles (
  id text NOT NULL,
  company_id text NOT NULL,
  name text NOT NULL,
  description text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  review_start_date date NOT NULL,
  review_end_date date NOT NULL,
  rating_scale_min integer NOT NULL DEFAULT 1,
  rating_scale_max integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft','active','finalized','closed'])),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_cycles_pkey PRIMARY KEY (id),
  CONSTRAINT fk_pc_company FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT fk_pc_created_by FOREIGN KEY (created_by) REFERENCES public.employees(id)
);

-- Performance Evaluation Criteria
CREATE TABLE public.performance_criteria (
  id text NOT NULL,
  company_id text NOT NULL,
  cycle_id text NOT NULL,
  name text NOT NULL,
  description text,
  weight numeric NOT NULL DEFAULT 1.0,
  sequence integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_criteria_pkey PRIMARY KEY (id),
  CONSTRAINT fk_pcr_company FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT fk_pcr_cycle FOREIGN KEY (cycle_id) REFERENCES public.performance_cycles(id)
);

-- Salary Adjustment Bands (Auto-mapping from ratings)
CREATE TABLE public.performance_salary_bands (
  id text NOT NULL,
  company_id text NOT NULL,
  cycle_id text NOT NULL,
  band_name text NOT NULL,
  min_rating numeric NOT NULL,
  max_rating numeric NOT NULL,
  adjustment_percentage numeric NOT NULL,
  description text,
  sequence integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_salary_bands_pkey PRIMARY KEY (id),
  CONSTRAINT fk_psb_company FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT fk_psb_cycle FOREIGN KEY (cycle_id) REFERENCES public.performance_cycles(id)
);

-- Performance Reviews (Manager → Employee)
CREATE TABLE public.performance_reviews (
  id text NOT NULL,
  company_id text NOT NULL,
  cycle_id text NOT NULL,
  employee_id text NOT NULL,
  manager_id text NOT NULL,
  overall_rating numeric,
  manager_notes text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status = ANY (ARRAY['draft','submitted','acknowledged','finance_approved','finalized'])),
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by text,
  finance_approved_at timestamptz,
  finance_approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT fk_pr_company FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT fk_pr_cycle FOREIGN KEY (cycle_id) REFERENCES public.performance_cycles(id),
  CONSTRAINT fk_pr_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_pr_manager FOREIGN KEY (manager_id) REFERENCES public.employees(id)
);

-- Individual Criterion Ratings
CREATE TABLE public.performance_ratings (
  id text NOT NULL,
  review_id text NOT NULL,
  criterion_id text NOT NULL,
  score numeric NOT NULL,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT fk_pr_review FOREIGN KEY (review_id) REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  CONSTRAINT fk_pr_criterion FOREIGN KEY (criterion_id) REFERENCES public.performance_criteria(id)
);

-- Salary Adjustments (Finance approval queue)
CREATE TABLE public.performance_salary_adjustments (
  id text NOT NULL,
  company_id text NOT NULL,
  review_id text NOT NULL,
  employee_id text NOT NULL,
  recommended_band_id text NOT NULL,
  recommended_percentage numeric NOT NULL,
  recommended_amount numeric,
  finance_approved_amount numeric,
  finance_override_reason text,
  approved_by text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending','approved','rejected','applied','cancelled'])),
  applied_in_payroll_run_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  applied_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT performance_salary_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT fk_psa_company FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT fk_psa_review FOREIGN KEY (review_id) REFERENCES public.performance_reviews(id),
  CONSTRAINT fk_psa_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_psa_band FOREIGN KEY (recommended_band_id) REFERENCES public.performance_salary_bands(id),
  CONSTRAINT fk_psa_payroll_run FOREIGN KEY (applied_in_payroll_run_id) REFERENCES public.payroll_runs(id)
);

-- Performance Audit Logs (Immutable audit trail)
CREATE TABLE public.performance_audit_logs (
  id text NOT NULL,
  company_id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  old_status text,
  new_status text,
  changed_by text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  details jsonb,
  reason text,
  CONSTRAINT performance_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT fk_pal_company FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT fk_pal_changed_by FOREIGN KEY (changed_by) REFERENCES public.employees(id)
);

-- Indexes for performance queries
CREATE INDEX idx_performance_cycles_company ON public.performance_cycles(company_id);
CREATE INDEX idx_performance_cycles_status ON public.performance_cycles(status);
CREATE INDEX idx_performance_criteria_cycle ON public.performance_criteria(cycle_id);
CREATE INDEX idx_performance_reviews_cycle ON public.performance_reviews(cycle_id);
CREATE INDEX idx_performance_reviews_employee ON public.performance_reviews(employee_id);
CREATE INDEX idx_performance_reviews_manager ON public.performance_reviews(manager_id);
CREATE INDEX idx_performance_reviews_status ON public.performance_reviews(status);
CREATE INDEX idx_performance_salary_adjustments_employee ON public.performance_salary_adjustments(employee_id);
CREATE INDEX idx_performance_salary_adjustments_status ON public.performance_salary_adjustments(status);
CREATE INDEX idx_performance_audit_logs_entity ON public.performance_audit_logs(entity_type, entity_id);
CREATE INDEX idx_performance_audit_logs_timestamp ON public.performance_audit_logs(timestamp DESC);

-- RLS Policies
ALTER TABLE public.performance_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_salary_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_salary_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin/HR can manage cycles and criteria
CREATE POLICY pc_admin_all ON public.performance_cycles
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT id FROM public.employees WHERE company_id = public.performance_cycles.company_id AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY pcr_admin_all ON public.performance_criteria
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT id FROM public.employees WHERE company_id = public.performance_criteria.company_id AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY psb_admin_all ON public.performance_salary_bands
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT id FROM public.employees WHERE company_id = public.performance_salary_bands.company_id AND role IN ('admin', 'hr')
    )
  );

-- Managers can view reviews for their direct reports
CREATE POLICY pr_manager_view ON public.performance_reviews
  FOR SELECT USING (
    manager_id = auth.uid()::text OR
    auth.uid()::text IN (
      SELECT id FROM public.employees WHERE company_id = public.performance_reviews.company_id AND role IN ('admin', 'hr', 'finance')
    )
  );

-- Employees can view their own reviews
CREATE POLICY pr_employee_view ON public.performance_reviews
  FOR SELECT USING (
    employee_id = auth.uid()::text OR
    auth.uid()::text IN (
      SELECT id FROM public.employees WHERE company_id = public.performance_reviews.company_id AND role IN ('admin', 'hr', 'finance')
    )
  );

-- Managers can update their own reviews
CREATE POLICY pr_manager_update ON public.performance_reviews
  FOR UPDATE USING (
    manager_id = auth.uid()::text OR
    auth.uid()::text IN (
      SELECT id FROM public.employees WHERE company_id = public.performance_reviews.company_id AND role IN ('admin', 'hr')
    )
  );

-- Finance can view and update salary adjustments
CREATE POLICY psa_finance_all ON public.performance_salary_adjustments
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT id FROM public.employees WHERE company_id = public.performance_salary_adjustments.company_id AND role IN ('finance', 'finance_admin', 'admin', 'payroll_admin')
    )
  );

-- Employees can view their own salary adjustments
CREATE POLICY psa_employee_view ON public.performance_salary_adjustments
  FOR SELECT USING (
    employee_id = auth.uid()::text OR
    auth.uid()::text IN (
      SELECT id FROM public.employees WHERE company_id = public.performance_salary_adjustments.company_id AND role IN ('admin', 'hr')
    )
  );

-- Audit logs are read-only for authorized users
CREATE POLICY pal_read ON public.performance_audit_logs
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT id FROM public.employees WHERE company_id = public.performance_audit_logs.company_id AND role IN ('admin', 'hr', 'auditor', 'finance', 'finance_admin')
    )
  );
