-- =====================================================
-- Migration 057: Employee 201 Files + Disciplinary (NTE / NOD)
-- =====================================================
-- Adds the database foundation for the Document Center / 201 File
-- module and the disciplinary workflow (NTE → NOD).
--
-- Style: 100% additive, idempotent (IF NOT EXISTS), reversible-safe.
-- Mirrors migration 056 (BIR foundation).
-- =====================================================

BEGIN;

-- ──────────────────────────────────────────────────────
-- STEP 0: Pre-flight
-- ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees') THEN
    RAISE EXCEPTION '[057] ABORTED: public.employees missing. Run migration 002 first.';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────
-- STEP 1: 201 documents table (rich, replaces ad-hoc employee_documents)
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_201_documents (
  id              text PRIMARY KEY,
  employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type   text NOT NULL CHECK (document_type IN (
                    'personal_info','employment_contract','government_id',
                    'resume','application_form','job_offer','medical',
                    'training_certificate','performance_evaluation',
                    'payslip','leave_record','warning','nte','nod',
                    'clearance','resignation_letter','coe',
                    'final_pay_document','other')),
  document_title  text NOT NULL,
  file_path       text,
  file_type       text,
  file_size       bigint,
  status          text NOT NULL DEFAULT 'uploaded' CHECK (status IN (
                    'pending_upload','uploaded','for_review','approved',
                    'rejected','expired','archived')),
  visibility      text NOT NULL DEFAULT 'hr_only' CHECK (visibility IN (
                    'hr_only','manager','employee','payroll','admin_only')),
  expiry_date     date,
  remarks         text,
  uploaded_by     text,
  reviewed_by     text,
  reviewed_at     timestamptz,
  case_id         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_201docs_employee ON public.employee_201_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_201docs_status   ON public.employee_201_documents(status);
CREATE INDEX IF NOT EXISTS idx_201docs_emp_type ON public.employee_201_documents(employee_id, document_type);
CREATE INDEX IF NOT EXISTS idx_201docs_expiry   ON public.employee_201_documents(expiry_date);

-- ──────────────────────────────────────────────────────
-- STEP 2: Disciplinary cases (parent of NTE/NOD)
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.disciplinary_cases (
  id                 text PRIMARY KEY,
  case_number        text NOT NULL UNIQUE,
  employee_id        text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  violation_type     text NOT NULL,
  policy_reference   text,
  incident_date      timestamptz NOT NULL,
  incident_location  text,
  description        text NOT NULL,
  evidence_urls      jsonb NOT NULL DEFAULT '[]'::jsonb,
  status             text NOT NULL DEFAULT 'open' CHECK (status IN (
                       'open','nte_issued','nte_acknowledged','explanation_submitted',
                       'no_response','under_review','nod_issued','nod_acknowledged',
                       'sanction_active','closed')),
  assigned_hr        text,
  created_by         text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disc_cases_employee ON public.disciplinary_cases(employee_id);
CREATE INDEX IF NOT EXISTS idx_disc_cases_status   ON public.disciplinary_cases(status);

-- ──────────────────────────────────────────────────────
-- STEP 3: NTE records (one per case)
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nte_records (
  id                       text PRIMARY KEY,
  case_id                  text NOT NULL UNIQUE
                             REFERENCES public.disciplinary_cases(id) ON DELETE CASCADE,
  employee_id              text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  response_deadline        date NOT NULL,
  document_id              text,
  issued_by                text NOT NULL,
  issued_at                timestamptz NOT NULL DEFAULT now(),
  acknowledged_at          timestamptz,
  employee_explanation     text,
  explanation_submitted_at timestamptz,
  status                   text NOT NULL DEFAULT 'issued' CHECK (status IN (
                             'draft','issued','acknowledged','explanation_submitted',
                             'no_response','under_review','closed','moved_to_nod')),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nte_employee ON public.nte_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_nte_status   ON public.nte_records(status);

-- ──────────────────────────────────────────────────────
-- STEP 4: NOD records (one per case)
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nod_records (
  id                  text PRIMARY KEY,
  case_id             text NOT NULL UNIQUE
                        REFERENCES public.disciplinary_cases(id) ON DELETE CASCADE,
  employee_id         text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  decision            text NOT NULL CHECK (decision IN (
                        'no_violation','verbal_warning','written_warning',
                        'final_warning','suspension','termination',
                        'salary_deduction','training_required','pip')),
  sanction_start_date date,
  sanction_end_date   date,
  return_to_work_date date,
  decision_details    text NOT NULL,
  document_id         text,
  issued_by           text NOT NULL,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  acknowledged_at     timestamptz,
  status              text NOT NULL DEFAULT 'issued' CHECK (status IN (
                        'draft','issued','acknowledged','sanction_active','completed','closed')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nod_employee ON public.nod_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_nod_status   ON public.nod_records(status);

-- ──────────────────────────────────────────────────────
-- STEP 5: updated_at triggers (reuse existing helper if present)
-- ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['employee_201_documents','disciplinary_cases','nte_records','nod_records']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t, t);
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────
-- STEP 6: Enable RLS
-- ──────────────────────────────────────────────────────
ALTER TABLE public.employee_201_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_cases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nte_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nod_records            ENABLE ROW LEVEL SECURITY;

-- Helper: lookup current employee role from auth.uid()
-- Reuses the same pattern as migration 056.

-- ── employee_201_documents policies ──────────────────────────
DROP POLICY IF EXISTS "201docs hr full" ON public.employee_201_documents;
CREATE POLICY "201docs hr full" ON public.employee_201_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  );

DROP POLICY IF EXISTS "201docs employee read own" ON public.employee_201_documents;
CREATE POLICY "201docs employee read own" ON public.employee_201_documents
  FOR SELECT TO authenticated
  USING (
    visibility = 'employee'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_201_documents.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "201docs payroll read" ON public.employee_201_documents;
CREATE POLICY "201docs payroll read" ON public.employee_201_documents
  FOR SELECT TO authenticated
  USING (
    visibility IN ('payroll','hr_only')
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('finance','payroll_admin')
    )
  );

-- ── disciplinary_cases policies ─────────────────────────────
DROP POLICY IF EXISTS "disc cases hr full" ON public.disciplinary_cases;
CREATE POLICY "disc cases hr full" ON public.disciplinary_cases
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  );

DROP POLICY IF EXISTS "disc cases employee read own" ON public.disciplinary_cases;
CREATE POLICY "disc cases employee read own" ON public.disciplinary_cases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = disciplinary_cases.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

-- ── nte_records policies ────────────────────────────────────
DROP POLICY IF EXISTS "nte hr full" ON public.nte_records;
CREATE POLICY "nte hr full" ON public.nte_records
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  );

DROP POLICY IF EXISTS "nte employee select own" ON public.nte_records;
CREATE POLICY "nte employee select own" ON public.nte_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = nte_records.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "nte employee submit own" ON public.nte_records;
CREATE POLICY "nte employee submit own" ON public.nte_records
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = nte_records.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = nte_records.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

-- ── nod_records policies ────────────────────────────────────
DROP POLICY IF EXISTS "nod hr full" ON public.nod_records;
CREATE POLICY "nod hr full" ON public.nod_records
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  );

DROP POLICY IF EXISTS "nod employee select own" ON public.nod_records;
CREATE POLICY "nod employee select own" ON public.nod_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = nod_records.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "nod employee ack own" ON public.nod_records;
CREATE POLICY "nod employee ack own" ON public.nod_records
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = nod_records.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = nod_records.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

-- ──────────────────────────────────────────────────────
-- STEP 7: Storage bucket for 201 docs (private)
-- ──────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-documents',
  'employee-documents',
  false,
  26214400,  -- 25 MB
  ARRAY[
    'application/pdf',
    'image/jpeg','image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "201 storage hr write" ON storage.objects;
CREATE POLICY "201 storage hr write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  )
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin','hr')
    )
  );

DROP POLICY IF EXISTS "201 storage employee read own" ON storage.objects;
CREATE POLICY "201 storage employee read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    -- folder convention: <employee_id>/<filename>
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = (storage.foldername(name))[1]
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

COMMIT;

-- =====================================================
-- Migration 057 complete.
-- =====================================================
