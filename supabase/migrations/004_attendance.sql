-- ============================================================
-- 004_attendance.sql
-- Attendance: events (append-only), evidence, exceptions,
-- computed logs, shifts, holidays, overtime, penalties
-- ============================================================

-- Attendance Events — APPEND-ONLY immutable ledger (§2)
CREATE TABLE IF NOT EXISTS public.attendance_events (
    id              text PRIMARY KEY,
    employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    event_type      text NOT NULL CHECK (event_type IN ('IN','OUT','BREAK_START','BREAK_END')),
    timestamp_utc   timestamptz NOT NULL,
    project_id      text,
    device_id       text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- IMPORTANT: No UPDATE or DELETE policies will be created for this table (immutable)
CREATE INDEX IF NOT EXISTS idx_att_events_employee ON public.attendance_events(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_events_date ON public.attendance_events(timestamp_utc);

ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

-- Attendance Evidence — verification proof per clock event
CREATE TABLE IF NOT EXISTS public.attendance_evidence (
    id                      text PRIMARY KEY,
    event_id                text NOT NULL REFERENCES public.attendance_events(id) ON DELETE CASCADE,
    gps_lat                 double precision,
    gps_lng                 double precision,
    gps_accuracy_meters     double precision,
    geofence_pass           boolean,
    qr_token_id             text,
    device_integrity_result text CHECK (device_integrity_result IN ('pass','fail','mock') OR device_integrity_result IS NULL),
    face_verified           boolean,
    mock_location_detected  boolean
);

CREATE INDEX IF NOT EXISTS idx_att_evidence_event ON public.attendance_evidence(event_id);

ALTER TABLE public.attendance_evidence ENABLE ROW LEVEL SECURITY;

-- Attendance Exceptions — flagged anomalies
CREATE TABLE IF NOT EXISTS public.attendance_exceptions (
    id              text PRIMARY KEY,
    event_id        text REFERENCES public.attendance_events(id) ON DELETE SET NULL,
    employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date            date NOT NULL,
    flag            text NOT NULL CHECK (flag IN (
        'missing_in','missing_out','out_of_geofence',
        'duplicate_scan','device_mismatch','overtime_without_approval'
    )),
    auto_generated  boolean NOT NULL DEFAULT true,
    resolved_at     timestamptz,
    resolved_by     text,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_exceptions_employee ON public.attendance_exceptions(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_exceptions_date ON public.attendance_exceptions(date);

ALTER TABLE public.attendance_exceptions ENABLE ROW LEVEL SECURITY;

-- Attendance Logs — computed daily summaries (can be recomputed)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id              text PRIMARY KEY,
    employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date            date NOT NULL,
    check_in        text,
    check_out       text,
    hours           numeric,
    status          text NOT NULL DEFAULT 'absent'
                    CHECK (status IN ('present','absent','on_leave')),
    project_id      text,
    location_lat    double precision,
    location_lng    double precision,
    face_verified   boolean,
    late_minutes    integer,
    shift_id        text,
    flags           text[],
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_att_logs_employee ON public.attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_logs_date ON public.attendance_logs(date);

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_attendance_logs_updated_at ON public.attendance_logs;
CREATE TRIGGER set_attendance_logs_updated_at
    BEFORE UPDATE ON public.attendance_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Shift Templates
CREATE TABLE IF NOT EXISTS public.shift_templates (
    id              text PRIMARY KEY,
    name            text NOT NULL,
    start_time      text NOT NULL,
    end_time        text NOT NULL,
    grace_period    integer NOT NULL DEFAULT 10,
    break_duration  integer NOT NULL DEFAULT 60,
    work_days       integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_shifts_updated_at ON public.shift_templates;
CREATE TRIGGER set_shifts_updated_at
    BEFORE UPDATE ON public.shift_templates
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Employee-to-Shift assignments
CREATE TABLE IF NOT EXISTS public.employee_shifts (
    employee_id text PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
    shift_id    text NOT NULL REFERENCES public.shift_templates(id) ON DELETE CASCADE,
    assigned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;

-- Holidays (PH holidays + custom)
CREATE TABLE IF NOT EXISTS public.holidays (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    date        date NOT NULL,
    type        text NOT NULL CHECK (type IN ('regular','special')),
    multiplier  numeric NOT NULL DEFAULT 1.0,
    is_custom   boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);

ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- Overtime Requests
CREATE TABLE IF NOT EXISTS public.overtime_requests (
    id              text PRIMARY KEY,
    employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    date            date NOT NULL,
    hours_requested numeric NOT NULL,
    reason          text NOT NULL,
    project_id      text,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
    requested_at    timestamptz NOT NULL DEFAULT now(),
    reviewed_by     text,
    reviewed_at     timestamptz,
    rejection_reason text
);

CREATE INDEX IF NOT EXISTS idx_ot_requests_employee ON public.overtime_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_ot_requests_status ON public.overtime_requests(status);

ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;

-- Anti-Cheat Penalty Records
CREATE TABLE IF NOT EXISTS public.penalty_records (
    id              text PRIMARY KEY,
    employee_id     text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    reason          text NOT NULL,
    triggered_at    timestamptz NOT NULL DEFAULT now(),
    penalty_until   timestamptz NOT NULL,
    resolved        boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_penalties_employee ON public.penalty_records(employee_id);

ALTER TABLE public.penalty_records ENABLE ROW LEVEL SECURITY;
