-- Fix: migration 054 was never applied to this database.
-- The constraint still only allows ('draft', 'published', 'signed') from migration 045.
-- This migration updates it to include 'paid' and 'payment_hold'.

ALTER TABLE public.payslips
DROP CONSTRAINT IF EXISTS payslips_status_check;

ALTER TABLE public.payslips
ADD CONSTRAINT payslips_status_check
CHECK (status IN ('draft', 'published', 'signed', 'paid', 'payment_hold'));
