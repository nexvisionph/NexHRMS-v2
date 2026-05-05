-- ============================================================
-- 028: Biometric palm scan + expanded attendance exception flags
-- ============================================================

ALTER TABLE public.biometric_enrollments
  DROP CONSTRAINT IF EXISTS biometric_enrollments_method_check;

ALTER TABLE public.biometric_enrollments
  ADD CONSTRAINT biometric_enrollments_method_check
  CHECK (method = ANY (ARRAY['fingerprint','face','palm','rfid','pin']));

ALTER TABLE public.biometric_logs
  DROP CONSTRAINT IF EXISTS biometric_logs_recognition_method_check;

ALTER TABLE public.biometric_logs
  ADD CONSTRAINT biometric_logs_recognition_method_check
  CHECK (recognition_method = ANY (ARRAY['fingerprint','face','palm','rfid','pin','manual']));

ALTER TABLE public.attendance_logs
  DROP CONSTRAINT IF EXISTS chk_attendance_logs_check_in_method;

ALTER TABLE public.attendance_logs
  ADD CONSTRAINT chk_attendance_logs_check_in_method
  CHECK (check_in_method IS NULL OR check_in_method = ANY (ARRAY['fingerprint','face','palm','rfid','pin','manual']));

ALTER TABLE public.attendance_logs
  DROP CONSTRAINT IF EXISTS chk_attendance_logs_check_out_method;

ALTER TABLE public.attendance_logs
  ADD CONSTRAINT chk_attendance_logs_check_out_method
  CHECK (check_out_method IS NULL OR check_out_method = ANY (ARRAY['fingerprint','face','palm','rfid','pin','manual']));

ALTER TABLE public.attendance_exceptions
  DROP CONSTRAINT IF EXISTS attendance_exceptions_flag_check;

ALTER TABLE public.attendance_exceptions
  ADD CONSTRAINT attendance_exceptions_flag_check
  CHECK (flag = ANY (ARRAY[
    'missing_in',
    'missing_out',
    'out_of_geofence',
    'duplicate_scan',
    'device_mismatch',
    'overtime_without_approval',
    'late_arrival',
    'early_departure',
    'suspicious_activity'
  ]));
