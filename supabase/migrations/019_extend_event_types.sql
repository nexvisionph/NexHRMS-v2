-- Migration 019: Extend attendance_events.event_type to support admin overrides
-- Adds OVERRIDE and BULK_OVERRIDE event types for audit trail

ALTER TABLE public.attendance_events
  DROP CONSTRAINT IF EXISTS attendance_events_event_type_check;

ALTER TABLE public.attendance_events
  ADD CONSTRAINT attendance_events_event_type_check
  CHECK (event_type IN ('IN','OUT','BREAK_START','BREAK_END','OVERRIDE','BULK_OVERRIDE'));
