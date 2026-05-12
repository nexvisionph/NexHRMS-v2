-- Migration 044: Add read tracking columns to notification_logs
-- These columns track whether an in-app notification has been read by the recipient.

ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS read boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

-- Index for fast unread queries per employee
CREATE INDEX IF NOT EXISTS idx_notif_unread ON public.notification_logs(employee_id, read)
  WHERE read = false;

-- Also add a link column for navigation (stores path without role prefix)
ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS link text;

-- Allow employees to update their own notification read status via RLS
DROP POLICY IF EXISTS nl_update_own ON public.notification_logs;
CREATE POLICY nl_update_own ON public.notification_logs
  FOR UPDATE USING (
    employee_id IN (
      SELECT id FROM public.employees WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT id FROM public.employees WHERE profile_id = auth.uid()
    )
  );
