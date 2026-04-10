-- ============================================================
-- 004: Attendance system (depends on employees, projects, shift_templates)
-- ============================================================

-- Attendance events (raw clock events)
CREATE TABLE public.attendance_events (
  id text NOT NULL,
  employee_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['IN','OUT','BREAK_START','BREAK_END'])),
  timestamp_utc timestamptz NOT NULL,
  project_id text,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_events_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_ae_project FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

-- Attendance evidence (GPS, QR, face verification per event)
CREATE TABLE public.attendance_evidence (
  id text NOT NULL,
  event_id text NOT NULL,
  gps_lat double precision,
  gps_lng double precision,
  gps_accuracy_meters double precision,
  geofence_pass boolean,
  qr_token_id text,
  device_integrity_result text
    CHECK (device_integrity_result IS NULL OR device_integrity_result = ANY (ARRAY['pass','fail','mock'])),
  face_verified boolean,
  mock_location_detected boolean,
  CONSTRAINT attendance_evidence_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_evidence_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.attendance_events(id)
);

-- Attendance exceptions (flags for anomalies)
CREATE TABLE public.attendance_exceptions (
  id text NOT NULL,
  event_id text,
  employee_id text NOT NULL,
  date date NOT NULL,
  flag text NOT NULL
    CHECK (flag = ANY (ARRAY['missing_in','missing_out','out_of_geofence','duplicate_scan','device_mismatch','overtime_without_approval'])),
  auto_generated boolean NOT NULL DEFAULT true,
  resolved_at timestamptz,
  resolved_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_exceptions_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_exceptions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.attendance_events(id),
  CONSTRAINT attendance_exceptions_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Attendance logs (daily summary per employee)
CREATE TABLE public.attendance_logs (
  id text NOT NULL,
  employee_id text NOT NULL,
  date date NOT NULL,
  check_in text,
  check_out text,
  hours numeric,
  status text NOT NULL DEFAULT 'absent'
    CHECK (status = ANY (ARRAY['present','absent','on_leave'])),
  project_id text,
  location_lat double precision,
  location_lng double precision,
  face_verified boolean,
  late_minutes integer,
  shift_id text,
  flags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_logs_pkey PRIMARY KEY (id),
  CONSTRAINT attendance_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_al_project FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT fk_al_shift FOREIGN KEY (shift_id) REFERENCES public.shift_templates(id)
);

-- Break records
CREATE TABLE public.break_records (
  id text NOT NULL,
  employee_id text NOT NULL,
  date date NOT NULL,
  break_type text NOT NULL DEFAULT 'lunch'
    CHECK (break_type = ANY (ARRAY['lunch','other'])),
  start_time text NOT NULL,
  end_time text,
  start_lat double precision,
  start_lng double precision,
  end_lat double precision,
  end_lng double precision,
  end_geofence_pass boolean,
  distance_from_site double precision,
  duration integer,
  overtime boolean DEFAULT false,
  CONSTRAINT break_records_pkey PRIMARY KEY (id),
  CONSTRAINT fk_breaks_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Overtime requests
CREATE TABLE public.overtime_requests (
  id text NOT NULL,
  employee_id text NOT NULL,
  date date NOT NULL,
  hours_requested numeric NOT NULL,
  reason text NOT NULL,
  project_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY['pending','approved','rejected'])),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamptz,
  rejection_reason text,
  CONSTRAINT overtime_requests_pkey PRIMARY KEY (id),
  CONSTRAINT overtime_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_ot_project FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

-- Location pings
CREATE TABLE public.location_pings (
  id text NOT NULL,
  employee_id text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy_meters double precision NOT NULL,
  within_geofence boolean NOT NULL DEFAULT true,
  project_id text,
  distance_from_site double precision,
  source text NOT NULL DEFAULT 'auto'
    CHECK (source = ANY (ARRAY['auto','manual','break_end'])),
  CONSTRAINT location_pings_pkey PRIMARY KEY (id),
  CONSTRAINT fk_pings_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Employee shifts junction
CREATE TABLE public.employee_shifts (
  employee_id text NOT NULL,
  shift_id text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_shifts_pkey PRIMARY KEY (employee_id),
  CONSTRAINT employee_shifts_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shift_templates(id),
  CONSTRAINT employee_shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Penalty records
CREATE TABLE public.penalty_records (
  id text NOT NULL,
  employee_id text NOT NULL,
  reason text NOT NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  penalty_until timestamptz NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  CONSTRAINT penalty_records_pkey PRIMARY KEY (id),
  CONSTRAINT penalty_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Manual checkins
CREATE TABLE public.manual_checkins (
  id text NOT NULL DEFAULT ('MCI-' || gen_random_uuid()::text),
  employee_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['IN','OUT'])),
  reason_id text,
  custom_reason text,
  performed_by text NOT NULL,
  timestamp_utc timestamptz NOT NULL DEFAULT now(),
  project_id text,
  notes text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT manual_checkins_pkey PRIMARY KEY (id),
  CONSTRAINT manual_checkins_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT manual_checkins_reason_id_fkey FOREIGN KEY (reason_id) REFERENCES public.manual_checkin_reasons(id),
  CONSTRAINT manual_checkins_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.employees(id),
  CONSTRAINT manual_checkins_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

-- Site survey photos
CREATE TABLE public.site_survey_photos (
  id text NOT NULL,
  event_id text NOT NULL,
  employee_id text NOT NULL,
  photo_data_url text NOT NULL,
  gps_lat double precision NOT NULL,
  gps_lng double precision NOT NULL,
  gps_accuracy_meters double precision NOT NULL,
  reverse_geo_address text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  geofence_pass boolean,
  project_id text,
  CONSTRAINT site_survey_photos_pkey PRIMARY KEY (id),
  CONSTRAINT fk_ssp_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Timesheets
CREATE TABLE public.timesheets (
  id text NOT NULL,
  employee_id text NOT NULL,
  date date NOT NULL,
  rule_set_id text,
  shift_id text,
  regular_hours numeric NOT NULL DEFAULT 0,
  overtime_hours numeric NOT NULL DEFAULT 0,
  night_diff_hours numeric NOT NULL DEFAULT 0,
  total_hours numeric NOT NULL DEFAULT 0,
  late_minutes integer NOT NULL DEFAULT 0,
  undertime_minutes integer NOT NULL DEFAULT 0,
  segments jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'computed'
    CHECK (status = ANY (ARRAY['computed','submitted','approved','rejected'])),
  computed_at timestamptz NOT NULL DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  CONSTRAINT timesheets_pkey PRIMARY KEY (id),
  CONSTRAINT timesheets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
