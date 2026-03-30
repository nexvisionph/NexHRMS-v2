-- ============================================================
-- 010_projects_timesheets_settings.sql
-- Projects, timesheets, attendance rule sets, calendar events,
-- kiosk, location, appearance, gov table versions, custom pages
-- ============================================================

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
    id                      text PRIMARY KEY,
    name                    text NOT NULL,
    description             text,
    location_lat            double precision,
    location_lng            double precision,
    location_radius         double precision,
    assigned_employee_ids   text[] NOT NULL DEFAULT '{}',
    status                  text DEFAULT 'active'
                            CHECK (status IN ('active','completed','on_hold')),
    created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Attendance Rule Sets (§3 timesheet computation)
CREATE TABLE IF NOT EXISTS public.attendance_rule_sets (
    id                          text PRIMARY KEY,
    name                        text NOT NULL,
    standard_hours_per_day      numeric NOT NULL DEFAULT 8,
    grace_minutes               integer NOT NULL DEFAULT 15,
    rounding_policy             text NOT NULL DEFAULT 'none'
                                CHECK (rounding_policy IN ('none','nearest_15','nearest_30')),
    overtime_requires_approval  boolean NOT NULL DEFAULT true,
    night_diff_start            text,
    night_diff_end              text,
    holiday_multiplier          numeric NOT NULL DEFAULT 1.0
);

ALTER TABLE public.attendance_rule_sets ENABLE ROW LEVEL SECURITY;

