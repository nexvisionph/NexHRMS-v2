-- ============================================================
-- 009: Audit, Notifications, Documents, Kiosk, Face, Dashboard, Custom Pages
-- ============================================================

-- Audit logs
CREATE TABLE public.audit_logs (
  id text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  performed_by text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  reason text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);

-- Notification logs
CREATE TABLE public.notification_logs (
  id text NOT NULL,
  employee_id text NOT NULL,
  type text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app'
    CHECK (channel = ANY (ARRAY['email','sms','both','in_app'])),
  subject text NOT NULL,
  body text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent'
    CHECK (status = ANY (ARRAY['sent','failed','simulated'])),
  recipient_email text,
  recipient_phone text,
  error_message text,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  link text,
  CONSTRAINT notification_logs_pkey PRIMARY KEY (id),
  CONSTRAINT fk_nl_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Employee documents
CREATE TABLE public.employee_documents (
  id text NOT NULL,
  employee_id text NOT NULL,
  name text NOT NULL,
  file_url text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT employee_documents_pkey PRIMARY KEY (id),
  CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Kiosk devices
CREATE TABLE public.kiosk_devices (
  id text NOT NULL,
  name text NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now(),
  project_id text,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT kiosk_devices_pkey PRIMARY KEY (id),
  CONSTRAINT fk_kd_project FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

-- Kiosk PINs
CREATE TABLE public.kiosk_pins (
  id text NOT NULL DEFAULT ('KP-' || gen_random_uuid()::text),
  kiosk_device_id text UNIQUE,
  pin_hash text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz,
  is_active boolean DEFAULT true,
  CONSTRAINT kiosk_pins_pkey PRIMARY KEY (id),
  CONSTRAINT kiosk_pins_kiosk_device_id_fkey FOREIGN KEY (kiosk_device_id) REFERENCES public.kiosk_devices(id)
);

-- QR tokens
CREATE TABLE public.qr_tokens (
  id text NOT NULL,
  device_id text NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  employee_id text,
  used_at timestamptz,
  used_by_kiosk_id text,
  CONSTRAINT qr_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT qr_tokens_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.kiosk_devices(id),
  CONSTRAINT qr_tokens_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Face enrollments
CREATE TABLE public.face_enrollments (
  id text NOT NULL DEFAULT ('FE-' || gen_random_uuid()::text),
  employee_id text NOT NULL UNIQUE,
  face_template_hash text NOT NULL,
  enrollment_date timestamptz NOT NULL DEFAULT now(),
  last_verified timestamptz,
  verification_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  enrolled_by text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  embedding jsonb,
  reference_image text,
  CONSTRAINT face_enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT face_enrollments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Project verification methods
CREATE TABLE public.project_verification_methods (
  id text NOT NULL DEFAULT ('PVM-' || gen_random_uuid()::text),
  project_id text NOT NULL UNIQUE,
  verification_method text NOT NULL
    CHECK (verification_method = ANY (ARRAY['face_only','qr_only','face_or_qr','manual_only'])),
  require_geofence boolean DEFAULT true,
  geofence_radius_meters integer DEFAULT 100,
  allow_manual_override boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT project_verification_methods_pkey PRIMARY KEY (id),
  CONSTRAINT project_verification_methods_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

-- Project assignments junction
CREATE TABLE public.project_assignments (
  project_id text NOT NULL,
  employee_id text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_assignments_pkey PRIMARY KEY (project_id, employee_id),
  CONSTRAINT project_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Dashboard layouts
CREATE TABLE public.dashboard_layouts (
  role_id text NOT NULL,
  widgets jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_layouts_pkey PRIMARY KEY (role_id),
  CONSTRAINT dashboard_layouts_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles_custom(id)
);

-- Custom pages
CREATE TABLE public.custom_pages (
  id text NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'file',
  description text,
  allowed_roles text[] NOT NULL DEFAULT '{}',
  widgets jsonb NOT NULL DEFAULT '[]',
  show_in_sidebar boolean NOT NULL DEFAULT true,
  "order" integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_pages_pkey PRIMARY KEY (id)
);
