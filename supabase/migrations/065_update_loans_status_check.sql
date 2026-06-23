-- ============================================================
-- 065_update_loans_status_check.sql
-- Expand status CHECK constraint to support Loan Management Framework
-- ============================================================

ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_status_check;
ALTER TABLE public.loans ADD CONSTRAINT loans_status_check CHECK (status IN (
    'pending', 
    'approved', 
    'rejected', 
    'active', 
    'settled', 
    'frozen', 
    'cancelled', 
    'separated', 
    'draft', 
    'pending_supervisor', 
    'pending_hr', 
    'pending_finance'
));
