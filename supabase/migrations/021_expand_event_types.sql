-- Migration 021: Expand attendance_events.event_type for full admin audit trail
-- Adds all admin action event types to support comprehensive event ledger

ALTER TABLE public.attendance_events
  DROP CONSTRAINT IF EXISTS attendance_events_event_type_check;

ALTER TABLE public.attendance_events
  ADD CONSTRAINT attendance_events_event_type_check
  CHECK (event_type IN (
    'IN', 'OUT', 'BREAK_START', 'BREAK_END',
    'OVERRIDE', 'BULK_OVERRIDE', 'MARK_ABSENT', 'MARK_PRESENT',
    'OT_APPROVED', 'OT_REJECTED', 'OT_SUBMITTED',
    'EXCEPTION_RESOLVED', 'EXCEPTION_SCANNED',
    'HOLIDAY_ADDED', 'HOLIDAY_UPDATED', 'HOLIDAY_DELETED',
    'CSV_IMPORTED', 'CSV_EXPORTED',
    'PENALTY_APPLIED', 'PENALTY_CLEARED',
    'SHIFT_ASSIGNED', 'DATA_RESET'
  ));

-- Add new columns to attendance_events for audit context
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_events' AND column_name = 'performed_by'
  ) THEN
    ALTER TABLE public.attendance_events ADD COLUMN performed_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_events' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.attendance_events ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_events' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.attendance_events ADD COLUMN metadata jsonb;
  END IF;
END $$;

-- Add timestamps to attendance_logs if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.attendance_logs ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_logs' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.attendance_logs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;
