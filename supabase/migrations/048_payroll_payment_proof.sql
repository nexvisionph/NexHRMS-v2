-- Migration: 048_payroll_payment_proof.sql
-- Adds payment proof support for payslips:
-- - payment_proof_url: URL to uploaded proof image (Supabase Storage)
-- - cash_amount: For cash payments, store actual amount given

-- Add columns to payslips
ALTER TABLE payslips
ADD COLUMN IF NOT EXISTS payment_proof_url text,
ADD COLUMN IF NOT EXISTS cash_amount numeric;

-- Add check constraint for payment method
ALTER TABLE payslips
DROP CONSTRAINT IF EXISTS payslips_payment_method_check;

ALTER TABLE payslips
ADD CONSTRAINT payslips_payment_method_check 
CHECK (payment_method IS NULL OR payment_method = ANY (ARRAY['bank_transfer'::text, 'gcash'::text, 'cash'::text, 'check'::text]));

-- Create storage bucket for payment proofs if not exists
-- Note: This needs to be run via Supabase Dashboard or CLI since SQL doesn't directly create buckets
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('payment-proofs', 'payment-proofs', false)
-- ON CONFLICT (id) DO NOTHING;

-- RLS policy for payment proofs storage (to be configured in Supabase Dashboard):
-- - Admin/Finance/Payroll_Admin can upload (INSERT)
-- - Employees can view their own payslip's proof (SELECT where payslip.employee_id matches)

COMMENT ON COLUMN payslips.payment_proof_url IS 'URL to uploaded payment proof image in Supabase Storage';
COMMENT ON COLUMN payslips.cash_amount IS 'Actual cash amount given (for cash payments)';
COMMENT ON COLUMN payslips.bank_reference_id IS 'Reference number/ID: Bank Transfer ref, GCash ref ID, Check number';
