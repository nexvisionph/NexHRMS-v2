-- Migration 041: Face Recognition Test Account
-- Creates a dedicated employee + project for testing biometric face check-in.
-- This account is pre-configured for face_only verification and visible
-- in the demo login page as "Face Demo" (face@sdsi.com / demo1234).

-- ─── 1. Insert employee record ────────────────────────────────────────────────
INSERT INTO public.employees (
    id, name, email, role, department, status, work_type,
    salary, join_date, productivity, location, phone, birthday,
    work_days, pay_frequency, whatsapp_number, preferred_channel,
    address, emergency_contact, pin, nfc_id, created_at, updated_at
)
VALUES (
    'EMP029',
    'Alex Reyes',
    'face@sdsi.com',
    'employee',
    'Operations',
    'active',
    'ONSITE',
    52000,
    '2025-01-15',
    90,
    'Makati, Metro Manila',
    '+63-917-5550029',
    '1993-07-14',
    ARRAY['Mon','Tue','Wed','Thu','Fri'],
    'semi_monthly',
    '+63-917-5550029',
    'in_app',
    '29 Dela Rosa Street, Legazpi Village, Makati City, Metro Manila',
    'Rosa Reyes (Mother) - +63-918-5550029',
    '290290',
    'NFC-029',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name            = EXCLUDED.name,
    email           = EXCLUDED.email,
    status          = EXCLUDED.status,
    department      = EXCLUDED.department,
    work_type       = EXCLUDED.work_type,
    updated_at      = NOW();

-- ─── 2. Insert face-only project ─────────────────────────────────────────────
INSERT INTO public.projects (
    id, name, description,
    location_lat, location_lng, location_radius,
    assigned_employee_ids,
    verification_method,
    require_geofence,
    geofence_radius_meters,
    status,
    created_at
)
VALUES (
    'PRJ006',
    'Makati Security Post – Face Check-in',
    'Makati CBD security post using face recognition for attendance. Demo account for testing biometric check-in.',
    14.5567,
    121.0178,
    300,
    ARRAY['EMP029'],
    'face_only',
    true,
    300,
    'active',
    '2026-01-15T00:00:00Z'
)
ON CONFLICT (id) DO UPDATE SET
    name                    = EXCLUDED.name,
    assigned_employee_ids   = EXCLUDED.assigned_employee_ids,
    verification_method     = EXCLUDED.verification_method,
    updated_at              = NOW();

-- ─── 3. Insert project_assignment join record ─────────────────────────────────
INSERT INTO public.project_assignments (project_id, employee_id, assigned_at)
VALUES ('PRJ006', 'EMP029', NOW())
ON CONFLICT (project_id, employee_id) DO NOTHING;

-- ─── 4. Enable Realtime for face_enrollments if not already enabled ───────────
-- (idempotent — safe to run multiple times)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'face_enrollments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.face_enrollments;
    END IF;
END
$$;
