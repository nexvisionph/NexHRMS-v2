-- Migration: Allow employees to INSERT their own 201 documents
-- Fixes RLS violation when employees upload documents via the employee view.
-- Employees can insert documents for themselves (their own employee_id).
-- They can also update their own documents that are still in draft/for_review status.

-- ── Allow employees to INSERT their own documents ────────────
DROP POLICY IF EXISTS "201docs employee insert own" ON public.employee_201_documents;
CREATE POLICY "201docs employee insert own" ON public.employee_201_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_201_documents.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

-- ── Allow employees to UPDATE their own documents (only pre-approval) ──
DROP POLICY IF EXISTS "201docs employee update own" ON public.employee_201_documents;
CREATE POLICY "201docs employee update own" ON public.employee_201_documents
  FOR UPDATE TO authenticated
  USING (
    status IN ('pending_upload', 'uploaded', 'for_review', 'rejected')
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_201_documents.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_201_documents.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

-- ── Allow employees to upload files to their own folder in storage ──
DROP POLICY IF EXISTS "201 storage employee write own" ON storage.objects;
CREATE POLICY "201 storage employee write own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = (storage.foldername(name))[1]
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );

-- ── Allow employees to DELETE their own documents (only pre-approval) ──
DROP POLICY IF EXISTS "201docs employee delete own" ON public.employee_201_documents;
CREATE POLICY "201docs employee delete own" ON public.employee_201_documents
  FOR DELETE TO authenticated
  USING (
    status IN ('pending_upload', 'uploaded', 'for_review', 'rejected')
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = employee_201_documents.employee_id
        AND (e.profile_id = auth.uid() OR e.email = (auth.jwt() ->> 'email'))
    )
  );
