-- Migration 043: Add duration and hours columns to leave_requests
-- These columns exist in the TypeScript LeaveRequest type but were missing
-- from the DB schema, causing all leave request upserts to fail silently.

ALTER TABLE public.leave_requests
    ADD COLUMN IF NOT EXISTS duration text NOT NULL DEFAULT 'full_day'
        CHECK (duration IN ('full_day', 'half_day_am', 'half_day_pm', 'hourly')),
    ADD COLUMN IF NOT EXISTS hours numeric;
