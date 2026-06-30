-- ============================================================
-- 072_add_loans_approval_fields.sql
-- Add approval layer columns to public.loans and register loan-proofs private storage bucket
-- ============================================================

BEGIN;

-- Ensure company_id column exists on public.loans
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_loans_company_id ON public.loans(company_id);
UPDATE public.loans SET company_id = 'default' WHERE company_id IS NULL;

-- Add new columns to public.loans
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS proof_file_path text;

-- Add Storage Bucket for Loan Proofs (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'loan-proofs',
  'loan-proofs',
  false, -- private
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage objects in loan-proofs bucket
DROP POLICY IF EXISTS "loan_proofs_read_policy" ON storage.objects;
CREATE POLICY "loan_proofs_read_policy" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'loan-proofs');

DROP POLICY IF EXISTS "loan_proofs_insert_policy" ON storage.objects;
CREATE POLICY "loan_proofs_insert_policy" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'loan-proofs');

DROP POLICY IF EXISTS "loan_proofs_delete_policy" ON storage.objects;
CREATE POLICY "loan_proofs_delete_policy" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'loan-proofs');

-- Set default value for company_id on public.loans to prevent RLS violations on inserts
ALTER TABLE public.loans ALTER COLUMN company_id SET DEFAULT coalesce(current_setting('jwt.claims.company_id', true), 'default');

-- Helper function: check if user is the employee (defined here if missing)
CREATE OR REPLACE FUNCTION public.is_own_employee(emp_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = emp_id AND profile_id = auth.uid()
  );
$$;

-- Allow employees to submit/insert their own loan records in pending status
DROP POLICY IF EXISTS loan_insert_own ON public.loans;
CREATE POLICY loan_insert_own ON public.loans
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_own_employee(employee_id)
        AND status = 'pending'
    );

-- Allow employees to update/resubmit their own pending or rejected loan records
DROP POLICY IF EXISTS loan_update_own ON public.loans;
CREATE POLICY loan_update_own ON public.loans
    FOR UPDATE TO authenticated
    USING (
        public.is_own_employee(employee_id)
        AND status IN ('pending', 'rejected')
    )
    WITH CHECK (
        public.is_own_employee(employee_id)
        AND status = 'pending'
    );

COMMIT;
