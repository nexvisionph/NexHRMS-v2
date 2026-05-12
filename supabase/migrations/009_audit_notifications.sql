-- ============================================================
-- 009_audit_notifications.sql
-- Audit logs, notification logs, notification rules
-- ============================================================

-- Audit Logs (immutable — append only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id              text PRIMARY KEY,
    entity_type     text NOT NULL,
    entity_id       text NOT NULL,
    action          text NOT NULL,
    performed_by    text NOT NULL,
    timestamp       timestamptz NOT NULL DEFAULT now(),
    reason          text,
    before_snapshot jsonb,
    after_snapshot  jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_performer ON public.audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.audit_logs(timestamp);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Notification Logs
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id              text PRIMARY KEY,
    employee_id     text NOT NULL,
    type            text NOT NULL,
    channel         text NOT NULL DEFAULT 'in_app'
                    CHECK (channel IN ('email','sms','both','in_app')),
    subject         text NOT NULL,
    body            text NOT NULL,
    sent_at         timestamptz NOT NULL DEFAULT now(),
    status          text NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent','failed','simulated')),
    recipient_email text,
    recipient_phone text,
    error_message   text
);

CREATE INDEX IF NOT EXISTS idx_notif_employee ON public.notification_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_notif_type ON public.notification_logs(type);

ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Notification Rules (admin configurable)
CREATE TABLE IF NOT EXISTS public.notification_rules (
    id                text PRIMARY KEY,
    trigger           text NOT NULL,
    enabled           boolean NOT NULL DEFAULT true,
    channel           text NOT NULL DEFAULT 'in_app'
                      CHECK (channel IN ('email','sms','both','in_app')),
    recipient_roles   text[] NOT NULL DEFAULT '{}',
    timing            text NOT NULL DEFAULT 'immediate'
                      CHECK (timing IN ('immediate','scheduled')),
    schedule_time     text,
    reminder_days     integer[],
    subject_template  text NOT NULL,
    body_template     text NOT NULL,
    sms_template      text
);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
