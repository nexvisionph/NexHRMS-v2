-- ============================================================
-- 013_fix_holidays_type_check.sql
-- Fix: holidays.type CHECK constraint used wrong enum values.
-- The codebase uses 'regular' | 'special', not 'special_non_working' | 'special_working'.
-- Run this if you already applied 004_attendance.sql with the old constraint.
-- ============================================================

ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_type_check;
ALTER TABLE public.holidays ADD CONSTRAINT holidays_type_check CHECK (type IN ('regular','special'));
