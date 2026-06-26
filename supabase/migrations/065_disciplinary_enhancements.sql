-- =====================================================
-- Migration 065: Disciplinary Workflow Enhancements
-- =====================================================
-- Adds severity_level, witnesses, and result columns to
-- disciplinary_cases; expands the status CHECK constraint
-- to include 'draft'; creates the disciplinary_notes table
-- with indexes and RLS policies.
--
-- Style: 100% additive, idempotent (IF NOT EXISTS / IF EXISTS),
-- backward-compatible, wrapped in a single transaction.
-- =====================================================

BEGIN;

-- ──────────────────────────────────────────────────────
-- STEP 1: Add new nullable columns to disciplinary_cases
-- ──────────────────────────────────────────────────────

-- severity_level: classification of case gravity
ALTER TABLE public.disciplinary_cases
  ADD COLUMN IF NOT EXISTS severity_level text
    CHECK (severity_level IN ('minor', 'moderate', 'major', 'critical'));

-- witnesses: free-text list of witness names
ALTER TABLE public.disciplinary_cases
  ADD COLUMN IF NOT EXISTS witnesses text;

-- result: final outcome recorded at case closure
ALTER TABLE public.disciplinary_cases
  ADD COLUMN IF NOT EXISTS result text
    CHECK (result IN (
      'DISMISSED',
      'VERBAL_WARNING',
      'WRITTEN_WARNING',
      'FINAL_WARNING',
      'SUSPENSION',
      'TERMINATION',
      'WITHDRAWN',
      'SETTLED'
    ));

-- ──────────────────────────────────────────────────────
-- STEP 2: Expand the status CHECK constraint to include 'draft'
-- Supabase/PostgreSQL does not support in-place CHECK modification,
-- so we drop the existing constraint and recreate it.
-- ──────────────────────────────────────────────────────

ALTER TABLE public.disciplinary_cases
  DROP CONSTRAINT IF EXISTS disciplinary_cases_status_check;

ALTER TABLE public.disciplinary_cases
  ADD CONSTRAINT disciplinary_cases_status_check
    CHECK (status IN (
      'draft',
      'open',
      'nte_issued',
      'nte_acknowledged',
      'explanation_submitted',
      'no_response',
      'under_review',
      'nod_issued',
      'nod_acknowledged',
      'sanction_active',
      'closed'
    ));

-- ──────────────────────────────────────────────────────
-- STEP 3: Investigation notes table
-- ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.disciplinary_notes (
  id         text        PRIMARY KEY,
  case_id    text        NOT NULL REFERENCES public.disciplinary_cases(id) ON DELETE CASCADE,
  author_id  text        NOT NULL,
  body       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────
-- STEP 4: Indexes on disciplinary_notes
-- ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_disc_notes_case   ON public.disciplinary_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_disc_notes_author ON public.disciplinary_notes(author_id);

-- ──────────────────────────────────────────────────────
-- STEP 5: Row Level Security on disciplinary_notes
-- ──────────────────────────────────────────────────────

ALTER TABLE public.disciplinary_notes ENABLE ROW LEVEL SECURITY;

-- HR/Admin: full access (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "disc notes hr full" ON public.disciplinary_notes;
CREATE POLICY "disc notes hr full" ON public.disciplinary_notes
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

-- Employees: read-only access to notes on their own cases
DROP POLICY IF EXISTS "disc notes employee read own" ON public.disciplinary_notes;
CREATE POLICY "disc notes employee read own" ON public.disciplinary_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.disciplinary_cases dc
      JOIN public.employees e ON e.id = dc.employee_id
      WHERE dc.id = disciplinary_notes.case_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

COMMIT;

-- =====================================================
-- Migration 065 complete.
-- =====================================================
