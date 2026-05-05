-- ============================================================
-- 027: Biometric Integration Module
-- ============================================================

-- Biometric devices registry
CREATE TABLE IF NOT EXISTS public.biometric_devices (
  id text NOT NULL DEFAULT ('BIODEV-' || gen_random_uuid()::text),
  company_id text NOT NULL,
  name text NOT NULL,
  location text,
  device_type text,
  supported_methods text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  api_key_hash text,
  api_key_last4 text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biometric_devices_pkey PRIMARY KEY (id),
  CONSTRAINT fk_biometric_devices_company FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT fk_biometric_devices_created_by FOREIGN KEY (created_by) REFERENCES public.employees(id)
);

CREATE INDEX IF NOT EXISTS idx_biometric_devices_company_id ON public.biometric_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_biometric_devices_active ON public.biometric_devices(is_active);

-- Biometric enrollments (employee <-> method)
CREATE TABLE IF NOT EXISTS public.biometric_enrollments (
  id text NOT NULL DEFAULT ('BIOENR-' || gen_random_uuid()::text),
  company_id text NOT NULL,
  employee_id text NOT NULL,
  method text NOT NULL
    CHECK (method = ANY (ARRAY['fingerprint','face','rfid','pin'])),
  external_id text,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  enrolled_by text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT biometric_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT fk_biometric_enrollments_company FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT fk_biometric_enrollments_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_biometric_enrollments_by FOREIGN KEY (enrolled_by) REFERENCES public.employees(id)
);

CREATE INDEX IF NOT EXISTS idx_biometric_enrollments_company_id ON public.biometric_enrollments(company_id);
CREATE INDEX IF NOT EXISTS idx_biometric_enrollments_employee_id ON public.biometric_enrollments(employee_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_biometric_enrollments_active_unique
  ON public.biometric_enrollments(employee_id, method)
  WHERE is_active = true;

-- Biometric logs (raw device events)
CREATE TABLE IF NOT EXISTS public.biometric_logs (
  id text NOT NULL DEFAULT ('BIOLOG-' || gen_random_uuid()::text),
  company_id text NOT NULL,
  employee_id text NOT NULL,
  device_id text NOT NULL,
  recognition_method text NOT NULL
    CHECK (recognition_method = ANY (ARRAY['fingerprint','face','rfid','pin','manual'])),
  log_type text NOT NULL
    CHECK (log_type = ANY (ARRAY['time_in','time_out'])),
  logged_at timestamptz NOT NULL,
  confidence_score numeric,
  low_confidence boolean NOT NULL DEFAULT false,
  raw_payload jsonb,
  payload_hash text,
  device_log_id text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT biometric_logs_pkey PRIMARY KEY (id),
  CONSTRAINT fk_biometric_logs_company FOREIGN KEY (company_id) REFERENCES public.companies(id),
  CONSTRAINT fk_biometric_logs_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT fk_biometric_logs_device FOREIGN KEY (device_id) REFERENCES public.biometric_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_biometric_logs_company_id ON public.biometric_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_biometric_logs_employee_id ON public.biometric_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_biometric_logs_device_id ON public.biometric_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_biometric_logs_logged_at ON public.biometric_logs(logged_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_biometric_logs_device_log_id
  ON public.biometric_logs(device_id, device_log_id)
  WHERE device_log_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_biometric_logs_payload_hash
  ON public.biometric_logs(payload_hash)
  WHERE payload_hash IS NOT NULL;

-- Extend attendance_logs with biometric method tracking
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS check_in_method text,
  ADD COLUMN IF NOT EXISTS check_out_method text,
  ADD COLUMN IF NOT EXISTS check_in_device_id text,
  ADD COLUMN IF NOT EXISTS check_out_device_id text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_attendance_logs_check_in_method'
  ) THEN
    ALTER TABLE public.attendance_logs
      ADD CONSTRAINT chk_attendance_logs_check_in_method
        CHECK (check_in_method IS NULL OR check_in_method = ANY (ARRAY['fingerprint','face','rfid','pin','manual']));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_attendance_logs_check_out_method'
  ) THEN
    ALTER TABLE public.attendance_logs
      ADD CONSTRAINT chk_attendance_logs_check_out_method
        CHECK (check_out_method IS NULL OR check_out_method = ANY (ARRAY['fingerprint','face','rfid','pin','manual']));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_logs_check_in_device'
  ) THEN
    ALTER TABLE public.attendance_logs
      ADD CONSTRAINT fk_attendance_logs_check_in_device
        FOREIGN KEY (check_in_device_id) REFERENCES public.biometric_devices(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_logs_check_out_device'
  ) THEN
    ALTER TABLE public.attendance_logs
      ADD CONSTRAINT fk_attendance_logs_check_out_device
        FOREIGN KEY (check_out_device_id) REFERENCES public.biometric_devices(id);
  END IF;
END $$;

-- RLS
ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_logs ENABLE ROW LEVEL SECURITY;

-- Devices: Admin can manage, Admin/HR can read
CREATE POLICY biometric_devices_select ON public.biometric_devices
  FOR SELECT USING (
    company_id = current_setting('jwt.claims.company_id', true)
    AND public.is_admin_or_hr()
  );

CREATE POLICY biometric_devices_manage ON public.biometric_devices
  FOR ALL USING (
    company_id = current_setting('jwt.claims.company_id', true)
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    company_id = current_setting('jwt.claims.company_id', true)
    AND public.get_my_role() = 'admin'
  );

-- Enrollments: Admin/HR manage; employee can view own
CREATE POLICY biometric_enrollments_select ON public.biometric_enrollments
  FOR SELECT USING (
    company_id = current_setting('jwt.claims.company_id', true)
    AND (
      public.is_admin_or_hr()
      OR employee_id IN (
        SELECT id FROM public.employees WHERE profile_id = auth.uid()
      )
    )
  );

CREATE POLICY biometric_enrollments_manage ON public.biometric_enrollments
  FOR ALL USING (
    company_id = current_setting('jwt.claims.company_id', true)
    AND public.is_admin_or_hr()
  )
  WITH CHECK (
    company_id = current_setting('jwt.claims.company_id', true)
    AND public.is_admin_or_hr()
  );

-- Logs: Admin/HR can read
CREATE POLICY biometric_logs_select ON public.biometric_logs
  FOR SELECT USING (
    company_id = current_setting('jwt.claims.company_id', true)
    AND public.is_admin_or_hr()
  );

CREATE POLICY biometric_logs_manage ON public.biometric_logs
  FOR ALL USING (
    company_id = current_setting('jwt.claims.company_id', true)
    AND public.is_admin_or_hr()
  )
  WITH CHECK (
    company_id = current_setting('jwt.claims.company_id', true)
    AND public.is_admin_or_hr()
  );
