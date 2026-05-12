-- Migration 030: Add emergency_contact and address columns to employees table
-- These fields already exist in profiles; adding them to employees ensures
-- the write-through sync pattern (Zustand → employees table) maps correctly.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS address text;

-- Backfill from profiles where linked
UPDATE public.employees e
SET
  emergency_contact = COALESCE(e.emergency_contact, p.emergency_contact),
  address           = COALESCE(e.address, p.address)
FROM public.profiles p
WHERE e.profile_id::uuid = p.id
  AND (e.emergency_contact IS NULL OR e.address IS NULL);
