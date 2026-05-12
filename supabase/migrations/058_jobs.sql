-- =====================================================
-- Migration 058: Jobs / Talent Acquisition
-- =====================================================
-- Adds the database foundation for the Jobs module:
--   • job_postings  — open positions managed by HR / admin
--   • job_applications — applicant pipeline per posting
--
-- Style: 100% additive, idempotent (IF NOT EXISTS), reversible-safe.
-- Mirrors migration 057 style.
-- =====================================================

BEGIN;

-- ──────────────────────────────────────────────────────
-- STEP 0: Pre-flight
-- ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'employees'
  ) THEN
    RAISE EXCEPTION '[058] ABORTED: public.employees missing. Run migration 002 first.';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────
-- STEP 1: job_postings
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_postings (
  id               text PRIMARY KEY,
  title            text NOT NULL,
  department       text NOT NULL,
  location         text NOT NULL,
  type             text NOT NULL CHECK (type IN (
                     'full_time','part_time','contract','internship','freelance')),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN (
                     'draft','open','on_hold','closed')),
  priority         text NOT NULL DEFAULT 'medium' CHECK (priority IN (
                     'low','medium','high','urgent')),
  headcount        integer NOT NULL DEFAULT 1 CHECK (headcount >= 1),
  salary_min       numeric(12,2),
  salary_max       numeric(12,2),
  description      text NOT NULL DEFAULT '',
  requirements     text NOT NULL DEFAULT '',
  responsibilities text NOT NULL DEFAULT '',
  deadline         date,
  created_by       text NOT NULL,               -- employee id
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  -- integrity: salary_min <= salary_max when both are set
  CONSTRAINT job_salary_range_check CHECK (
    salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max
  )
);

CREATE INDEX IF NOT EXISTS idx_job_postings_status     ON public.job_postings(status);
CREATE INDEX IF NOT EXISTS idx_job_postings_department ON public.job_postings(department);
CREATE INDEX IF NOT EXISTS idx_job_postings_created_at ON public.job_postings(created_at DESC);

-- ──────────────────────────────────────────────────────
-- STEP 2: job_applications
-- ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.job_applications (
  id                text PRIMARY KEY,
  job_id            text NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  applicant_name    text NOT NULL,
  applicant_email   text NOT NULL,
  applicant_phone   text,
  resume_url        text,
  cover_letter      text,
  source            text NOT NULL DEFAULT 'Other',
  status            text NOT NULL DEFAULT 'applied' CHECK (status IN (
                      'applied','screening','interview','offer','hired','rejected','withdrawn')),
  interview_date    timestamptz,
  offer_salary      numeric(12,2),
  notes             text,
  reviewed_by          text,                       -- employee id
  reviewed_at          timestamptz,
  -- file stored in Supabase Storage bucket "job-resumes"
  resume_storage_path  text,                       -- storage object path (private)
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_apps_job_id     ON public.job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_apps_status     ON public.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_apps_email      ON public.job_applications(applicant_email);
CREATE INDEX IF NOT EXISTS idx_job_apps_created_at ON public.job_applications(created_at DESC);

-- ──────────────────────────────────────────────────────
-- STEP 3: updated_at triggers (reuse existing helper)
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
  FOR t IN SELECT unnest(ARRAY['job_postings','job_applications']) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', t, t
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────
-- STEP 4: Row Level Security
-- ──────────────────────────────────────────────────────
ALTER TABLE public.job_postings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Helper inline CTE:
--   Checks that the authenticated user maps to an employee with role admin or hr.

-- ── job_postings policies ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "jobs hr full" ON public.job_postings;
CREATE POLICY "jobs hr full" ON public.job_postings
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin', 'hr')
    )
  );

-- Employees can read open postings (for self-service / internal job board)
DROP POLICY IF EXISTS "jobs employee read open" ON public.job_postings;
CREATE POLICY "jobs employee read open" ON public.job_postings
  FOR SELECT TO authenticated
  USING (
    status = 'open'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

-- ── job_applications policies ────────────────────────────────────────────────

DROP POLICY IF EXISTS "job apps hr full" ON public.job_applications;
CREATE POLICY "job apps hr full" ON public.job_applications
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin', 'hr')
    )
  );

-- ──────────────────────────────────────────────────────
-- STEP 5: Stats view (optional — convenient for dashboards)
-- ──────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.job_stats AS
SELECT
  COUNT(*) FILTER (WHERE status = 'open')    AS open_postings,
  COUNT(*) FILTER (WHERE status = 'draft')   AS draft_postings,
  COUNT(*) FILTER (WHERE status = 'on_hold') AS on_hold_postings,
  COUNT(*) FILTER (WHERE status = 'closed')  AS closed_postings,
  COUNT(*)                                   AS total_postings
FROM public.job_postings;

CREATE OR REPLACE VIEW public.job_pipeline_stats AS
SELECT
  jp.id            AS job_id,
  jp.title,
  jp.department,
  jp.status,
  COUNT(ja.id)                                                  AS total_applicants,
  COUNT(ja.id) FILTER (WHERE ja.status = 'applied')            AS applied,
  COUNT(ja.id) FILTER (WHERE ja.status = 'screening')          AS screening,
  COUNT(ja.id) FILTER (WHERE ja.status = 'interview')          AS interview,
  COUNT(ja.id) FILTER (WHERE ja.status = 'offer')              AS offer,
  COUNT(ja.id) FILTER (WHERE ja.status = 'hired')              AS hired,
  COUNT(ja.id) FILTER (WHERE ja.status = 'rejected')           AS rejected,
  COUNT(ja.id) FILTER (WHERE ja.status = 'withdrawn')          AS withdrawn
FROM public.job_postings jp
LEFT JOIN public.job_applications ja ON ja.job_id = jp.id
GROUP BY jp.id, jp.title, jp.department, jp.status;

-- ──────────────────────────────────────────────────────
-- STEP 5: Private storage bucket for applicant resumes
-- ──────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-resumes',
  'job-resumes',
  false,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- HR / admin: full read + write access to all resumes
DROP POLICY IF EXISTS "job resumes hr write" ON storage.objects;
CREATE POLICY "job resumes hr write" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'job-resumes'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    bucket_id = 'job-resumes'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
        AND e.role IN ('admin', 'hr')
    )
  );

COMMIT;

-- =====================================================
-- Migration 058 complete.
-- =====================================================
-- 
-- Useful queries after running this migration:
--
-- 1. List all open postings with applicant counts:
--    SELECT * FROM public.job_pipeline_stats WHERE status = 'open';
--
-- 2. Get overall stats:
--    SELECT * FROM public.job_stats;
--
-- 3. Applicant pipeline for a specific job:
--    SELECT * FROM public.job_applications
--    WHERE job_id = '<id>'
--    ORDER BY created_at DESC;
--
-- 4. Hired applicants this month:
--    SELECT ja.*, jp.title
--    FROM public.job_applications ja
--    JOIN public.job_postings jp ON jp.id = ja.job_id
--    WHERE ja.status = 'hired'
--      AND ja.updated_at >= date_trunc('month', now());
--
-- 5. All applicants with uploaded resumes:
--    SELECT id, applicant_name, applicant_email, resume_storage_path
--    FROM public.job_applications
--    WHERE resume_storage_path IS NOT NULL
--    ORDER BY created_at DESC;
--
-- 6. Full pipeline for a job (use the view):
--    SELECT * FROM public.job_pipeline_stats WHERE job_id = '<id>';
--
-- NOTE: Resume download URLs are signed (private bucket).
--   Generate in your app via supabase.storage.from('job-resumes').createSignedUrl(path, 3600)
-- =====================================================
