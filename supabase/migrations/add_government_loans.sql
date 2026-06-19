-- Supabase SQL Migration: Add Government Loans Support and deduction frequency
-- Run this in the Supabase SQL Editor before running the application.

-- Add columns to public.loans
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS agency text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS loan_type text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS reference_number text;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS deduction_frequency text DEFAULT 'every_payroll';
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS start_deduction_date date;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS release_date date;

-- Update the check constraint for loan status to support pending, approved, and rejected statuses
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_status_check;
ALTER TABLE public.loans ADD CONSTRAINT loans_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'active', 'settled', 'frozen', 'cancelled'));

-- Update the check constraint for loan type to support government_loan or custom types
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_type_check;
ALTER TABLE public.loans ADD CONSTRAINT loans_type_check CHECK (type IN ('cash_advance', 'salary_loan', 'sss', 'pagibig', 'other', 'government_loan'));
