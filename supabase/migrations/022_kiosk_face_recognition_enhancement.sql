-- Migration 022: Kiosk Face Recognition Enhancement
-- Adds face enrollment, project verification methods, dynamic QR tokens, and manual check-in

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Face Enrollment Tracking
-- Stores encrypted face templates for employee verification
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS face_enrollments (
  id TEXT PRIMARY KEY DEFAULT 'FE-' || gen_random_uuid()::text,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  face_template_hash TEXT NOT NULL,  -- Encrypted face template
  enrollment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified TIMESTAMPTZ,
  verification_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  enrolled_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT face_enrollments_employee_unique UNIQUE (employee_id)
);

CREATE INDEX IF NOT EXISTS idx_face_enrollments_employee ON face_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_face_enrollments_active ON face_enrollments(is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- Project Verification Method Configuration
-- Admins select verification method per project
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_verification_methods (
  id TEXT PRIMARY KEY DEFAULT 'PVM-' || gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  verification_method TEXT NOT NULL CHECK (verification_method IN (
    'face_only', 
    'qr_only', 
    'face_or_qr', 
    'manual_only'
  )),
  require_geofence BOOLEAN DEFAULT true,
  geofence_radius_meters INTEGER DEFAULT 100,
  allow_manual_override BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT project_verification_methods_project_unique UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_verification_methods_project ON project_verification_methods(project_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Dynamic QR Tokens (replaces static QR)
-- Single-use, time-limited tokens for secure QR check-in
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qr_tokens (
  id TEXT PRIMARY KEY DEFAULT 'QRT-' || gen_random_uuid()::text,
  device_id TEXT NOT NULL REFERENCES kiosk_devices(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  used_by_kiosk_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to qr_tokens if it already exists without them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'qr_tokens' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE public.qr_tokens ADD COLUMN employee_id TEXT REFERENCES employees(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'qr_tokens' AND column_name = 'used_at'
  ) THEN
    ALTER TABLE public.qr_tokens ADD COLUMN used_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'qr_tokens' AND column_name = 'used_by_kiosk_id'
  ) THEN
    ALTER TABLE public.qr_tokens ADD COLUMN used_by_kiosk_id TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON qr_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_employee ON qr_tokens(employee_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_used ON qr_tokens(used);

-- ─────────────────────────────────────────────────────────────────────────────
-- Manual Check-in Reasons
-- Predefined reasons for manual attendance logging
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS manual_checkin_reasons (
  id TEXT PRIMARY KEY DEFAULT 'MCR-' || gen_random_uuid()::text,
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_checkin_reasons_active ON manual_checkin_reasons(is_active);

-- Seed default manual check-in reasons
INSERT INTO manual_checkin_reasons (id, reason) VALUES
  ('MCR-001', 'Biometric system unavailable'),
  ('MCR-002', 'Employee forgot QR code'),
  ('MCR-003', 'Face recognition failed multiple attempts'),
  ('MCR-004', 'Visitor/Contractor check-in'),
  ('MCR-005', 'Emergency check-in'),
  ('MCR-006', 'System maintenance'),
  ('MCR-007', 'Other')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Manual Check-in Log
-- Audit trail for manual attendance entries
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS manual_checkins (
  id TEXT PRIMARY KEY DEFAULT 'MCI-' || gen_random_uuid()::text,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('IN', 'OUT')),
  reason_id TEXT REFERENCES manual_checkin_reasons(id),
  custom_reason TEXT,
  performed_by TEXT NOT NULL REFERENCES employees(id),
  timestamp_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_checkins_employee ON manual_checkins(employee_id);
CREATE INDEX IF NOT EXISTS idx_manual_checkins_timestamp ON manual_checkins(timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_manual_checkins_performed_by ON manual_checkins(performed_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- Kiosk Access PINs
-- Secure PIN-based access for kiosk terminals
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kiosk_pins (
  id TEXT PRIMARY KEY DEFAULT 'KP-' || gen_random_uuid()::text,
  kiosk_device_id TEXT REFERENCES kiosk_devices(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT kiosk_pins_device_unique UNIQUE (kiosk_device_id)
);

CREATE INDEX IF NOT EXISTS idx_kiosk_pins_device ON kiosk_pins(kiosk_device_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_pins_active ON kiosk_pins(is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- Add verification_method column to projects table (denormalized for performance)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'projects' 
    AND column_name = 'verification_method'
  ) THEN
    ALTER TABLE public.projects 
    ADD COLUMN verification_method TEXT CHECK (verification_method IN (
      'face_only', 'qr_only', 'face_or_qr', 'manual_only'
    )) DEFAULT 'face_or_qr';
    
    ALTER TABLE public.projects 
    ADD COLUMN require_geofence BOOLEAN DEFAULT true;
    
    ALTER TABLE public.projects 
    ADD COLUMN geofence_radius_meters INTEGER DEFAULT 100;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: is_admin() — not defined in earlier migrations, define it here
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.get_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-update triggers for updated_at columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to new tables
DROP TRIGGER IF EXISTS update_face_enrollments_updated_at ON public.face_enrollments;
CREATE TRIGGER update_face_enrollments_updated_at
  BEFORE UPDATE ON public.face_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_verification_methods_updated_at ON public.project_verification_methods;
CREATE TRIGGER update_project_verification_methods_updated_at
  BEFORE UPDATE ON public.project_verification_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security (RLS) Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all new tables
ALTER TABLE public.face_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_verification_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiosk_pins ENABLE ROW LEVEL SECURITY;

-- Face enrollments: employees can view own, admin/HR can view all
DROP POLICY IF EXISTS fe_select_own ON public.face_enrollments;
CREATE POLICY fe_select_own ON public.face_enrollments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = face_enrollments.employee_id 
      AND e.profile_id = auth.uid()
    )
    OR public.is_admin_or_hr()
  );

DROP POLICY IF EXISTS fe_insert ON public.face_enrollments;
CREATE POLICY fe_insert ON public.face_enrollments
  FOR INSERT WITH CHECK (public.is_admin_or_hr());

DROP POLICY IF EXISTS fe_update ON public.face_enrollments;
CREATE POLICY fe_update ON public.face_enrollments
  FOR UPDATE USING (public.is_admin_or_hr());

-- Project verification methods: read for all, write for admin
DROP POLICY IF EXISTS pvm_select ON public.project_verification_methods;
CREATE POLICY pvm_select ON public.project_verification_methods
  FOR SELECT USING (true);

DROP POLICY IF EXISTS pvm_insert ON public.project_verification_methods;
CREATE POLICY pvm_insert ON public.project_verification_methods
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS pvm_update ON public.project_verification_methods;
CREATE POLICY pvm_update ON public.project_verification_methods
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS pvm_delete ON public.project_verification_methods;
CREATE POLICY pvm_delete ON public.project_verification_methods
  FOR DELETE USING (public.is_admin());

-- QR tokens: service role only (generated by kiosk backend)
-- No RLS policies - accessed via service role only for security

-- Manual check-ins: employees view own, admin/HR view all
DROP POLICY IF EXISTS mci_select ON public.manual_checkins;
CREATE POLICY mci_select ON public.manual_checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = manual_checkins.employee_id 
      AND e.profile_id = auth.uid()
    )
    OR public.is_admin_or_hr()
  );

DROP POLICY IF EXISTS mci_insert ON public.manual_checkins;
CREATE POLICY mci_insert ON public.manual_checkins
  FOR INSERT WITH CHECK (public.is_admin_or_hr());

-- Kiosk PINs: admin only
DROP POLICY IF EXISTS kp_select ON public.kiosk_pins;
CREATE POLICY kp_select ON public.kiosk_pins
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS kp_insert ON public.kiosk_pins;
CREATE POLICY kp_insert ON public.kiosk_pins
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS kp_update ON public.kiosk_pins;
CREATE POLICY kp_update ON public.kiosk_pins
  FOR UPDATE USING (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper Functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Function to check if employee has enrolled face
CREATE OR REPLACE FUNCTION public.has_enrolled_face(emp_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM face_enrollments 
    WHERE employee_id = emp_id 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get project verification method
CREATE OR REPLACE FUNCTION public.get_project_verification_method(proj_id TEXT)
RETURNS TEXT AS $$
DECLARE
  method TEXT;
BEGIN
  -- First check project_verification_methods table
  SELECT verification_method INTO method
  FROM project_verification_methods
  WHERE project_id = proj_id;
  
  -- If not found, check denormalized column in projects table
  IF method IS NULL THEN
    SELECT verification_method INTO method
    FROM projects
    WHERE id = proj_id;
  END IF;
  
  RETURN COALESCE(method, 'face_or_qr');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate QR token
CREATE OR REPLACE FUNCTION public.validate_qr_token(token_value TEXT, kiosk_id TEXT)
RETURNS TABLE (valid BOOLEAN, employee_id TEXT, message TEXT) AS $$
DECLARE
  token_record RECORD;
BEGIN
  -- Get token record
  SELECT * INTO token_record
  FROM qr_tokens
  WHERE qr_tokens.token = token_value;
  
  -- Check if token exists
  IF token_record IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Invalid token'::TEXT;
    RETURN;
  END IF;
  
  -- Check if token is already used
  IF token_record.used THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Token already used'::TEXT;
    RETURN;
  END IF;
  
  -- Check if token is expired
  IF token_record.expires_at < NOW() THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Token expired'::TEXT;
    RETURN;
  END IF;
  
  -- Check if device matches (if provided)
  IF kiosk_id IS NOT NULL AND token_record.device_id != kiosk_id THEN
    RETURN QUERY SELECT false, NULL::TEXT, 'Invalid device'::TEXT;
    RETURN;
  END IF;
  
  -- Token is valid - mark as used
  UPDATE qr_tokens
  SET used = true, used_at = NOW(), used_by_kiosk_id = kiosk_id
  WHERE id = token_record.id;
  
  RETURN QUERY SELECT true, token_record.employee_id, 'Valid token'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment describing the migration
COMMENT ON SCHEMA public IS 'Migration 022: Added face enrollment, project verification methods, dynamic QR tokens, manual check-in, and kiosk PINs';
