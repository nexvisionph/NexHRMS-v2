-- ============================================================
-- 067_mobile_attendance.sql
-- Mobile Attendance, Geotagging, and Biometric Flow
-- ============================================================

BEGIN;

-- 1. Update Employees Table
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS attendance_method text DEFAULT 'biometric_mobile'
    CHECK (attendance_method IN ('biometric_only', 'mobile_gps_only', 'biometric_mobile', 'web', 'manual_only'));

-- 2. Create Work Locations Table
CREATE TABLE IF NOT EXISTS public.work_locations (
    id                      text PRIMARY KEY DEFAULT ('WL-' || gen_random_uuid()::text),
    company_id              text NOT NULL,
    location_name           text NOT NULL,
    address                 text,
    latitude                double precision NOT NULL,
    longitude               double precision NOT NULL,
    allowed_radius_meters   integer NOT NULL DEFAULT 100 CHECK (allowed_radius_meters > 0),
    is_active               boolean NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_locations_company ON public.work_locations(company_id);

ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_work_locations_updated_at ON public.work_locations;
CREATE TRIGGER set_work_locations_updated_at
    BEFORE UPDATE ON public.work_locations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS: Admin/HR can manage, Supervisors/Employees can read their company's locations
DROP POLICY IF EXISTS work_locations_manage ON public.work_locations;
CREATE POLICY work_locations_manage ON public.work_locations
    FOR ALL USING (
        company_id = current_setting('jwt.claims.company_id', true)
        AND EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
              AND e.role IN ('admin', 'hr')
        )
    );

DROP POLICY IF EXISTS work_locations_read ON public.work_locations;
CREATE POLICY work_locations_read ON public.work_locations
    FOR SELECT USING (
        company_id = current_setting('jwt.claims.company_id', true)
        AND EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
        )
    );

-- 3. Create Employee Work Locations Table
CREATE TABLE IF NOT EXISTS public.employee_work_locations (
    id                  text PRIMARY KEY DEFAULT ('EWL-' || gen_random_uuid()::text),
    employee_id         text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    work_location_id    text NOT NULL REFERENCES public.work_locations(id) ON DELETE CASCADE,
    effective_date      date NOT NULL DEFAULT CURRENT_DATE,
    end_date            date,
    is_primary          boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_work_locations_employee ON public.employee_work_locations(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_work_locations_location ON public.employee_work_locations(work_location_id);

ALTER TABLE public.employee_work_locations ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_employee_work_locations_updated_at ON public.employee_work_locations;
CREATE TRIGGER set_employee_work_locations_updated_at
    BEFORE UPDATE ON public.employee_work_locations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
DROP POLICY IF EXISTS employee_work_locations_manage ON public.employee_work_locations;
CREATE POLICY employee_work_locations_manage ON public.employee_work_locations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
              AND e.role IN ('admin', 'hr')
        )
    );

DROP POLICY IF EXISTS employee_work_locations_read ON public.employee_work_locations;
CREATE POLICY employee_work_locations_read ON public.employee_work_locations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.profile_id = auth.uid()
              AND (e.role IN ('admin', 'hr', 'supervisor') OR e.id = employee_work_locations.employee_id)
        )
    );

-- 4. Update Attendance Evidence Table
ALTER TABLE public.attendance_evidence
    ADD COLUMN IF NOT EXISTS selfie_url text,
    ADD COLUMN IF NOT EXISTS detected_address text,
    ADD COLUMN IF NOT EXISTS ip_address text,
    ADD COLUMN IF NOT EXISTS app_version text,
    ADD COLUMN IF NOT EXISTS battery_level integer CHECK (battery_level >= 0 AND battery_level <= 100),
    ADD COLUMN IF NOT EXISTS distance_from_location_meters numeric;

-- 5. Update Attendance Logs Table
ALTER TABLE public.attendance_logs
    ADD COLUMN IF NOT EXISTS attendance_status text DEFAULT 'pending_review' 
        CHECK (attendance_status IN ('present', 'absent', 'late', 'undertime', 'half_day', 'rest_day_work', 'holiday_work', 'pending_review')),
    ADD COLUMN IF NOT EXISTS approved_by text,
    ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Add Storage Bucket for Selfies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('attendance-selfies', 'attendance-selfies', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS on Bucket (Storage Policies)
DROP POLICY IF EXISTS "Users can upload their own selfies" ON storage.objects;
CREATE POLICY "Users can upload their own selfies" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'attendance-selfies' 
        AND auth.uid() IS NOT NULL
    );

DROP POLICY IF EXISTS "Users can view their own selfies" ON storage.objects;
CREATE POLICY "Users can view their own selfies" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'attendance-selfies'
        AND (
            (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
            OR
            EXISTS (
                SELECT 1 FROM public.employees e
                WHERE e.profile_id = auth.uid()
                  AND e.role IN ('admin', 'hr', 'supervisor')
            )
        )
    );

COMMIT;
