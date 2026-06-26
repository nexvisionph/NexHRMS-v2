-- ============================================================
-- 069_attendance_location_columns.sql
-- Formally add location_lat / location_lng to attendance_logs.
-- These columns were being written at runtime by /api/attendance/mobile
-- without a migration — this fixes the schema drift.
-- Ticket: NHRMS-ATT-006
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'attendance_logs'
  ) THEN
    RAISE EXCEPTION '[069] ABORTED: public.attendance_logs missing.';
  END IF;
END $$;

-- Additive-only: ADD COLUMN IF NOT EXISTS is safe to re-run
ALTER TABLE public.attendance_logs
    ADD COLUMN IF NOT EXISTS location_lat  double precision,
    ADD COLUMN IF NOT EXISTS location_lng  double precision;

-- Index for map/geo queries
CREATE INDEX IF NOT EXISTS idx_att_logs_location
    ON public.attendance_logs(location_lat, location_lng)
    WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Self-validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'attendance_logs'
      AND column_name  = 'location_lat'
  ) THEN
    RAISE EXCEPTION '[069 VALIDATE] location_lat column missing after migration';
  END IF;
  RAISE NOTICE '[069] ALL VALIDATIONS PASSED — location_lat, location_lng added to attendance_logs.';
END $$;

COMMIT;