-- Timesheets (daily computed)
CREATE TABLE IF NOT EXISTS public.timesheets (
    id                  text PRIMARY KEY,
    employee_id         text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date                date NOT NULL,
    rule_set_id         text,
    shift_id            text,
    regular_hours       numeric NOT NULL DEFAULT 0,
    overtime_hours      numeric NOT NULL DEFAULT 0,
    night_diff_hours    numeric NOT NULL DEFAULT 0,
    total_hours         numeric NOT NULL DEFAULT 0,
    late_minutes        integer NOT NULL DEFAULT 0,
    undertime_minutes   integer NOT NULL DEFAULT 0,
    segments            jsonb NOT NULL DEFAULT '[]',
    status              text NOT NULL DEFAULT 'computed'
                        CHECK (status IN ('computed','submitted','approved','rejected')),
    computed_at         timestamptz NOT NULL DEFAULT now(),
    approved_by         text,
    approved_at         timestamptz,
    UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ts_employee ON public.timesheets(employee_id);
CREATE INDEX IF NOT EXISTS idx_ts_date ON public.timesheets(date);

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- Calendar Events
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id      text PRIMARY KEY,
    title   text NOT NULL,
    time    text NOT NULL,
    date    date NOT NULL,
    type    text
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Kiosk Devices
CREATE TABLE IF NOT EXISTS public.kiosk_devices (
    id              text PRIMARY KEY,
    name            text NOT NULL,
    registered_at   timestamptz NOT NULL DEFAULT now(),
    project_id      text,
    is_active       boolean NOT NULL DEFAULT true
);

ALTER TABLE public.kiosk_devices ENABLE ROW LEVEL SECURITY;

-- QR Tokens (short-lived)
CREATE TABLE IF NOT EXISTS public.qr_tokens (
    id          text PRIMARY KEY,
    device_id   text NOT NULL REFERENCES public.kiosk_devices(id) ON DELETE CASCADE,
    token       text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    used        boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_qr_device ON public.qr_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_qr_expires ON public.qr_tokens(expires_at);

ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;

-- Location Tracking Config (singleton)
CREATE TABLE IF NOT EXISTS public.location_config (
    id                              text PRIMARY KEY DEFAULT 'default',
    enabled                         boolean NOT NULL DEFAULT true,
    ping_interval_minutes           integer NOT NULL DEFAULT 5,
    require_location                boolean NOT NULL DEFAULT true,
    warn_employee_out_of_fence      boolean NOT NULL DEFAULT true,
    alert_admin_out_of_fence        boolean NOT NULL DEFAULT true,
    alert_admin_location_disabled   boolean NOT NULL DEFAULT true,
    track_during_breaks             boolean NOT NULL DEFAULT false,
    retain_days                     integer NOT NULL DEFAULT 90,
    require_selfie                  boolean NOT NULL DEFAULT false,
    selfie_required_projects        text[] DEFAULT '{}',
    selfie_max_age                  integer NOT NULL DEFAULT 120,
    show_reverse_geocode            boolean NOT NULL DEFAULT true,
    selfie_compression_quality      numeric NOT NULL DEFAULT 0.7,
    lunch_duration                  integer NOT NULL DEFAULT 60,
    lunch_geofence_required         boolean NOT NULL DEFAULT false,
    lunch_overtime_threshold        integer NOT NULL DEFAULT 0,
    alert_admin_on_geofence_violation boolean NOT NULL DEFAULT true,
    allowed_breaks_per_day          integer NOT NULL DEFAULT 2,
    break_grace_period              integer NOT NULL DEFAULT 5,
    updated_at                      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.location_config ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_location_config_updated_at ON public.location_config;
CREATE TRIGGER set_location_config_updated_at
    BEFORE UPDATE ON public.location_config
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Location Pings
CREATE TABLE IF NOT EXISTS public.location_pings (
    id                  text PRIMARY KEY,
    employee_id         text NOT NULL,
    timestamp           timestamptz NOT NULL DEFAULT now(),
    lat                 double precision NOT NULL,
    lng                 double precision NOT NULL,
    accuracy_meters     double precision NOT NULL,
    within_geofence     boolean NOT NULL DEFAULT true,
    project_id          text,
    distance_from_site  double precision,
    source              text NOT NULL DEFAULT 'auto'
                        CHECK (source IN ('auto','manual','break_end'))
);

CREATE INDEX IF NOT EXISTS idx_pings_employee ON public.location_pings(employee_id);
CREATE INDEX IF NOT EXISTS idx_pings_timestamp ON public.location_pings(timestamp);

ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;

-- Site Survey Photos
CREATE TABLE IF NOT EXISTS public.site_survey_photos (
    id                  text PRIMARY KEY,
    event_id            text NOT NULL,
    employee_id         text NOT NULL,
    photo_data_url      text NOT NULL,
    gps_lat             double precision NOT NULL,
    gps_lng             double precision NOT NULL,
    gps_accuracy_meters double precision NOT NULL,
    reverse_geo_address text,
    captured_at         timestamptz NOT NULL DEFAULT now(),
    geofence_pass       boolean,
    project_id          text
);

CREATE INDEX IF NOT EXISTS idx_ssp_employee ON public.site_survey_photos(employee_id);

ALTER TABLE public.site_survey_photos ENABLE ROW LEVEL SECURITY;

-- Break Records
CREATE TABLE IF NOT EXISTS public.break_records (
    id                  text PRIMARY KEY,
    employee_id         text NOT NULL,
    date                date NOT NULL,
    break_type          text NOT NULL DEFAULT 'lunch'
                        CHECK (break_type IN ('lunch','other')),
    start_time          text NOT NULL,
    end_time            text,
    start_lat           double precision,
    start_lng           double precision,
    end_lat             double precision,
    end_lng             double precision,
    end_geofence_pass   boolean,
    distance_from_site  double precision,
    duration            integer,
    overtime            boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_br_employee ON public.break_records(employee_id);

ALTER TABLE public.break_records ENABLE ROW LEVEL SECURITY;

-- Appearance Config (singleton — company branding)
CREATE TABLE IF NOT EXISTS public.appearance_config (
    id                  text PRIMARY KEY DEFAULT 'default',
    company_name        text NOT NULL DEFAULT 'NexHRMS',
    company_logo        text,
    sidebar_color       text DEFAULT '#1e293b',
    primary_color       text DEFAULT '#3b82f6',
    login_heading       text,
    login_sub_heading   text,
    login_background    text,
    login_logo          text,
    updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appearance_config ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_appearance_config_updated_at ON public.appearance_config;
CREATE TRIGGER set_appearance_config_updated_at
    BEFORE UPDATE ON public.appearance_config
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Government Table Versions (§7)
CREATE TABLE IF NOT EXISTS public.gov_table_versions (
    id              text PRIMARY KEY,
    table_name      text NOT NULL CHECK (table_name IN ('sss','philhealth','pagibig','tax')),
    version         text NOT NULL,
    effective_date  date NOT NULL,
    snapshot_json   text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gov_table_versions ENABLE ROW LEVEL SECURITY;

-- Custom Roles Dashboard Layouts (stored as JSONB per role)
CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
    role_id     text PRIMARY KEY REFERENCES public.roles_custom(id) ON DELETE CASCADE,
    widgets     jsonb NOT NULL DEFAULT '[]',
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_dashboard_layouts_updated_at ON public.dashboard_layouts;
CREATE TRIGGER set_dashboard_layouts_updated_at
    BEFORE UPDATE ON public.dashboard_layouts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Custom Pages (page builder)
CREATE TABLE IF NOT EXISTS public.custom_pages (
    id              text PRIMARY KEY,
    title           text NOT NULL,
    slug            text NOT NULL UNIQUE,
    icon            text NOT NULL DEFAULT 'file',
    description     text,
    allowed_roles   text[] NOT NULL DEFAULT '{}',
    widgets         jsonb NOT NULL DEFAULT '[]',
    show_in_sidebar boolean NOT NULL DEFAULT true,
    "order"         integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_pages ENABLE ROW LEVEL SECURITY;
