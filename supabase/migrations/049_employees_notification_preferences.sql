-- Add notification_preferences jsonb column to employees table.
-- Stores per-employee opt-outs: { leaveUpdates, absenceAlerts, payrollAlerts, pushEnabled }
-- Defaults to empty object (all enabled by default in app code).
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Allow any authenticated user to read/write their own notification_preferences.
-- The API route validates ownership server-side.
